// --- 1. COMUNICAÇÃO DE DADOS (HUB -> SISTEMAS) ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.acao === "DADOS_PRONTOS") {
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach((tab) => {
        // AGORA INCLUI O SISTEMA NOVO (app.icdgrupo) E O ANTIGO
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

// --- 2. GERENCIADOR DE DOWNLOADS (RENOMEADOR DE VOUCHERS) ---
chrome.downloads.onDeterminingFilename.addListener((downloadItem, suggest) => {
  // Verifica se é um PDF (pela extensão ou MIME)
  const isPDF = downloadItem.filename.endsWith(".pdf") || downloadItem.mime?.includes("pdf");
  if (!isPDF) {
    suggest(); // Não é PDF, mantém nome original
    return true;
  }

  // Função auxiliar para limpar o nome (remove prefixo "voucher-" e garante .pdf)
  function limparNomeArquivo(nome) {
    if (!nome) return null;
    // Remove "voucher-" no início, se existir
    let limpo = nome.replace(/^voucher-/, '');
    // Se não tiver extensão .pdf, adiciona
    if (!limpo.toLowerCase().endsWith('.pdf')) {
      limpo += '.pdf';
    }
    return limpo;
  }

  // 1º Tenta pegar o nome salvo no Storage
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

    // 2º Se não tiver no Storage, pergunta direto para a aba ativa
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
            suggest(); // Falhou, baixa com o nome padrão
            return;
          }
          const nomeLimpo = limparNomeArquivo(response.filename);
          if (nomeLimpo) {
            console.log(`📥 Renomeando download para: ${nomeLimpo} (via mensagem)`);
            suggest({ filename: nomeLimpo, conflictAction: "uniquify" });
          } else {
            suggest(); // Fallback
          }
        }
      );
    });
  });

  return true; // Mantém o canal aberto para a resposta assíncrona
});

// --- 3. ALERTAS DE BEM-ESTAR E PRODUTIVIDADE ---

// Cria o alarme quando a extensão for instalada ou atualizada
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