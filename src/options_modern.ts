/// <reference path="cotacao.ts" />
/// <reference path="email_template.ts" />
namespace ICDOptionsModern {
  declare const chrome: { storage: {
    local: { get(chaves: string[]): Promise<{ configMaster?: unknown[]; listaPasseios?: unknown[]; listaPastas?: unknown[] }> };
    onChanged: { addListener(fn: (changes: Record<string, unknown>, area: string) => void): void };
  } };
  declare function limparFormularioPasseio(): void;

  export function iniciar(): void {
    const resumo = document.getElementById('resumo-config');
    if (!resumo) return;
    async function atualizarResumo(): Promise<void> {
      try {
        const dados = await chrome.storage.local.get(['configMaster', 'listaPasseios', 'listaPastas']);
        resumo!.replaceChildren();
        for (const [valor, texto, destino] of [
          [dados.configMaster?.length || 0, 'Atalhos de atendimento', 'sec-atalhos'],
          [dados.listaPasseios?.length || 0, 'Passeios no tarifário', 'sec-cotacao'],
          [dados.listaPastas?.length || 0, 'Pastas de mensagens', 'sec-atalhos'],
        ] as const) {
          const botao = document.createElement('button'); botao.type = 'button';
          const numero = document.createElement('strong'); numero.textContent = String(valor);
          const legenda = document.createElement('span'); legenda.textContent = texto;
          botao.append(numero, legenda);
          botao.onclick = () => (document.querySelector(`[data-target="${destino}"]`) as HTMLButtonElement)?.click();
          resumo!.append(botao);
        }
      } catch { resumo!.textContent = 'Não foi possível carregar o resumo das configurações.'; }
    }
    atualizarResumo();
    const assuntoEmail = document.getElementById('emailAssuntoPadrao') as HTMLInputElement;
    const corpoEmail = document.getElementById('emailCorpoPadrao') as HTMLTextAreaElement;
    const previaEmail = document.getElementById('email-previa-modelo')!;
    let campoEmail: HTMLInputElement | HTMLTextAreaElement = corpoEmail;
    function previewEmail(): void {
      try {
        const exemplo = { operador: 'Operador', passeio: 'Passeio de exemplo', data_visita: '31/10/2026', horario: '09:00 às 11:00' };
        previaEmail.textContent = ICDEmailTemplate.preencher(assuntoEmail.value, exemplo) + '\n\n' + ICDEmailTemplate.preencher(corpoEmail.value, exemplo);
      } catch (erro) { previaEmail.textContent = (erro as Error).message; }
    }
    for (const campo of [assuntoEmail, corpoEmail]) {
      campo.addEventListener('focus', () => { campoEmail = campo; });
      campo.addEventListener('input', previewEmail);
    }
    document.querySelectorAll<HTMLButtonElement>('[data-email-campo]').forEach(botao => {
      botao.onclick = () => {
        campoEmail.setRangeText(`{{${botao.dataset.emailCampo}}}`, campoEmail.selectionStart || 0, campoEmail.selectionEnd || 0, 'end');
        campoEmail.focus(); previewEmail();
      };
    });
    chrome.storage.local.get(['emailAssunto', 'emailCorpo']).then(previewEmail);
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && (changes.configMaster || changes.listaPasseios || changes.listaPastas)) atualizarResumo();
    });
    function filtro(inputId: string, listaId: string, statusId: string): void {
      const input = document.getElementById(inputId) as HTMLInputElement;
      const lista = document.getElementById(listaId)!;
      const contagem = document.getElementById(statusId)!;
      function aplicar(): void {
        const termo = ICDCotacao.busca(input.value);
        const itens = Array.from(lista.querySelectorAll<HTMLElement>('[data-filtro]'));
        for (const item of itens) {
          item.hidden = !ICDCotacao.busca(item.dataset.filtro || '').includes(termo);
          if (item.classList.contains('item-lista')) item.draggable = !termo;
        }
        for (const header of lista.querySelectorAll<HTMLElement>('.pasta-header-painel')) {
          let proximo = header.nextElementSibling as HTMLElement | null;
          let possuiItens = false;
          while (proximo && !proximo.classList.contains('pasta-header-painel')) {
            if (!proximo.hidden) possuiItens = true;
            proximo = proximo.nextElementSibling as HTMLElement | null;
          }
          header.hidden = !possuiItens;
        }
        const visiveis = itens.filter(item => !item.hidden).length;
        contagem.textContent = itens.length ? `${visiveis} de ${itens.length} exibidos${termo ? ' · limpe a busca para ver todos' : ''}` : 'Nenhum item cadastrado.';
      }
      input.oninput = aplicar;
      new MutationObserver(aplicar).observe(lista, { childList: true, subtree: true });
      aplicar();
    }
    filtro('buscar-atalhos-config', 'listaBotoes', 'contagem-atalhos');
    filtro('buscar-passeios-config', 'lista-passeios-config', 'contagem-passeios');
    const texto = document.getElementById('novoTextoBotao') as HTMLTextAreaElement;
    const preview = document.getElementById('previa-atalho')!;
    function atualizarPrevia(): void {
      const idioma = (document.getElementById('idioma-previa-atalho') as HTMLSelectElement).value;
      const campo = idioma === 'es' ? 'novoTextoEspanhol' : idioma === 'en' ? 'novoTextoIngles' : 'novoTextoBotao';
      for (const [codigo, id] of [['pt', 'novoTextoBotao'], ['es', 'novoTextoEspanhol'], ['en', 'novoTextoIngles']]) {
        document.getElementById(id)!.hidden = codigo !== idioma;
        document.getElementById(`rotulo-texto-${codigo}`)!.hidden = codigo !== idioma;
      }
      preview.textContent = (document.getElementById(campo) as HTMLTextAreaElement).value || (idioma === 'pt' ? 'Sua mensagem aparecerá aqui enquanto você digita.' : 'Versão ainda não cadastrada neste idioma.');
    }
    texto.addEventListener('input', atualizarPrevia);
    for (const id of ['novoTextoEspanhol', 'novoTextoIngles', 'idioma-previa-atalho']) document.getElementById(id)!.addEventListener(id.startsWith('idioma') ? 'change' : 'input', atualizarPrevia);
    document.getElementById('listaBotoes')!.addEventListener('click', () => queueMicrotask(atualizarPrevia));
    document.getElementById('btnCancelarEdicao')!.addEventListener('click', atualizarPrevia);
    document.getElementById('btnAdicionarBotao')!.addEventListener('click', atualizarPrevia);
    document.getElementById('btn-cancelar-passeio')!.addEventListener('click', limparFormularioPasseio);

    const tabs = Array.from(document.querySelectorAll<HTMLButtonElement>('.tab-btn'));
    document.querySelector('.menu-tabs')!.setAttribute('role', 'tablist');
    function aria(): void {
      for (const tab of tabs) {
        const ativa = tab.classList.contains('active');
        tab.setAttribute('role', 'tab'); tab.setAttribute('aria-selected', String(ativa));
        tab.setAttribute('aria-controls', tab.dataset.target!); tab.tabIndex = ativa ? 0 : -1;
        tab.id = `tab-${tab.dataset.target}`;
        const secao = document.getElementById(tab.dataset.target!)!;
        secao.setAttribute('role', 'tabpanel'); secao.setAttribute('aria-labelledby', tab.id);
      }
    }
    for (const [i, tab] of tabs.entries()) {
      tab.addEventListener('click', () => { aria(); history.replaceState(null, '', `#${tab.dataset.target}`); });
      tab.addEventListener('keydown', e => {
        const proximo = e.key === 'ArrowRight' ? (i + 1) % tabs.length : e.key === 'ArrowLeft' ? (i + tabs.length - 1) % tabs.length
          : e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : -1;
        if (proximo >= 0) { e.preventDefault(); tabs[proximo].click(); tabs[proximo].focus(); }
      });
    }
    const selecionada = tabs.find(tab => `#${tab.dataset.target}` === location.hash);
    if (selecionada) selecionada.click();
    aria();
    // Associar rótulos legados aos campos para navegação e leitores de tela.
    document.querySelectorAll<HTMLLabelElement>('label:not([for])').forEach(label => {
      const input = label.nextElementSibling;
      if (input?.id && /^(INPUT|TEXTAREA|SELECT)$/.test(input.tagName)) label.htmlFor = input.id;
    });
  }
  if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', iniciar);
}
