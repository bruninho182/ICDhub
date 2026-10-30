namespace ICDFuncionalidades {
  export const catalogo = [
    { id: 'whatsapp', nome: 'Atalhos do WhatsApp', grupo: 'WhatsApp', descricao: 'Pastas, busca e botões de mensagens.', seletores: '#container-botoes-hub,#busca-botoes' },
    { id: 'calculadora', nome: 'Calculadora de cotações', grupo: 'WhatsApp', descricao: 'Botão da calculadora e janela de cotação no WhatsApp.', seletores: '#btn-cotacao-hub,#modal-cotacao-icd' },
    { id: 'plataformas', nome: 'Importação de reservas das plataformas', grupo: 'Reservas', descricao: 'Botões GetYourGuide, Grayline, Civitatis e Ticket Go e preparação OTA no ICD.', seletores: '#btn-copy-gyg,#btn-copy-tour,#civitatis-drop-zone,#btn-copy-ticketgo,#icd-preparar-ota' },
    { id: 'tarifario', nome: 'Importar tarifário', grupo: 'Reservas', descricao: 'Botão para capturar os valores dos ingressos no ICD.', seletores: '#icd-importar-tarifario,#icd-importar-previa' },
    { id: 'disponibilidade', nome: 'Importar disponibilidade', grupo: 'Reservas', descricao: 'Botão e prévia dos horários para copiar ao cliente.', seletores: '#icd-importar-disponibilidade,#icd-disponibilidade-previa' },
    { id: 'remarcacao', nome: 'Remarcações', grupo: 'Operação', descricao: 'Botões de copiar e colar dados de remarcação.', seletores: '#btn-remarcacao-icd,#btn-colar-rema-icd' },
    { id: 'pix', nome: 'Estornos PIX e planilha', grupo: 'Operação', descricao: 'Botões de coleta e conferência no ICD e Pagar.me.', seletores: '#icdhub-btn-coletar-icd,#icdhub-btn-coletar-pagarme' },
    { id: 'navio', nome: 'Reservas de navio', grupo: 'Operação', descricao: 'Botão de copiar dados da reserva de navio.', seletores: '#btn-copy-navio' },
    { id: 'relatorio', nome: 'E-mails por relatório', grupo: 'E-mail', descricao: 'Painel de seleção por passeio, horários e envio em lotes.', seletores: '#icd-relatorio-email' },
    { id: 'email', nome: 'Voucher e preenchimento de e-mail', grupo: 'E-mail', descricao: 'Botão de abrir o webmail e painel de revisão da mensagem.', seletores: '#btn-abrir-mail,#icd-revisar-email' },
  ] as const;
  export type Recurso = typeof catalogo[number]['id'];
  type Preferencias = Partial<Record<Recurso, boolean>>;
  declare const chrome: { storage: {
    local: { get(chaves: string[]): Promise<{ icdFuncionalidades?: Preferencias }>; set(dados: { icdFuncionalidades: Preferencias }): Promise<void> };
    onChanged: { addListener(fn: (changes: { icdFuncionalidades?: { newValue?: Preferencias } }, area: string) => void): void };
  } };
  let preferencias: Preferencias = {};
  let pronto = false;
  const entradas: { recurso: Recurso; iniciar: () => void; iniciou: boolean }[] = [];
  export function ativa(recurso: Recurso): boolean { return preferencias[recurso] !== false; }
  export function quandoAtiva(recurso: Recurso, iniciar: () => void): void {
    entradas.push({ recurso, iniciar, iniciou: false });
    if (pronto) aplicar();
  }
  function aplicar(): void {
    let estilo = document.getElementById('icd-funcionalidades-estilo');
    if (!estilo) { estilo = document.createElement('style'); estilo.id = 'icd-funcionalidades-estilo'; (document.head || document.documentElement).append(estilo); }
    estilo.textContent = catalogo.filter(item => !ativa(item.id)).map(item => `${item.seletores}{display:none!important}`).join('\n');
    for (const entrada of entradas) {
      if (ativa(entrada.recurso) && !entrada.iniciou) { entrada.iniciou = true; entrada.iniciar(); }
    }
    for (const input of document.querySelectorAll<HTMLInputElement>('[data-icd-recurso]')) {
      input.checked = ativa(input.dataset.icdRecurso as Recurso);
      const estado = input.closest('label')?.querySelector('[data-estado]');
      if (estado) estado.textContent = input.checked ? 'Ativada' : 'Desativada';
    }
  }
  export function iniciarPainel(): void {
    const container = document.getElementById('lista-funcionalidades');
    if (!container) return;
    let grupo = '';
    for (const item of catalogo) {
      if (grupo !== item.grupo) { grupo = item.grupo; const titulo = document.createElement('h3'); titulo.textContent = grupo; container.append(titulo); }
      const linha = document.createElement('label'); linha.className = 'icd-recurso';
      const texto = document.createElement('span'); const nome = document.createElement('strong'); nome.textContent = item.nome;
      const descricao = document.createElement('small'); descricao.textContent = item.descricao; texto.append(nome, descricao);
      const controle = document.createElement('span'); controle.className = 'icd-recurso-controle';
      const input = document.createElement('input'); input.type = 'checkbox'; input.setAttribute('role', 'switch'); input.setAttribute('aria-label', item.nome);
      input.dataset.icdRecurso = item.id; input.checked = ativa(item.id);
      const trilho = document.createElement('span'); trilho.className = 'icd-chave'; trilho.setAttribute('aria-hidden', 'true');
      const estado = document.createElement('small'); estado.dataset.estado = ''; estado.textContent = input.checked ? 'Ativada' : 'Desativada';
      controle.append(input, trilho, estado); linha.append(texto, controle); container.append(linha);
      input.onchange = () => {
        const valor = input.checked; input.disabled = true;
        fila = fila.then(async () => {
          const atual = await chrome.storage.local.get(['icdFuncionalidades']);
          const dados = { ...atual.icdFuncionalidades, [item.id]: valor };
          await chrome.storage.local.set({ icdFuncionalidades: dados });
          preferencias = dados; aplicar();
          document.getElementById('status-funcionalidades')!.textContent = 'Preferência salva neste navegador. Botões atualizados nas páginas abertas.';
        }).catch(() => {
          input.checked = ativa(item.id);
          document.getElementById('status-funcionalidades')!.textContent = 'Não foi possível salvar. Tente novamente.';
        }).finally(() => { input.disabled = false; });
      };
    }
    aplicar();
  }
  let fila = Promise.resolve();
  if (typeof document !== 'undefined' && typeof chrome !== 'undefined') {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes.icdFuncionalidades) { preferencias = changes.icdFuncionalidades.newValue || {}; if (pronto) aplicar(); }
    });
    chrome.storage.local.get(['icdFuncionalidades']).then(dados => { preferencias = dados.icdFuncionalidades || {}; })
      .catch(() => { preferencias = {}; })
      .finally(() => { pronto = true; aplicar(); });
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciarPainel);
    else iniciarPainel();
  }
}
