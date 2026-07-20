// ================================================================
// ===== 1. COMUNICAÇÃO DE DADOS (HUB -> SISTEMAS) =====
// ================================================================

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.acao === "DADOS_PRONTOS") {
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach((tab) => {
        if (tab.url && (tab.url.includes("ingressocomdesconto.com.br") || tab.url.includes("app.icdgrupo.com.br"))) {
          chrome.tabs.sendMessage(tab.id, request).catch(() => {
            // Ignora abas que ainda não carregaram o script
          });
        }
      });
    });
    console.log("📢 Hub: Dados replicados para os sistemas de vendas.");
    sendResponse({ status: "OK" });
  }
  return true;
});

// ================================================================
// ===== 2. GERENCIADOR DE DOWNLOADS (RENOMEADOR DE VOUCHERS) =====
// ================================================================

chrome.downloads.onDeterminingFilename.addListener((downloadItem, suggest) => {
  const isPDF = downloadItem.filename.endsWith(".pdf") || downloadItem.mime?.includes("pdf");
  if (!isPDF) {
    suggest();
    return true;
  }

  function limparNomeArquivo(nome) {
    if (!nome) return null;
    let limpo = nome.replace(/^voucher-/, '');
    if (!limpo.toLowerCase().endsWith('.pdf')) {
      limpo += '.pdf';
    }
    return limpo;
  }

  chrome.storage.local.get("nomeVoucherAtual", (res) => {
    if (res.nomeVoucherAtual) {
      const nomeLimpo = limparNomeArquivo(res.nomeVoucherAtual);
      if (nomeLimpo) {
        console.log(`📥 Renomeando download para: ${nomeLimpo} (via storage)`);
        suggest({ filename: nomeLimpo, conflictAction: "uniquify" });
        chrome.storage.local.remove("nomeVoucherAtual");
        return;
      }
    }

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]?.id) {
        console.warn("⚠️ Nenhuma aba ativa encontrada, mantendo nome original.");
        suggest();
        return;
      }

      chrome.tabs.sendMessage(
        tabs[0].id,
        { type: "GET_NOME_VOUCHER" },
        (response) => {
          if (chrome.runtime.lastError || !response?.filename) {
            console.warn("⚠️ Falha ao obter nome da aba, mantendo nome original.");
            suggest();
            return;
          }
          const nomeLimpo = limparNomeArquivo(response.filename);
          if (nomeLimpo) {
            console.log(`📥 Renomeando download para: ${nomeLimpo} (via mensagem)`);
            suggest({ filename: nomeLimpo, conflictAction: "uniquify" });
          } else {
            suggest();
          }
        }
      );
    });
  });

  return true;
});

// ================================================================
// ===== 3. ALERTAS DE BEM-ESTAR E PRODUTIVIDADE =====
// ================================================================

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create("wellnessAlarm", { periodInMinutes: 150 });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "wellnessAlarm") {
    const lembretes = [
      "💧 Hora de hidratar! Beba um copo d'água.",
      "🧘 O corpo agradece! Vamos fazer um alongamento rápido?",
      "☕ Pausa merecida! Que tal um cafezinho agora?",
      "👀 Regra 20-20-20: Olhe para um ponto distante por 20 segundos para descansar a vista.",
      "💨 Não esqueça de bater seu ponto quando for sair!",
      "😃 Mantenha seu relatório em dia! Evite stress no futuro.",
      "🐾 Alimente seu PET, faça uma pausa.",
      "🙏🏻 Deus é bom! Tire alguns segundos para agradecer."
    ];

    const lembreteAtual = lembretes[Math.floor(Math.random() * lembretes.length)];

    chrome.notifications.create({
      type: "basic",
      iconUrl: "icon.png",
      title: "Pausa para Bem-Estar 🌟",
      message: lembreteAtual,
      priority: 1
    });
  }
});

// ================================================================
// ===== 4. SUPABASE - ENVIO DE MÉTRICAS =====
// ================================================================

const SUPABASE_URL = 'https://yqlvdvilddobvangvvva.supabase.co/rest/v1/metricas';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxbHZkdmlsZGRvYnZhbmd2dnZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ1MTMzMzgsImV4cCI6MjEwMDA4OTMzOH0.xMflSQjCBDmSWibfkx2GDuEuWU-qPhxuH0NnHKAIt5I';

// ===== NOVO: FUNÇÃO PARA GERAR ID ÚNICO =====
function gerarIdUnico(nome) {
    if (!nome) return null;
    return nome
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove acentos
        .replace(/[^a-z0-9]/g, '_') // Substitui caracteres especiais por _
        .replace(/_+/g, '_') // Remove underscores duplicados
        .replace(/^_|_$/g, ''); // Remove underscores no início/fim
}

// Escuta mensagens dos content scripts para enviar métricas
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.acao === 'ENVIAR_METRICAS') {
    // ===== NOVO: GARANTE QUE CADA MÉTRICA TENHA OPERADOR_ID =====
    const metricasComId = request.queue.map(metrica => {
      if (!metrica.operador_id && metrica.operador) {
        metrica.operador_id = gerarIdUnico(metrica.operador);
      }
      return metrica;
    });
    
    fetch(SUPABASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      },
      body: JSON.stringify(metricasComId)
    })
    .then(async (response) => {
      if (response.ok) {
        sendResponse({ status: 'ok' });
        console.log(`✅ ${metricasComId.length} métricas enviadas com operador_id`);
      } else {
        const erro = await response.text();
        console.error('❌ Erro Supabase:', erro);
        sendResponse({ status: 'erro', detalhe: erro });
      }
    })
    .catch((error) => {
      console.error('❌ Erro fetch:', error);
      sendResponse({ status: 'erro', detalhe: error.message });
    });
    
    return true;
  }
});

// Envio periódico (fallback) - a cada 1 minuto
chrome.alarms.create('sendMetricsBackground', { periodInMinutes: 1 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'sendMetricsBackground') {
    chrome.storage.local.get(['metricsQueue'], async (res) => {
      const queue = res.metricsQueue || [];
      if (queue.length === 0) return;

      // ===== NOVO: GARANTE OPERADOR_ID NA FILA =====
      const queueComId = queue.map(metrica => {
        if (!metrica.operador_id && metrica.operador) {
          metrica.operador_id = gerarIdUnico(metrica.operador);
        }
        return metrica;
      });

      try {
        const response = await fetch(SUPABASE_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`
          },
          body: JSON.stringify(queueComId)
        });

        if (response.ok) {
          await chrome.storage.local.set({ metricsQueue: [] });
          console.log(`✅ ${queueComId.length} eventos enviados (background alarm).`);
        }
      } catch (error) {
        console.error('❌ Erro no envio automático:', error);
      }
    });
  }
});

// ================================================================
// ===== 5. MONITOR DE INATIVIDADE DOS OPERADORES =====
// ================================================================

const CONFIG_INATIVIDADE = {
  TEMPO_ALERTA: 30,    // Minutos sem atividade para alerta
  TEMPO_CRITICO: 60,   // Minutos sem atividade para alerta crítico
  INTERVALO: 5         // Minutos entre verificações
};

// ===== NOVO: REGISTRA OPERADOR COM ID =====
function registrarOperador(nome, id) {
  if (!nome || nome === 'ANÔNIMO') return;
  const operadorId = id || gerarIdUnico(nome);
  
  chrome.storage.local.get(['operadores_conhecidos', 'operadores_ids'], (res) => {
    let listaNomes = res.operadores_conhecidos || [];
    let listaIds = res.operadores_ids || {};
    
    if (!listaNomes.includes(nome)) {
      listaNomes.push(nome);
      chrome.storage.local.set({ operadores_conhecidos: listaNomes });
      console.log(`👤 Novo operador registrado: ${nome} (${operadorId})`);
    }
    
    // Atualiza o mapeamento nome -> id
    if (!listaIds[nome] || listaIds[nome] !== operadorId) {
      listaIds[nome] = operadorId;
      chrome.storage.local.set({ operadores_ids: listaIds });
    }
  });
}

// ===== NOVO: OBTÉM ID DE UM OPERADOR =====
function getOperadorId(nome) {
  return new Promise((resolve) => {
    chrome.storage.local.get(['operadores_ids'], (res) => {
      const ids = res.operadores_ids || {};
      resolve(ids[nome] || gerarIdUnico(nome));
    });
  });
}

// Registra operador quando uma métrica é recebida
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.acao === 'METRICA_REGISTRADA' && request.operador) {
    const id = request.operador_id || gerarIdUnico(request.operador);
    registrarOperador(request.operador, id);
  }
});

// ===== NOVO: BUSCA ÚLTIMAS ATIVIDADES COM OPERADOR_ID =====
async function buscarUltimasAtividades() {
  try {
    const response = await fetch(`${SUPABASE_URL}?select=operador,operador_id,timestamp&order=timestamp.desc&limit=500`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });
    
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const dados = await response.json();
    
    // Agrupa por operador_id (prioriza ID, fallback para nome)
    const ultimaAtividade = {};
    const ultimoNome = {};
    
    dados.forEach(d => {
      const id = d.operador_id || gerarIdUnico(d.operador);
      const nome = d.operador;
      
      if (!ultimaAtividade[id] || new Date(d.timestamp) > new Date(ultimaAtividade[id])) {
        ultimaAtividade[id] = d.timestamp;
        ultimoNome[id] = nome;
      }
    });
    
    return { ultimaAtividade, ultimoNome };
  } catch (error) {
    console.error('❌ Erro ao buscar últimas atividades:', error);
    return { ultimaAtividade: {}, ultimoNome: {} };
  }
}

// ===== VERIFICA SE É O CHEFE =====
function isChefe() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['isChefe'], (res) => {
      resolve(res.isChefe === true);
    });
  });
}

// ===== VERIFICA SE OPERADOR ESTÁ DESATIVADO (FOLGA) =====
function isOperadorDesativado(id) {
  return new Promise((resolve) => {
    chrome.storage.local.get(['operadores_desativados'], (res) => {
      const desativados = res.operadores_desativados || [];
      resolve(desativados.includes(id));
    });
  });
}

// ===== VERIFICA INATIVIDADE ATUALIZADA =====
async function verificarInatividade(ultimaAtividade, ultimoNome) {
  const agora = Date.now();
  const inativos = [];
  const criticos = [];
  
  // Obtém lista de operadores conhecidos
  const res = await chrome.storage.local.get(['operadores_conhecidos', 'operadores_ids']);
  const operadoresNomes = res.operadores_conhecidos || [];
  const operadoresIds = res.operadores_ids || {};
  
  // Se não houver operadores conhecidos, usa os que tem atividade
  const idsParaVerificar = Object.keys(ultimaAtividade).length > 0 
    ? Object.keys(ultimaAtividade) 
    : operadoresNomes.map(nome => operadoresIds[nome] || gerarIdUnico(nome));
  
  // Verifica cada operador
  for (const id of idsParaVerificar) {
    // Verifica se está desativado
    const desativado = await isOperadorDesativado(id);
    if (desativado) {
      console.log(`⛔ ${ultimoNome[id] || id} em folga, ignorando.`);
      continue;
    }
    
    const ultimo = ultimaAtividade[id];
    const nome = ultimoNome[id] || id;
    
    if (!ultimo) {
      criticos.push({
        id: id,
        nome: nome,
        tempoInativo: 'Nunca registrou atividade'
      });
      continue;
    }
    
    const tempoInativoMs = agora - new Date(ultimo).getTime();
    const tempoInativoMin = Math.floor(tempoInativoMs / (1000 * 60));
    
    if (tempoInativoMin >= CONFIG_INATIVIDADE.TEMPO_CRITICO) {
      criticos.push({
        id: id,
        nome: nome,
        tempoInativo: `${tempoInativoMin} minutos`,
        ultimaAtividade: ultimo
      });
    } else if (tempoInativoMin >= CONFIG_INATIVIDADE.TEMPO_ALERTA) {
      inativos.push({
        id: id,
        nome: nome,
        tempoInativo: `${tempoInativoMin} minutos`,
        ultimaAtividade: ultimo
      });
    }
  }
  
  // Salva os alertas no storage (SEMPRE, para o dashboard)
  const alertas = {
    timestamp: new Date().toISOString(),
    inativos: inativos,
    criticos: criticos
  };
  
  chrome.storage.local.set({ 
    alertas_ultima_verificacao: alertas,
    alertas_tem_inativos: inativos.length > 0 || criticos.length > 0
  });
  
  // ===== SÓ ENVIA NOTIFICAÇÃO SE FOR O CHEFE =====
  const chefe = await isChefe();
  if (!chefe) {
    console.log('👤 Usuário não é o chefe, notificações ignoradas.');
    return;
  }
  
  // Só envia notificações se for o chefe
  if (criticos.length > 0) {
    const nomes = criticos.map(o => o.nome).join(', ');
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icon.png',
      title: '🚨 ALERTA CRÍTICO DE INATIVIDADE!',
      message: `${nomes} está(ão) inativo(s) há mais de ${CONFIG_INATIVIDADE.TEMPO_CRITICO} minutos!`,
      priority: 2,
      requireInteraction: true
    });
    console.log(`🚨 ${criticos.length} operador(es) em situação crítica:`, criticos.map(o => o.nome).join(', '));
  } else if (inativos.length > 0) {
    const nomes = inativos.map(o => o.nome).join(', ');
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icon.png',
      title: '⚠️ Atenção: Inatividade Detectada',
      message: `${nomes} está(ão) inativo(s) há mais de ${CONFIG_INATIVIDADE.TEMPO_ALERTA} minutos.`,
      priority: 1
    });
    console.log(`⚠️ ${inativos.length} operador(es) inativo(s):`, inativos.map(o => o.nome).join(', '));
  }
}

// Executa o monitoramento de inatividade
async function executarMonitoramentoInatividade() {
  console.log(`🔍 Verificando inatividade (${new Date().toLocaleString()})...`);
  const { ultimaAtividade, ultimoNome } = await buscarUltimasAtividades();
  await verificarInatividade(ultimaAtividade, ultimoNome);
}

// Inicia o monitor de inatividade
executarMonitoramentoInatividade();

// Configura verificação periódica
const intervalMs = CONFIG_INATIVIDADE.INTERVALO * 60 * 1000;
setInterval(executarMonitoramentoInatividade, intervalMs);

console.log(`✅ Monitor de inatividade iniciado! Verificando a cada ${CONFIG_INATIVIDADE.INTERVALO} minutos.`);
console.log(`ℹ️ Notificações só serão enviadas se "isChefe" estiver ativado.`);
console.log(`🆔 Operadores identificados por ID único (multi-navegador).`);

// ================================================================
// ===== 6. INICIALIZAÇÃO GERAL =====
// ================================================================

console.log("✅ ICD Hub - Background carregado com sucesso!");
console.log(`📊 Monitoramento de métricas ativo`);
console.log(`⏰ Verificação de inatividade a cada ${CONFIG_INATIVIDADE.INTERVALO} minutos`);
console.log(`⚠️ Alerta de inatividade após ${CONFIG_INATIVIDADE.TEMPO_ALERTA} minutos`);
console.log(`🚨 Alerta crítico após ${CONFIG_INATIVIDADE.TEMPO_CRITICO} minutos`);
console.log(`🆔 Suporte a operador_id para múltiplos navegadores!`);