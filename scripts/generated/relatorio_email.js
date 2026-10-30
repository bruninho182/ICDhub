"use strict";
/// <reference path="email_template.ts" />
/// <reference path="operacao_review.ts" />
var ICDRelatorioEmail;
(function (ICDRelatorioEmail) {
    const normalizar = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    let ocupado = false;
    let colunasPorLinha = new WeakMap();
    const cabecalho = (valor) => normalizar(valor).replace(/[^a-z]/g, '');
    function minutos(valor) {
        const m = valor.match(/^(\d{1,2}):(\d{2})$/);
        return m && +m[1] < 24 && +m[2] < 60 ? +m[1] * 60 + +m[2] : null;
    }
    ICDRelatorioEmail.minutos = minutos;
    function dadosDaLinha(linha) {
        const tabela = linha.closest('table');
        if (!tabela)
            return null;
        if (!colunasPorLinha.get(tabela)?.has(linha)) {
            const mapa = new Map();
            let colunaData = -1;
            let colunaProduto = -1;
            let tituloGrupo = '';
            for (const anterior of Array.from(tabela.querySelectorAll(':scope > tr, :scope > tbody > tr, :scope > thead > tr, :scope > tfoot > tr'))) {
                const celulas = Array.from(anterior.cells).filter(c => c.dataset.icdControle !== 'true');
                const celulaTitulo = celulas.length === 1 && celulas[0].colSpan > 1 ? celulas[0] : null;
                const titulo = celulaTitulo?.querySelector('div[align="center"] span.style8') ||
                    (celulaTitulo?.getAttribute('bgcolor')?.toLowerCase() === '#999999' ? celulaTitulo : null);
                const textoTitulo = titulo?.textContent?.replace(/\s+/g, ' ').trim() || '';
                if (textoTitulo && !/^(?:subtot|total)/i.test(textoTitulo)) {
                    tituloGrupo = textoTitulo;
                    colunaData = -1;
                    colunaProduto = -1;
                }
                mapa.set(anterior, [colunaData, colunaProduto, tituloGrupo]);
                const headers = celulas.map(c => cabecalho(c.textContent || ''));
                const data = headers.indexOf('dataprevista');
                const produto = headers.findIndex(c => ['produtopromocao', 'produto', 'passeio'].includes(c));
                if (data >= 0 && (produto >= 0 || tituloGrupo)) {
                    colunaData = data;
                    colunaProduto = produto;
                }
            }
            colunasPorLinha.set(tabela, mapa);
        }
        const [colunaData, colunaProduto, tituloGrupo] = colunasPorLinha.get(tabela).get(linha);
        if (colunaData < 0 || (!tituloGrupo && colunaProduto < 0))
            return null;
        const cells = Array.from(linha.cells).filter(c => c.dataset.icdControle !== 'true');
        const m = cells[colunaData]?.textContent?.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})\s*(\d{1,2}:\d{2})(?:\s|$)/);
        const passeio = tituloGrupo || cells[colunaProduto]?.textContent?.replace(/\s+/g, ' ').trim();
        if (!m || !passeio)
            return null;
        const hora = minutos(m[4]);
        const data = new Date(Date.UTC(+m[3], +m[2] - 1, +m[1]));
        if (hora === null || data.getUTCFullYear() !== +m[3] || data.getUTCMonth() !== +m[2] - 1 || data.getUTCDate() !== +m[1])
            return null;
        return { passeio, data: `${m[3]}-${m[2]}-${m[1]}`, minutos: hora };
    }
    ICDRelatorioEmail.dadosDaLinha = dadosDaLinha;
    function iniciar() {
        const painel = document.createElement('aside');
        painel.id = 'icd-relatorio-email';
        const root = painel.attachShadow({ mode: 'open' });
        painel.style.cssText = 'position:fixed;top:16px;right:16px;width:min(380px,95vw);z-index:10001';
        root.innerHTML = `<style>
      *{box-sizing:border-box}.painel{font:14px/1.5 system-ui;color:#172033;background:white;border:1px solid #bbc7d9;border-radius:12px;padding:16px;box-shadow:0 6px 28px #0003;max-height:85vh;overflow:auto}h2{font-size:17px;margin:0 0 10px}input,select{font:14px system-ui;width:100%;padding:9px;border:1px solid #bbc7d9;border-radius:7px;margin:4px 0 10px}label{display:block;font-size:12px;color:#526077}button{font:600 12px system-ui;padding:9px 12px;border:1px solid #bbc7d9;border-radius:7px;background:#fff;cursor:pointer;margin:4px 3px 4px 0}#preparar{background:#6036b5;color:white;width:100%;font-size:13px}p{margin:8px 0;color:#526077}summary{cursor:pointer;color:#6036b5}#status{color:#9c2639}button:focus-visible,input:focus-visible,select:focus-visible{outline:3px solid #a78bfa;outline-offset:2px}
    </style><section class="painel"><h2>E-mails do relatório</h2><label for="busca">Buscar destinatário no relatório</label><input id="busca" type="search" placeholder="E-mail ou texto da linha">
    <p id="contagem" role="status"></p><button id="selecionar">Selecionar encontrados</button><button id="limpar">Limpar seleção</button>
    <details open><summary>Selecionar por passeio e horário</summary>
      <label>Título do passeio no relatório<select id="filtro-passeio"><option value="">Selecione o título do grupo</option></select></label>
      <button id="isolar-passeio">Mostrar somente este passeio</button><button id="restaurar-pagina" hidden>Recarregar relatório completo</button>
      <p id="resultado-isolar" role="status">Remove os outros passeios desta página. Para voltar, recarregue o relatório.</p>
      <label>Data da visita (opcional)<input id="filtro-data" type="date"></label>
      <div style="display:flex;gap:10px"><label>Das<input id="filtro-inicio" type="time"></label><label>Até (inclusive)<input id="filtro-fim" type="time"></label></div>
      <p>Deixe Até vazio para marcar desse horário em diante. Sem data, usa todos os dias deste relatório.</p>
      <button id="selecionar-faixa">Marcar somente esta faixa</button><p id="resultado-faixa" role="status"></p>
    </details>
    <details><summary>Dados para o modelo da mensagem</summary><p>Necessários somente se o modelo usar esses campos.</p>
      <label>Operador<input id="operador"></label><label>Passeio<input id="passeio"></label><label>Data da visita<input id="data_visita" type="date"></label><label>Horário / período<input id="horario" placeholder="Ex.: 09:00 às 11:00"></label>
    </details><button id="preparar">Revisar e criar lotes (até 100 em CCO)</button>
    <div id="lotes" hidden><p id="progresso-lotes"></p><button id="preparar-lote">Preparar lote atual</button><button id="confirmar-lote">Marcar lote como enviado</button><button id="atualizar-lotes">Atualizar progresso</button><button id="encerrar-lotes">Encerrar acompanhamento</button></div>
    <p id="status" role="status"></p></section>`;
        const el = (id) => root.getElementById(id);
        let campanha = null;
        async function loteAcao(operacao, extras = {}) {
            const resposta = await chrome.runtime.sendMessage({ acao: 'RELATORIO_LOTES', operacao, id: campanha?.id, indice: campanha?.indice, ...extras });
            if (!resposta?.ok)
                throw new Error(resposta?.erro || 'Não foi possível atualizar os lotes.');
            campanha = resposta.campanha;
            mostrarLotes();
        }
        function mostrarLotes() {
            el('lotes').hidden = !campanha;
            const ativo = Boolean(campanha && campanha.indice < campanha.lotes.length);
            el('preparar').disabled = ativo;
            if (!campanha)
                return;
            if (!painel.isConnected)
                document.body.append(painel);
            painel.hidden = false;
            const total = campanha.lotes.reduce((soma, lote) => soma + lote.emails.length, 0);
            const lote = campanha.lotes[campanha.indice];
            el('progresso-lotes').textContent = lote
                ? `Lote ${campanha.indice + 1} de ${campanha.lotes.length} · ${lote.emails.length} destinatários · ${campanha.indice} lote(s) confirmado(s) · ${total} e-mails no total. ${lote.estado === 'preparado' ? 'Aguardando sua confirmação de envio.' : 'Pronto para preparar.'}`
                : `Concluído: ${campanha.lotes.length} lotes e ${total} destinatários confirmados por você.`;
            el('preparar-lote').disabled = !lote;
            el('preparar-lote').textContent = lote?.estado === 'preparado' ? 'Reabrir o mesmo lote' : 'Preparar lote atual';
            el('confirmar-lote').disabled = lote?.estado !== 'preparado';
        }
        async function abrirLote(revisar = true) {
            const atual = campanha;
            const lote = atual?.lotes[atual.indice];
            if (!atual || !lote)
                return;
            if (revisar && !await ICDOperacao.confirmar({ titulo: `Conferir lote ${atual.indice + 1} de ${atual.lotes.length}`, descricao: `${lote.emails.length} destinatários em CCO. Envie no webmail e depois marque este lote como enviado no relatório.`,
                campos: [['Destinatários em CCO', lote.emails.join('\n')], ['Assunto', atual.assunto], ['Mensagem', atual.corpo]], acao: lote.estado === 'preparado' ? 'Reabrir este lote' : 'Preparar e abrir webmail' }))
                return;
            const aba = window.open('about:blank', '_blank');
            if (!aba)
                throw new Error('O navegador bloqueou a nova aba. Permita abrir o webmail e tente novamente.');
            try {
                await loteAcao('preparar', { id: atual.id, indice: atual.indice });
                aba.location.href = 'https://webmail-seguro.com.br/?_task=mail&_action=compose';
                el('status').textContent = 'Preencha e envie o lote no webmail. Depois, marque-o como enviado para liberar o próximo.';
            }
            catch (erro) {
                aba.close();
                throw erro;
            }
        }
        async function comTrava(acao) {
            if (ocupado)
                return;
            ocupado = true;
            try {
                await acao();
            }
            catch (erro) {
                el('status').textContent = erro.message;
            }
            finally {
                ocupado = false;
                mostrarLotes();
            }
        }
        el('preparar-lote').onclick = () => { comTrava(() => abrirLote()); };
        el('atualizar-lotes').onclick = () => { comTrava(() => loteAcao('consultar')); };
        el('confirmar-lote').onclick = () => {
            comTrava(async () => {
                const atual = campanha;
                if (!atual)
                    return;
                if (!await ICDOperacao.confirmar({ titulo: 'Confirmar envio manual', descricao: 'Marque somente depois de enviar a mensagem deste lote no webmail. Abrir ou preencher o rascunho não comprova envio.',
                    campos: [['Lote', `${atual.indice + 1} de ${atual.lotes.length}`], ['Destinatários', String(atual.lotes[atual.indice]?.emails.length || 0)]], acao: 'Já enviei este lote' }))
                    return;
                await loteAcao('confirmar', { id: atual.id, indice: atual.indice });
                el('status').textContent = 'Confirmação salva. Prepare o próximo lote quando estiver pronto.';
            });
        };
        el('encerrar-lotes').onclick = () => {
            comTrava(async () => {
                const atual = campanha;
                if (!atual)
                    return;
                if (!await ICDOperacao.confirmar({ titulo: 'Encerrar acompanhamento', descricao: 'O progresso salvo será encerrado. Mensagens e rascunhos já abertos no webmail permanecem lá.', campos: [['Lotes confirmados', `${atual.indice} de ${atual.lotes.length}`]], acao: 'Encerrar acompanhamento' }))
                    return;
                await loteAcao('encerrar', { id: atual.id });
                el('status').textContent = 'Acompanhamento encerrado. Você pode criar uma nova seleção.';
            });
        };
        loteAcao('consultar').catch(erro => { el('status').textContent = erro.message; });
        let inputs = [];
        let textos = new WeakMap();
        const selecionados = () => inputs.filter(input => input.checked);
        function todos() { return inputs; }
        function encontrados() {
            const filtro = normalizar(el('busca').value);
            return filtro ? inputs.filter(input => textos.get(input)?.includes(filtro)) : inputs;
        }
        function contar() {
            const selecionadas = selecionados();
            const unicos = new Set(selecionadas.map(input => input.value.toLowerCase()));
            el('contagem').textContent = `${encontrados().length} linhas encontradas · ${selecionadas.length} selecionadas · ${unicos.size} e-mails únicos`;
        }
        let buscaAgendada;
        el('busca').oninput = () => { clearTimeout(buscaAgendada); buscaAgendada = setTimeout(contar, 150); };
        el('selecionar').onclick = () => { encontrados().forEach(input => { input.checked = true; }); contar(); };
        el('limpar').onclick = () => { todos().forEach(input => { input.checked = false; }); contar(); };
        el('restaurar-pagina').onclick = () => window.location.reload();
        el('isolar-passeio').onclick = () => {
            const passeio = el('filtro-passeio').value;
            if (!passeio) {
                el('resultado-isolar').textContent = 'Selecione primeiro o título do passeio.';
                return;
            }
            colunasPorLinha = new WeakMap();
            const linhas = todos().map(input => input.closest('tr'));
            const escolhidas = linhas.filter(linha => dadosDaLinha(linha)?.passeio === passeio);
            if (!escolhidas.length) {
                el('resultado-isolar').textContent = 'Nenhuma reserva reconhecida para este passeio. A página foi mantida.';
                return;
            }
            observador.disconnect();
            const tabelas = new Set(escolhidas.map(linha => linha.closest('table')));
            for (const tabela of tabelas) {
                const mapa = colunasPorLinha.get(tabela);
                const temGrupos = Array.from(mapa.values()).some(dados => Boolean(dados[2]));
                for (const linha of Array.from(tabela.rows)) {
                    const grupo = mapa.get(linha)?.[2];
                    const manter = temGrupos ? grupo === passeio : !dadosDaLinha(linha) || escolhidas.includes(linha);
                    if (!manter)
                        linha.remove();
                }
            }
            // Retira os nós do documento, em vez de apenas ocultar milhares de linhas.
            const manter = new Set([painel]);
            for (const no of [...tabelas, painel]) {
                let ancestral = no;
                while (ancestral && ancestral !== document.body) {
                    manter.add(ancestral);
                    ancestral = ancestral.parentNode;
                }
            }
            function reduzir(pai) {
                for (const filho of Array.from(pai.childNodes)) {
                    if (!manter.has(filho))
                        filho.remove();
                    else if (filho !== painel && !tabelas.has(filho))
                        reduzir(filho);
                }
            }
            reduzir(document.body);
            injetar();
            el('restaurar-pagina').hidden = false;
            el('resultado-isolar').textContent = `Somente ${passeio}: ${escolhidas.length} reservas. Os demais conteúdos foram removidos desta página.`;
            observar();
        };
        el('selecionar-faixa').onclick = () => {
            colunasPorLinha = new WeakMap();
            const passeio = el('filtro-passeio').value.trim();
            const inicioTexto = el('filtro-inicio').value;
            const fimTexto = el('filtro-fim').value;
            const data = el('filtro-data').value;
            const inicio = minutos(inicioTexto);
            const fim = fimTexto ? minutos(fimTexto) : 1439;
            if (!passeio || inicio === null || fim === null || fim < inicio) {
                el('resultado-faixa').textContent = 'Informe o passeio e um intervalo válido no mesmo dia. A seleção anterior foi mantida.';
                return;
            }
            let marcadas = 0;
            let naoLidas = 0;
            const linhas = todos().map(input => ({ input, dados: dadosDaLinha(input.closest('tr')) }));
            if (!linhas.some(linha => linha.dados)) {
                el('resultado-faixa').textContent = 'Não foi possível reconhecer Data prevista e Produto neste relatório. A seleção anterior foi mantida.';
                return;
            }
            for (const { input, dados } of linhas) {
                if (!dados)
                    naoLidas++;
                const atende = Boolean(dados && normalizar(dados.passeio) === normalizar(passeio) &&
                    (!data || dados.data === data) && dados.minutos >= inicio && dados.minutos <= fim);
                input.checked = atende;
                if (atende)
                    marcadas++;
            }
            el('passeio').value = passeio;
            el('data_visita').value = data;
            el('horario').value = fimTexto ? `${inicioTexto} às ${fimTexto}` : `a partir das ${inicioTexto}`;
            el('resultado-faixa').textContent = `${marcadas} linhas marcadas. A seleção anterior foi substituída.${naoLidas ? ` ${naoLidas} linhas sem data/horário reconhecidos foram deixadas de fora.` : ''}`;
            contar();
        };
        async function preparar(lista) {
            if (ocupado)
                return;
            ocupado = true;
            const botao = el('preparar');
            botao.disabled = true;
            try {
                const emails = ICDEmailTemplate.destinatarios(lista);
                const config = await chrome.storage.local.get(['emailAssunto', 'emailCorpo']);
                if (!config.emailAssunto?.trim() || !config.emailCorpo?.trim())
                    throw new Error('Configure o assunto e a mensagem na aba E-mail do painel ICD Hub.');
                const valores = Object.fromEntries(Object.keys(ICDEmailTemplate.campos).map(chave => [chave, el(chave).value]));
                if (valores.data_visita)
                    valores.data_visita = valores.data_visita.split('-').reverse().join('/');
                const assunto = ICDEmailTemplate.preencher(config.emailAssunto, valores);
                const corpo = ICDEmailTemplate.preencher(config.emailCorpo, valores);
                if (!await ICDOperacao.confirmar({ titulo: 'Conferir aviso do relatório', descricao: `${emails.length} destinatários únicos em ${Math.ceil(emails.length / 100)} lote(s) de até 100. Revise o primeiro lote; o envio permanece manual.`,
                    campos: [['Destinatários do primeiro lote em CCO', emails.slice(0, 100).join('\n')], ['Assunto', assunto], ['Mensagem', corpo]], acao: 'Preparar e abrir webmail' }))
                    return;
                await loteAcao('iniciar', { emails, assunto, corpo });
                await abrirLote(false);
            }
            catch (erro) {
                el('status').textContent = erro.message;
            }
            finally {
                ocupado = false;
                botao.disabled = false;
                mostrarLotes();
            }
        }
        el('preparar').onclick = () => { preparar(selecionados().map(input => input.value)); };
        let lendo = false;
        let reler = false;
        async function injetar() {
            if (lendo) {
                reler = true;
                return;
            }
            lendo = true;
            const controles = ['selecionar', 'limpar', 'selecionar-faixa', 'isolar-passeio', 'preparar'];
            controles.forEach(id => { el(id).disabled = true; });
            if (!painel.isConnected)
                document.body.append(painel);
            painel.hidden = false;
            let processadas = 0;
            async function respirar() {
                el('contagem').textContent = 'Lendo relatório… ' + processadas + ' linhas processadas.';
                observar();
                await new Promise(resolve => setTimeout(resolve, 0));
                observador.disconnect();
            }
            observador.disconnect();
            try {
                colunasPorLinha = new WeakMap();
                const linhas = Array.from(document.querySelectorAll('table tr'));
                for (const linha of linhas) {
                    if (++processadas % 100 === 0)
                        await respirar();
                    if (!linha.isConnected)
                        continue;
                    if (linha.closest('#icd-relatorio-email'))
                        continue;
                    const celulas = Array.from(linha.cells).filter(c => c.dataset.icdControle !== 'true');
                    if (!celulas.some(c => c.tagName === 'TD'))
                        continue;
                    const emails = [...new Set(celulas.flatMap(c => c.textContent?.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || []).map(e => e.toLowerCase()))];
                    if (linha.dataset.icdEmail === 'true') {
                        const input = linha.querySelector('.check-email-icd');
                        if (input && emails.length === 1 && input.value === emails[0])
                            continue;
                        linha.querySelectorAll('[data-icd-controle="true"]').forEach(el => el.remove());
                        delete linha.dataset.icdEmail;
                    }
                    if (emails.length !== 1)
                        continue;
                    linha.dataset.icdEmail = 'true';
                    const td = document.createElement('td');
                    td.dataset.icdControle = 'true';
                    const input = document.createElement('input');
                    input.type = 'checkbox';
                    input.className = 'check-email-icd';
                    input.value = emails[0];
                    input.setAttribute('aria-label', `Selecionar ${emails[0]}`);
                    input.onchange = contar;
                    td.append(input);
                    linha.prepend(td);
                }
                inputs = Array.from(document.querySelectorAll('.check-email-icd'));
                textos = new WeakMap(inputs.map(input => [input, normalizar(input.closest('tr')?.textContent || input.value)]));
                painel.hidden = !todos().length && !campanha;
                if (!painel.isConnected && todos().length)
                    document.body.append(painel);
                contar();
                const titulos = new Set();
                for (let i = 0; i < inputs.length; i++) {
                    if (i > 0 && i % 100 === 0)
                        await respirar();
                    const passeio = dadosDaLinha(inputs[i].closest('tr'))?.passeio;
                    if (passeio)
                        titulos.add(passeio);
                }
                const passeios = [...titulos].sort();
                const opcoes = el('filtro-passeio');
                const valorAnterior = opcoes.value;
                opcoes.replaceChildren(new Option('Selecione o título do grupo', ''), ...passeios.map(p => new Option(p, p)));
                opcoes.value = passeios.includes(valorAnterior) ? valorAnterior : '';
                contar();
            }
            finally {
                lendo = false;
                controles.forEach(id => { el(id).disabled = false; });
                mostrarLotes();
                observar();
                if (reler) {
                    reler = false;
                    void injetar();
                }
            }
        }
        chrome.storage.local.get(['nomeOperador']).then(res => { el('operador').value = res.nomeOperador || ''; });
        let agendado = false;
        const observador = new MutationObserver(registros => {
            // Janelas de revisão, painéis e alterações fora das tabelas não mudam o relatório.
            const mudouRelatorio = registros.some(registro => {
                const alvo = registro.target instanceof Element ? registro.target : registro.target.parentElement;
                if (alvo?.closest('table'))
                    return true;
                return [...Array.from(registro.addedNodes), ...Array.from(registro.removedNodes)].some(no => no instanceof Element && (no.matches('table') || Boolean(no.querySelector('table'))));
            });
            if (!mudouRelatorio || agendado)
                return;
            agendado = true;
            setTimeout(() => {
                agendado = false;
                observador.disconnect();
                try {
                    injetar();
                }
                finally {
                    observar();
                }
            }, 200);
        });
        function observar() { observador.observe(document.body, { childList: true, subtree: true }); }
        injetar();
        observar();
    }
    ICDRelatorioEmail.iniciar = iniciar;
})(ICDRelatorioEmail || (ICDRelatorioEmail = {}));
if (typeof document !== 'undefined') {
    if (typeof ICDFuncionalidades !== 'undefined')
        ICDFuncionalidades.quandoAtiva('relatorio', () => ICDRelatorioEmail.iniciar());
    else
        ICDRelatorioEmail.iniciar();
}
