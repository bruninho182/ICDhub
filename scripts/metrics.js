// API preservada para WhatsApp, e-mail e vouchers. A persistência pertence ao background.
const METRICS = (() => {
  async function registrar(tipo, detalhes = {}) {
    try {
      const { nomeOperador } = await chrome.storage.local.get(['nomeOperador']);
      const resposta = await chrome.runtime.sendMessage({
        acao: 'REGISTRAR_METRICA',
        evento: {
          operador: nomeOperador || 'ANÔNIMO',
          tipo,
          timestamp: new Date().toISOString(),
          detalhes,
        },
      });
      if (resposta?.status !== 'ok') throw new Error(resposta?.detalhe || 'Background indisponível');
      return true;
    } catch (erro) {
      console.warn('[ICD Hub] Não foi possível registrar a métrica:', erro.message);
      return false;
    }
  }

  async function enviarTodos() {
    try {
      return await chrome.runtime.sendMessage({ acao: 'ENVIAR_METRICAS' });
    } catch (erro) {
      console.warn('[ICD Hub] Envio de métricas indisponível:', erro.message);
      return { status: 'erro' };
    }
  }

  function iniciar() { return enviarTodos(); }
  return { registrar, enviarTodos, iniciar };
})();
window.METRICS = METRICS;
METRICS.iniciar();
