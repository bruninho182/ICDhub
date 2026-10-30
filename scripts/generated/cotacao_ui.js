"use strict";
/// <reference path="cotacao.ts" />
var ICDCotacaoUI;
(function (ICDCotacaoUI) {
    let aberta = false;
    async function abrirConfiguracoes() {
        const resposta = await chrome.runtime.sendMessage({ acao: 'ABRIR_CONFIGURACOES' });
        if (!resposta?.ok)
            throw new Error(resposta?.erro || 'Não foi possível abrir as configurações.');
    }
    ICDCotacaoUI.abrirConfiguracoes = abrirConfiguracoes;
    async function abrir() {
        const existente = document.getElementById('modal-cotacao-icd');
        if (existente) {
            existente.dispatchEvent(new Event('icd-restaurar'));
            return;
        }
        if (aberta)
            return;
        aberta = true;
        try {
            const dados = await chrome.storage.local.get(['listaPasseios']);
            montar(dados.listaPasseios || []);
        }
        catch {
            aberta = false;
            alert('Não foi possível abrir os tarifários. Tente novamente.');
        }
    }
    ICDCotacaoUI.abrir = abrir;
    function montar(inicial) {
        let passeios = inicial;
        let linhas = [];
        let desatualizada = false;
        let carregando = false;
        const host = document.createElement('div');
        host.id = 'modal-cotacao-icd';
        // A interface é isolada dos estilos do WhatsApp e da calculadora antiga.
        host.style.cssText = 'all:initial;position:fixed;right:24px;top:72px;width:min(440px,calc(100vw - 24px));max-height:calc(100vh - 96px);z-index:2147483646;display:block';
        const root = host.attachShadow({ mode: 'open' });
        root.innerHTML = `<style>
      *{box-sizing:border-box} :host{font:14px system-ui;color:#e8edf7} button,input,select,textarea{font:inherit}
      .painel{font:14px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;color:#e8edf7;text-align:left;background:#142036;border:1px solid #405172;border-radius:16px;box-shadow:0 16px 60px #0006;overflow:hidden}
      header{display:flex;align-items:center;justify-content:space-between;padding:16px 18px;border-bottom:1px solid #34445e;cursor:move;touch-action:none}
      h2{font:700 17px/1.4 system-ui,sans-serif;color:#f1f5f9;margin:0} small{display:block;color:#acbad0;margin-top:4px}
      button{cursor:pointer;background:#273850;border:1px solid #495b78;border-radius:8px;color:#eef2ff;padding:9px 12px}
      button:hover{background:#3b4e6d}button:disabled{opacity:.5;cursor:default}
      button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible{outline:3px solid #c4b5fd;outline-offset:2px}
      .controles{display:flex;gap:6px} .controles button{padding:5px 9px}
      main{padding:18px;overflow:auto;max-height:calc(100vh - 200px)} label{display:block;color:#c8d4e6;font-weight:600;margin-bottom:6px}
      input,select,textarea{background:#0d1728;color:#eff3fa;border:1px solid #495b78;border-radius:8px;padding:10px;width:100%}
      input[type=search]{margin-bottom:8px}select{margin-bottom:14px}input[type=number]{width:72px;padding:8px}
      .categoria,.item{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:8px 0}.categoria span{font-size:12px;color:#acbad0;display:block;margin-top:3px}
      .item{padding:10px 0;border-bottom:1px solid #34445e}.item p{margin:0;line-height:1.5}.item small{margin:0}.item button{padding:4px 8px}
      .primario{background:#7553cb;border-color:#a78bfa;width:100%;font-weight:600;margin-top:12px}.primario:hover{background:#8564d8}
      .secao{border-top:1px solid #34445e;margin-top:16px;padding-top:16px}.total{font-size:23px;font-weight:700;color:#f1f5f9;margin:12px 0}
      #status{color:#f3d69b;line-height:1.5;margin:10px 0 0;white-space:pre-line}#preview{height:130px;resize:vertical;font-size:12px;line-height:1.6}
      summary{cursor:pointer;margin:14px 0;color:#c4b5fd} .rodape{display:flex;gap:8px}.rodape button{flex:1}.nota{font-size:12px;color:#aebdd2;line-height:1.5}
      [hidden]{display:none!important}
    </style><section class="painel" role="dialog" aria-label="Calculadora de cotações">
      <header><div><h2>Nova cotação</h2><small>Vários passeios, uma mensagem</small></div><div class="controles">
        <button id="minimizar" aria-label="Minimizar calculadora">−</button><button id="fechar" aria-label="Fechar calculadora">×</button></div></header>
      <main>
      <label for="busca">Encontrar passeio</label><input id="busca" type="search" placeholder="Busque pelo nome…">
      <select id="passeio" aria-label="Passeio"></select><p id="contexto-tarifa" class="nota" hidden></p><div id="categorias"></div>
      <button id="adicionar" class="primario">Adicionar à cotação</button>
      <p id="status" role="status" aria-live="polite"></p><button id="atualizar" hidden>Atualizar tarifas e limpar cotação</button>
      <div class="secao"><label>Resumo da cotação</label><div id="itens"></div><div id="total" class="total">R$ 0,00</div>
      <details><summary>Prévia da mensagem</summary><textarea id="preview" readonly aria-label="Prévia da mensagem"></textarea></details>
      <button id="copiar" class="primario" disabled>Copiar cotação</button>
      <p class="nota">A cotação é copiada para você revisar e enviar na conversa.</p>
      <div class="rodape"><button id="limpar">Limpar cotação</button><button id="configurar">Editar tarifários</button></div></div></main></section>`;
        const el = (id) => root.getElementById(id);
        const status = (texto) => { el('status').textContent = texto; };
        const select = el('passeio');
        const quantidades = new Map();
        function resumo() {
            const lista = el('itens');
            lista.replaceChildren();
            linhas.forEach((linha, index) => {
                const item = document.createElement('div');
                item.className = 'item';
                const texto = document.createElement('p');
                texto.textContent = `${linha.quantidade}× ${linha.tipo} · ${linha.passeio}`;
                const valor = document.createElement('small');
                valor.textContent = ICDCotacao.moeda(linha.quantidade * linha.centavos);
                texto.append(valor);
                const remover = document.createElement('button');
                remover.textContent = '×';
                remover.setAttribute('aria-label', `Remover ${linha.tipo} de ${linha.passeio}`);
                remover.onclick = () => { linhas.splice(index, 1); resumo(); };
                item.append(texto, remover);
                lista.append(item);
            });
            if (!linhas.length)
                lista.textContent = 'Nenhum ingresso adicionado.';
            el('total').textContent = ICDCotacao.moeda(ICDCotacao.total(linhas));
            el('preview').value = linhas.length ? ICDCotacao.mensagem(linhas) : '';
            el('copiar').disabled = !linhas.length || desatualizada;
        }
        function categorias() {
            quantidades.clear();
            const container = el('categorias');
            container.replaceChildren();
            const p = select.value === '' ? null : passeios[Number(select.value)];
            el('contexto-tarifa').hidden = true;
            el('contexto-tarifa').textContent = '';
            el('adicionar').disabled = !p || desatualizada;
            if (!p)
                return;
            try {
                ICDCotacao.validarPasseio(p.nome, p.ingressos);
            }
            catch {
                status('Este tarifário precisa de revisão. Corrija as categorias e os preços no painel.');
                el('adicionar').disabled = true;
                return;
            }
            p.ingressos.forEach((ing, index) => {
                const linha = document.createElement('div');
                linha.className = 'categoria';
                const label = document.createElement('label');
                label.textContent = ing.tipo;
                const valor = document.createElement('span');
                valor.textContent = `${ICDCotacao.moeda(ICDCotacao.centavos(ing.valor))} por ingresso`;
                label.append(valor);
                const input = document.createElement('input');
                input.type = 'number';
                input.min = '0';
                input.max = '999';
                input.step = '1';
                input.value = '0';
                input.setAttribute('aria-label', `Quantidade: ${ing.tipo}`);
                const id = `icd-qtd-${index}`;
                input.id = id;
                label.htmlFor = id;
                input.oninput = () => {
                    try {
                        quantidades.set(index, ICDCotacao.quantidade(input.value));
                        input.setCustomValidity('');
                        status('');
                    }
                    catch (erro) {
                        quantidades.delete(index);
                        input.setCustomValidity(erro.message);
                        status(erro.message);
                    }
                };
                linha.append(label, input);
                container.append(linha);
            });
        }
        function filtrar() {
            const busca = ICDCotacao.busca(el('busca').value);
            select.replaceChildren(new Option('Selecione um passeio', ''));
            passeios.forEach((p, i) => { const nome = ICDCotacao.nomeExibicao(p); if (ICDCotacao.busca(nome).includes(busca))
                select.append(new Option(nome, String(i))); });
            categorias();
            if (!passeios.length)
                status('Cadastre seus passeios em Editar tarifários para começar.');
            else if (select.options.length === 1)
                status('Nenhum passeio corresponde à busca.');
            else if (!desatualizada)
                status('');
        }
        el('busca').oninput = filtrar;
        select.onchange = categorias;
        el('adicionar').onclick = () => {
            if (desatualizada)
                return;
            const p = passeios[Number(select.value)];
            if (select.value === '' || !p)
                return;
            if (Array.from(root.querySelectorAll('input[type=number]')).some(input => !input.checkValidity())) {
                status('Corrija as quantidades antes de adicionar.');
                return;
            }
            const novas = p.ingressos.flatMap((ing, index) => {
                const qtd = quantidades.get(index) || 0;
                return qtd ? [{ passeio: ICDCotacao.nomeExibicao(p), tipo: ing.tipo, centavos: ICDCotacao.centavos(ing.valor), quantidade: qtd }] : [];
            });
            if (!novas.length) {
                status('Informe a quantidade de pelo menos uma categoria.');
                return;
            }
            linhas.push(...novas);
            resumo();
            categorias();
            status('Ingressos adicionados. Você pode incluir outro passeio.');
        };
        el('copiar').onclick = async () => {
            if (desatualizada || !linhas.length)
                return;
            try {
                await navigator.clipboard.writeText(ICDCotacao.mensagem(linhas));
                status('Cotação copiada. Revise e envie na conversa.');
            }
            catch {
                status('Não foi possível copiar. Abra a prévia, selecione o texto e copie manualmente.');
                root.querySelector('details').open = true;
                el('preview').select();
            }
        };
        el('limpar').onclick = () => { linhas = []; resumo(); categorias(); status('Cotação limpa.'); };
        el('configurar').onclick = () => { abrirConfiguracoes().catch(() => status('Não foi possível abrir as configurações. Recarregue a extensão e o WhatsApp e tente novamente.')); };
        const mudou = (changes, area) => {
            if (area !== 'local' || !changes.listaPasseios)
                return;
            desatualizada = true;
            el('atualizar').hidden = false;
            el('adicionar').disabled = true;
            resumo();
            status('Os tarifários foram alterados. Atualize antes de continuar; os itens atuais serão limpos.');
        };
        chrome.storage.onChanged.addListener(mudou);
        el('atualizar').onclick = async () => {
            if (carregando)
                return;
            carregando = true;
            try {
                const dados = await chrome.storage.local.get(['listaPasseios']);
                passeios = dados.listaPasseios || [];
                linhas = [];
                desatualizada = false;
                el('atualizar').hidden = true;
                filtrar();
                resumo();
                status('Tarifários atualizados.');
            }
            catch {
                status('Não foi possível atualizar. Tente novamente.');
            }
            finally {
                carregando = false;
            }
        };
        function restaurar() { el('minimizar').click(); }
        const minimizar = el('minimizar');
        minimizar.onclick = () => { const main = root.querySelector('main'); main.hidden = !main.hidden; minimizar.textContent = main.hidden ? '□' : '−'; minimizar.setAttribute('aria-label', main.hidden ? 'Restaurar calculadora' : 'Minimizar calculadora'); };
        host.addEventListener('icd-restaurar', () => { if (root.querySelector('main').hidden)
            restaurar(); el('busca').focus(); });
        el('fechar').onclick = () => { chrome.storage.onChanged.removeListener(mudou); host.remove(); aberta = false; };
        const header = root.querySelector('header');
        let arrasto = null;
        header.onpointerdown = e => { if (e.target.closest('button'))
            return; const r = host.getBoundingClientRect(); arrasto = { x: e.clientX, y: e.clientY, left: r.left, top: r.top }; header.setPointerCapture(e.pointerId); };
        header.onpointermove = e => {
            if (!arrasto)
                return;
            host.style.left = `${Math.max(0, Math.min(window.innerWidth - host.offsetWidth, arrasto.left + e.clientX - arrasto.x))}px`;
            host.style.top = `${Math.max(0, Math.min(window.innerHeight - 80, arrasto.top + e.clientY - arrasto.y))}px`;
            host.style.right = 'auto';
        };
        header.onpointerup = header.onpointercancel = () => { arrasto = null; };
        document.body.append(host);
        filtrar();
        resumo();
    }
})(ICDCotacaoUI || (ICDCotacaoUI = {}));
