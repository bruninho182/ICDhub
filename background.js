chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.acao === "DADOS_PRONTOS") {
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach((tab) => {
        if (tab.url && tab.url.includes("ingressocomdesconto.com.br")) {
          chrome.tabs.sendMessage(tab.id, request).catch(() => {});
        }
      });
    });
    console.log("📢 Hub: Dados replicados para o sistema de vendas.");
    sendResponse({ status: "OK" });
  }
  return true;
});

chrome.downloads.onDeterminingFilename.addListener((downloadItem, suggest) => {
  if (
    !downloadItem.filename.endsWith(".pdf") &&
    !downloadItem.mime?.includes("pdf")
  ) {
    suggest();
    return true;
  }

  chrome.storage.local.get("nomeVoucherAtual", (res) => {
    if (res.nomeVoucherAtual) {
      suggest({ filename: res.nomeVoucherAtual, conflictAction: "uniquify" });
      chrome.storage.local.remove("nomeVoucherAtual");
      return;
    }

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]?.id) {
        suggest();
        return;
      }

      chrome.tabs.sendMessage(
        tabs[0].id,
        { type: "GET_NOME_VOUCHER" },
        (response) => {
          if (chrome.runtime.lastError || !response?.filename) {
            suggest();
            return;
          }
          suggest({ filename: response.filename, conflictAction: "uniquify" });
        },
      );
    });
  });

  return true;
});

/// ALERTAS 

// Cria o alarme quando a extensão for instalada ou atualizada
chrome.runtime.onInstalled.addListener(() => {
    chrome.alarms.create("wellnessAlarm", { periodInMinutes: 120 });
});

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "wellnessAlarm") {
        const lembretes = [
            "💧 Hora de hidratar! Beba um copo d'água.",
            "🧘 O corpo agradece! Vamos fazer um alongamento rápido?",
            "☕ Pausa merecida! Que tal um cafezinho agora?",
            "👀 Regra 20-20-20: Olhe para um ponto distante por 20 segundos para descansar a vista."
        ];
        
    
        const lembreteAtual = lembretes[Math.floor(Math.random() * lembretes.length)];

      
        chrome.notifications.create({
            type: "basic",
            iconUrl: "icon.png", // Certifique-se de ter um ícone na pasta, ou remova esta linha
            title: "Pausa para Bem-Estar 🌟",
            message: lembreteAtual,
            priority: 1
        });
    }
});

//// ALERTAS FIM