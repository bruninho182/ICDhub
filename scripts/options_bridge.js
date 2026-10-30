// A abertura de páginas da extensão precisa acontecer no contexto do background.
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.acao !== 'ABRIR_CONFIGURACOES') return;
  Promise.resolve().then(() => chrome.runtime.openOptionsPage())
    .then(() => sendResponse({ ok: true }))
    .catch(() => sendResponse({ ok: false, erro: 'Não foi possível abrir as configurações do ICD Hub.' }));
  return true;
});
