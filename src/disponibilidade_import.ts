/// <reference path="tarifario_import.ts" />
namespace ICDDisponibilidadeImport {
  export interface Consulta {
    chave: string; contexto: ICDCotacao.ContextoTarifario;
    opcoes: { texto: string; desabilitada: boolean }[];
  }
  declare const chrome: { storage: { local: {
    get(chaves: string[]): Promise<{ disponibilidadesICD?: Consulta[] }>;
    set(dados: { disponibilidadesICD: Consulta[] }): Promise<void>;
  } } };
  const pausa = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));
  const chaveContexto = (c: ICDCotacao.ContextoTarifario): string => JSON.stringify([c.canal, c.distribuidora, c.fornecedor, c.modalidade, c.dataVisita]);

  export async function capturar(pagina: Document): Promise<Consulta> {
    const contexto = ICDTarifarioImport.contextoDaPagina(pagina);
    const label = Array.from(pagina.querySelectorAll('label')).find(el => ICDCotacao.busca(el.textContent || '') === 'hora da visita');
    const id = label?.getAttribute('for');
    const controle = id ? pagina.getElementById(id) : null;
    const bloco = label?.closest('.MuiFormControl-root');
    const nativo = controle instanceof HTMLSelectElement ? controle : bloco?.querySelector('select');
    let opcoes: Consulta['opcoes'] = [];
    if (nativo) {
      opcoes = Array.from(nativo.options).filter(el => el.value !== '').map(el => ({ texto: el.textContent?.trim() || '', desabilitada: el.disabled }));
    } else {
      const trigger = bloco?.querySelector<HTMLElement>('[role="combobox"], [role="button"], .MuiSelect-select') ||
        controle?.closest<HTMLElement>('[role="combobox"]') || controle;
      if (!trigger) throw new Error('Campo Hora da visita não encontrado.');
      const jaAberto = trigger.getAttribute('aria-expanded') === 'true';
      let menu: Element | null = null;
      try {
        trigger.focus();
        if (!jaAberto) {
          trigger.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }));
          trigger.click();
          trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', code: 'ArrowDown', bubbles: true }));
        }
        for (let tentativa = 0; tentativa < 40; tentativa++) {
          const listaId = trigger.getAttribute('aria-controls') || trigger.getAttribute('aria-owns') || controle?.getAttribute('aria-controls');
          const especifico = listaId ? pagina.getElementById(listaId) : null;
          const menus = especifico ? [especifico] : Array.from(pagina.querySelectorAll('[role="listbox"]')).filter(el => !el.hasAttribute('hidden') && el.getAttribute('aria-hidden') !== 'true');
          menu = menus.length === 1 ? menus[0] : null;
          const elementos = menu ? Array.from(menu.querySelectorAll<HTMLElement>('[role="option"]')) : [];
          if (elementos.length) {
            if (elementos.some(el => Number(el.getAttribute('aria-setsize')) > elementos.length))
              throw new Error('A lista carrega opções por partes. Precisamos ajustar a leitura deste menu antes de importar tudo.');
            opcoes = elementos.map(el => ({ texto: (el.textContent || '').replace(/\s+/g, ' ').trim(),
              desabilitada: el.getAttribute('aria-disabled') === 'true' || el.classList.contains('Mui-disabled') }));
            break;
          }
          await pausa(100);
        }
      } finally {
        if (!jaAberto) {
          (menu || trigger).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }));
          trigger.blur();
        }
      }
    }
    opcoes = opcoes.filter(el => el.texto);
    if (!opcoes.length) throw new Error('Não foram encontradas opções de horário. Aguarde o carregamento e tente novamente.');
    if (chaveContexto(ICDTarifarioImport.contextoDaPagina(pagina)) !== chaveContexto(contexto))
      throw new Error('A seleção mudou durante a leitura. Importe novamente.');
    return { chave: chaveContexto(contexto), contexto, opcoes };
  }
  export async function salvar(consulta: Consulta): Promise<void> {
    if (chaveContexto(ICDTarifarioImport.contextoDaPagina(document)) !== consulta.chave)
      throw new Error('A seleção mudou. Feche a prévia e importe novamente.');
    const { disponibilidadesICD = [] } = await chrome.storage.local.get(['disponibilidadesICD']);
    if (chaveContexto(ICDTarifarioImport.contextoDaPagina(document)) !== consulta.chave)
      throw new Error('A seleção mudou. Importe novamente.');
    await chrome.storage.local.set({ disponibilidadesICD: [...disponibilidadesICD.filter(item => item.chave !== consulta.chave), consulta] });
  }
  export function mensagem(consulta: Consulta): string {
    const c = consulta.contexto;
    return `*HORÁRIOS E DISPONIBILIDADE*\n\n*${c.fornecedor}${c.modalidade ? ' · ' + c.modalidade : ''}*\nData da visita: ${c.dataVisita.split('-').reverse().join('/')}\n\n` +
      consulta.opcoes.map(opcao => `▪ ${opcao.texto}${opcao.desabilitada ? ' — indisponível' : ''}`).join('\n') +
      `\n\nConsultado em ${new Date(c.consultadoEm).toLocaleString('pt-BR')}.\nDisponibilidade sujeita a alteração até a confirmação da reserva.`;
  }
  export function revisar(consulta: Consulta): void {
    const host = document.createElement('div'); host.id = 'icd-disponibilidade-previa';
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = `<style>
      dialog{font:14px/1.6 system-ui;color:#172033;background:white;width:min(560px,90vw);max-height:80vh;overflow:auto;border:0;border-radius:14px;padding:24px}dialog::backdrop{background:#13203899}h2{font-size:21px}li{padding:8px;border-bottom:1px solid #d9e0eb}p{white-space:pre-line}button{font:600 14px system-ui;padding:10px 14px;border:1px solid #bbc6d7;border-radius:7px;cursor:pointer;margin-right:8px;background:white}#salvar{background:#14745c;color:white}#status{color:#9c2639}
      textarea{display:block;box-sizing:border-box;width:100%;height:190px;resize:vertical;padding:12px;border:1px solid #b5c2d4;border-radius:8px;font:14px/1.6 system-ui;color:#172033;background:#f5f7fb}#copiar{background:#14745c;color:white}
    </style><dialog aria-labelledby="titulo"><h2 id="titulo">Disponibilidade para o cliente</h2><p id="contexto"></p><ul></ul><label for="mensagem">Mensagem pronta para WhatsApp</label><textarea id="mensagem" readonly></textarea><p>Copie a mensagem, revise e envie ao cliente na conversa.</p><p id="status" role="status"></p><button id="cancelar">Fechar</button><button id="copiar">Copiar disponibilidade</button></dialog>`;
    const c = consulta.contexto;
    root.getElementById('contexto')!.textContent = `${c.fornecedor}${c.modalidade ? ' · ' + c.modalidade : ''}\nVisita: ${c.dataVisita.split('-').reverse().join('/')}\nCanal: ${c.canal} · ${c.distribuidora || 'Sem distribuidora'}`;
    for (const opcao of consulta.opcoes) {
      const li = document.createElement('li'); li.textContent = opcao.texto + (opcao.desabilitada ? ' · opção desabilitada no sistema' : ''); root.querySelector('ul')!.append(li);
    }
    const previa = root.getElementById('mensagem') as HTMLTextAreaElement;
    previa.value = mensagem(consulta);
    let ocupado = false;
    const dialog = root.querySelector('dialog')!;
    const fechar = (): void => { if (!ocupado) { dialog.close(); host.remove(); } };
    root.getElementById('cancelar')!.onclick = fechar;
    dialog.oncancel = e => { e.preventDefault(); fechar(); };
    root.getElementById('copiar')!.onclick = async () => {
      if (ocupado) return;
      ocupado = true;
      const btn = root.getElementById('copiar') as HTMLButtonElement; btn.disabled = true;
      try { await navigator.clipboard.writeText(previa.value); root.getElementById('status')!.textContent = 'Disponibilidade copiada. Cole na conversa do cliente.'; }
      catch { root.getElementById('status')!.textContent = 'Não foi possível copiar automaticamente. O texto está selecionado para copiar manualmente.'; previa.focus(); previa.select(); }
      finally { ocupado = false; btn.disabled = false; }
    };
    document.body.append(host); dialog.showModal();
  }
  export function iniciar(): void {
    if (window.top !== window.self) return;
    let ocupado = false;
    function injetar(): void {
      const existente = document.getElementById('icd-importar-disponibilidade');
      const ativo = location.pathname.replace(/\/$/, '') === '/apps/sales/bookings/new' && document.getElementById('icd-importar-tarifario');
      if (!ativo) { existente?.remove(); return; }
      if (existente) return;
      const botao = document.createElement('button'); botao.id = 'icd-importar-disponibilidade'; botao.type = 'button'; botao.textContent = 'IMPORTAR DISPONIBILIDADE';
      botao.style.cssText = 'position:fixed;left:24px;bottom:80px;z-index:10001;background:#325fa6;color:white;border:1px solid #a5c6fa;border-radius:8px;padding:12px 18px;font:600 14px system-ui;cursor:pointer;box-shadow:0 4px 16px #0004';
      botao.onclick = async () => {
        if (ocupado || document.getElementById('icd-disponibilidade-previa')) return;
        ocupado = true; botao.disabled = true;
        try { revisar(await capturar(document)); } catch (erro) { alert((erro as Error).message); }
        finally { ocupado = false; botao.disabled = false; }
      };
      document.body.append(botao);
    }
    let agendado = false;
    new MutationObserver(() => { if (agendado) return; agendado = true; setTimeout(() => { agendado = false; injetar(); }, 250); })
      .observe(document.body, { childList: true, subtree: true });
    injetar();
  }
}
if (typeof document !== 'undefined') {
  if (typeof ICDFuncionalidades !== 'undefined') ICDFuncionalidades.quandoAtiva('disponibilidade', () => ICDDisponibilidadeImport.iniciar());
  else ICDDisponibilidadeImport.iniciar();
}
