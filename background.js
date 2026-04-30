/* =========================================================
   ICD HUB - BACKGROUND CENTRAL
   ========================================================= */

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
