// scripts/metrics.js
// Central de métricas - AGORA USA O BACKGROUND PARA ENVIAR

const METRICS = (() => {
  const STORAGE_KEY = 'metricsQueue';
  const BATCH_SIZE = 5;
  const INTERVAL_MS = 15000;

  async function getOperador() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['nomeOperador'], (res) => {
        resolve(res.nomeOperador || 'ANÔNIMO');
      });
    });
  }

  async function registrar(tipo, detalhes = {}) {
    const operador = await getOperador();
    const evento = {
      operador,
      tipo,
      timestamp: new Date().toISOString(),
      detalhes
    };

    const queue = await getQueue();
    queue.push(evento);
    await saveQueue(queue);

    // ===== NOTIFICA O BACKGROUND SOBRE O OPERADOR =====
    // Isso é usado pelo monitor de inatividade
    chrome.runtime.sendMessage({ 
      acao: 'METRICA_REGISTRADA', 
      operador: operador 
    }).catch(() => {
      // Ignora erros (o background pode não estar pronto)
    });

    if (queue.length >= BATCH_SIZE) {
      // Envia via background (não sofre CSP)
      chrome.runtime.sendMessage({ 
        acao: 'ENVIAR_METRICAS', 
        queue: queue 
      }, async (response) => {
        if (response?.status === 'ok') {
          await saveQueue([]);
          console.log(`✅ ${queue.length} eventos enviados.`);
        } else if (response?.status === 'erro') {
          console.warn(`⚠️ Falha ao enviar eventos: ${response.detalhe}`);
        }
      });
    }
  }

  function getQueue() {
    return new Promise((resolve) => {
      chrome.storage.local.get([STORAGE_KEY], (res) => {
        resolve(res[STORAGE_KEY] || []);
      });
    });
  }

  function saveQueue(queue) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [STORAGE_KEY]: queue }, resolve);
    });
  }

  async function enviarTodos() {
    const queue = await getQueue();
    if (queue.length === 0) return;

    chrome.runtime.sendMessage({ 
      acao: 'ENVIAR_METRICAS', 
      queue: queue 
    }, async (response) => {
      if (response?.status === 'ok') {
        await saveQueue([]);
        console.log(`✅ ${queue.length} eventos enviados.`);
      } else if (response?.status === 'erro') {
        console.warn(`⚠️ Falha ao enviar eventos: ${response.detalhe}`);
      }
    });
  }

  function iniciar() {
    console.log("📊 Sistema de métricas inicializado!");
    enviarTodos();
    setInterval(enviarTodos, INTERVAL_MS);
  }

  // ===== API PÚBLICA =====
  return { 
    registrar, 
    enviarTodos, 
    iniciar 
  };
})();

// ===== INICIALIZAÇÃO AUTOMÁTICA =====
METRICS.iniciar();

// ===== EXPORTA PARA USO EM OUTROS SCRIPTS =====
window.METRICS = METRICS;

console.log("✅ METRICS carregado e pronto para uso!");