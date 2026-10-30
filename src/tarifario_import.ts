/// <reference path="cotacao.ts" />
/// <reference path="reserva_date.ts" />
namespace ICDTarifarioImport {
  declare const chrome: { storage: { local: {
    get(chaves: string[]): Promise<{ listaPasseios?: ICDCotacao.Passeio[] }>;
    set(dados: { listaPasseios: ICDCotacao.Passeio[] }): Promise<void>;
  } } };
  export interface Captura { passeios: ICDCotacao.Passeio[]; assinatura: string }
  const texto = (el: Element | null | undefined): string => (el?.textContent || '').replace(/\s+/g, ' ').trim();
  function campo(pagina: Document, rotulo: string): string {
    const label = Array.from(pagina.querySelectorAll('label')).find(el => ICDCotacao.busca(texto(el)) === ICDCotacao.busca(rotulo));
    const id = label?.getAttribute('for');
    const input = id ? pagina.getElementById(id) : label?.closest('.MuiFormControl-root')?.querySelector('input');
    if (!(input instanceof HTMLInputElement)) return '';
    if (input.type === 'hidden') return texto(input.closest('.MuiFormControl-root')?.querySelector('[role="button"], .MuiSelect-select'));
    return input.value.trim();
  }
  export function preco(texto: string): number {
    const valor = texto.replace(/\s|\u00a0/g, '');
    if (!/^R\$(?:\d{1,3}(?:\.\d{3})+|\d+),\d{2}$/.test(valor)) throw new Error('Preço não reconhecido: ' + texto);
    return ICDCotacao.centavos(valor.slice(2).replace(/\./g, '')) / 100;
  }
  function tabelas(pagina: Document): HTMLTableElement[] {
    return Array.from(pagina.querySelectorAll<HTMLTableElement>('table')).filter(tabela => {
      const headers = Array.from(tabela.querySelectorAll('thead th')).map(el => ICDCotacao.busca(texto(el)));
      return ['produto', 'tipo de produto', 'preco unitario'].every(nome => headers.includes(nome));
    });
  }
  export function contextoDaPagina(pagina: Document): ICDCotacao.ContextoTarifario {
    const canal = campo(pagina, 'Canal de venda');
    const fornecedor = campo(pagina, 'Selecione o fornecedor');
    if (!canal || !fornecedor) throw new Error('Selecione canal e fornecedor antes de importar.');
    const titulo = Array.from(pagina.querySelectorAll('h6')).find(el => /data da visita/i.test(texto(el)));
    const calendario = titulo?.closest('.MuiGrid-item');
    const selecionados = calendario?.querySelectorAll('.MuiPickersDay-daySelected:not(.MuiPickersDay-hidden)');
    const mes = ICDReservaDate.mesCalendario(texto(calendario?.querySelector('.MuiPickersCalendarHeader-switchHeader p')));
    const dia = selecionados?.length === 1 ? Number(texto(selecionados[0])) : 0;
    const dataVisita = mes === null ? '' : ICDReservaDate.iso(Math.floor(mes / 12), mes % 12 + 1, dia);
    if (!dataVisita) throw new Error('Selecione a data da visita e aguarde o calendário carregar.');
    const contexto: ICDCotacao.ContextoTarifario = { origem: 'ICD', canal, fornecedor, dataVisita,
      distribuidora: campo(pagina, 'Unidade Distribuidora'), modalidade: campo(pagina, 'Selecione o passeio'),
      horario: campo(pagina, 'Hora da visita'), consultadoEm: new Date().toISOString() };
    return contexto;
  }
  export function capturar(pagina: Document): Captura {
    const lista = tabelas(pagina);
    if (lista.length !== 1) throw new Error('Abra um passeio com uma única tabela de produtos carregada.');
    const contexto = contextoDaPagina(pagina);
    const { canal, fornecedor, dataVisita } = contexto;
    const tabela = lista[0];
    const headers = Array.from(tabela.querySelectorAll('thead th')).map(el => ICDCotacao.busca(texto(el)));
    const grupos = new Map<string, ICDCotacao.Ingresso[]>();
    for (const linha of tabela.querySelectorAll<HTMLTableRowElement>('tbody tr')) {
      const celulas = linha.cells;
      const nome = texto(celulas[headers.indexOf('produto')]);
      const tipo = texto(celulas[headers.indexOf('tipo de produto')]);
      const valor = preco(texto(celulas[headers.indexOf('preco unitario')]));
      if (!nome || !tipo) throw new Error('Produto ou categoria incompleta. Aguarde o carregamento.');
      const ingressos = grupos.get(nome) || []; ingressos.push({ tipo, valor }); grupos.set(nome, ingressos);
    }
    if (!grupos.size) throw new Error('Não há preços carregados para importar.');
    const passeios = Array.from(grupos, ([produto, ingressos]) => {
      const chave = JSON.stringify([produto, canal, contexto.distribuidora, fornecedor, contexto.modalidade, dataVisita, contexto.horario]);
      const nome = [produto, contexto.modalidade, dataVisita.split('-').reverse().join('/'), contexto.horario].filter(Boolean).join(' · ');
      return { ...ICDCotacao.validarPasseio(nome, ingressos), contexto: { ...contexto }, importacaoChave: chave };
    });
    // Ignora somente o instante da leitura na comparação antes da gravação.
    const assinatura = JSON.stringify(passeios.map(p => ({ ...p, contexto: { ...p.contexto, consultadoEm: '' } })));
    return { passeios, assinatura };
  }
  export async function salvar(captura: Captura, pagina: Document): Promise<void> {
    if (capturar(pagina).assinatura !== captura.assinatura)
      throw new Error('A seleção ou os preços mudaram. Feche a prévia e importe novamente.');
    const { listaPasseios = [] } = await chrome.storage.local.get(['listaPasseios']);
    const lista = [...listaPasseios];
    for (const passeio of captura.passeios) {
      const indices = lista.map((item, i) => item.importacaoChave === passeio.importacaoChave ? i : -1).filter(i => i >= 0);
      if (indices.length > 1) throw new Error('Há tarifários duplicados para este contexto. Revise no painel antes de importar.');
      if (indices.length) lista[indices[0]] = passeio; else lista.push(passeio);
    }
    // Revalidar depois da leitura assíncrona: não salvar uma seleção que mudou enquanto aguardava.
    if (capturar(pagina).assinatura !== captura.assinatura) throw new Error('A seleção mudou. Importe novamente.');
    await chrome.storage.local.set({ listaPasseios: lista });
  }
  export function revisar(captura: Captura): void {
    if (document.getElementById('icd-importar-previa')) return;
    const host = document.createElement('div'); host.id = 'icd-importar-previa';
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = `<style>
      *{box-sizing:border-box}dialog{font:14px/1.5 system-ui;color:#172033;background:#fff;width:min(640px,95vw);max-height:85vh;overflow:auto;border:0;border-radius:16px;padding:26px;box-shadow:0 20px 80px #0006}dialog::backdrop{background:#13203899}
      h2{font-size:22px;margin:0 0 12px}h3{font-size:16px}p{white-space:pre-line;color:#526077}table{width:100%;border-collapse:collapse}td,th{text-align:left;padding:10px 4px;border-bottom:1px solid #e2e8f0}td:last-child,th:last-child{text-align:right}
      .acoes{display:flex;justify-content:flex-end;gap:10px;margin-top:20px}button{font:600 14px system-ui;padding:11px 16px;border:1px solid #b5c2d4;border-radius:8px;cursor:pointer;background:white}#salvar{background:#6036b5;color:white;border-color:#6036b5}#status{color:#9c2639}button:focus-visible{outline:3px solid #a78bfa;outline-offset:2px}
    </style><dialog aria-labelledby="titulo"><h2 id="titulo">Importar tarifário do ICD</h2><p id="contexto"></p><div id="produtos"></div>
    <p>A importação salva os preços exibidos para esta consulta. Não define validade para outras datas. Um tarifário importado com o mesmo contexto será atualizado; cadastros manuais serão preservados.</p>
    <p id="status" role="status"></p><div class="acoes"><button id="cancelar">Cancelar</button><button id="salvar">Salvar / atualizar tarifário</button></div></dialog>`;
    root.getElementById('contexto')!.remove();
    for (const passeio of captura.passeios) {
      const titulo = document.createElement('h3'); titulo.textContent = ICDCotacao.nomeExibicao(passeio);
      const tabela = document.createElement('table'); tabela.innerHTML = '<thead><tr><th>Categoria</th><th>Preço unitário</th></tr></thead><tbody></tbody>';
      for (const ingresso of passeio.ingressos) {
        const linha = document.createElement('tr');
        for (const valor of [ingresso.tipo, ICDCotacao.moeda(ICDCotacao.centavos(ingresso.valor))]) {
          const celula = document.createElement('td'); celula.textContent = valor; linha.append(celula);
        }
        tabela.querySelector('tbody')!.append(linha);
      }
      root.getElementById('produtos')!.append(titulo, tabela);
    }
    const dialog = root.querySelector('dialog')!;
    let ocupado = false;
    function fechar(): void { if (!ocupado) { dialog.close(); host.remove(); } }
    root.getElementById('cancelar')!.onclick = fechar;
    dialog.oncancel = e => { e.preventDefault(); fechar(); };
    root.getElementById('salvar')!.onclick = async () => {
      if (ocupado) return;
      ocupado = true;
      const botao = root.getElementById('salvar') as HTMLButtonElement; botao.disabled = true;
      try {
        await salvar(captura, document);
        root.getElementById('status')!.textContent = 'Tarifário salvo. Já está disponível na calculadora do WhatsApp.';
        root.getElementById('cancelar')!.textContent = 'Fechar';
      } catch (erro) { root.getElementById('status')!.textContent = (erro as Error).message; botao.disabled = false; }
      finally { ocupado = false; }
    };
    document.body.append(host); dialog.showModal();
  }
  export function iniciar(): void {
    if (window.top !== window.self) return;
    function injetar(): void {
      const existe = document.getElementById('icd-importar-tarifario');
      if (location.pathname.replace(/\/$/, '') !== '/apps/sales/bookings/new' || !tabelas(document).length) { existe?.remove(); return; }
      if (existe) return;
      const botao = document.createElement('button'); botao.id = 'icd-importar-tarifario'; botao.type = 'button'; botao.textContent = 'IMPORTAR TARIFÁRIO';
      botao.style.cssText = 'position:fixed;left:24px;bottom:24px;z-index:10001;background:#14745c;color:white;border:1px solid #8fd7bb;border-radius:8px;padding:12px 18px;font:600 14px system-ui;cursor:pointer;box-shadow:0 4px 16px #0004';
      botao.onclick = () => { try { revisar(capturar(document)); } catch (erro) { alert((erro as Error).message); } };
      document.body.append(botao);
    }
    let agendado = false;
    new MutationObserver(() => { if (agendado) return; agendado = true; setTimeout(() => { agendado = false; injetar(); }, 250); })
      .observe(document.body, { childList: true, subtree: true });
    injetar();
  }
}
if (typeof document !== 'undefined') {
  if (typeof ICDFuncionalidades !== 'undefined') ICDFuncionalidades.quandoAtiva('tarifario', () => ICDTarifarioImport.iniciar());
  else ICDTarifarioImport.iniciar();
}
