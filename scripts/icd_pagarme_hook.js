// ================================================================
// ICD HUB — Hook de rede do Pagar.me (MAIN world) — v2
// Filtra pelo charge_id da URL atual para evitar pegar
// dados da transação anterior (a SPA do Pagar.me mantém cache).
// ================================================================

(function () {
  'use strict';

  if (window.__icdPagarmeHooked) return;
  window.__icdPagarmeHooked = true;

  // ---------- Descobre o charge_id da URL atual ----------
  function getChargeIdFromUrl() {
    // Ex.: /charges/ch_KzPZN28ivfWJq9RD?created_at=...
    const m = location.pathname.match(/\/charges\/(ch_[A-Za-z0-9]+)/);
    return m ? m[1] : null;
  }

  const chargeIdAtual = getChargeIdFromUrl();
  console.log('[ICD Hub] Hook MAIN world instalado. Charge ID atual:', chargeIdAtual);

  // ---------- Filtro: só aceita requests dessa charge ----------
  function urlPertenceAChargeAtual(url) {
    if (!url) return false;
    if (!chargeIdAtual) return true; // fallback: aceita qualquer
    // Aceita tanto /charges/ch_XXX quanto ?charge_id=ch_XXX etc.
    return url.includes(chargeIdAtual);
  }

  function tentarExtrair(text, url) {
    if (!text || !text.includes('last_transaction')) return;
    if (!urlPertenceAChargeAtual(url)) {
      console.log('[ICD Hub] Ignorando JSON de outra charge:', url);
      return;
    }
    try {
      const json = JSON.parse(text);
      const itens = Array.isArray(json) ? json : [json];
      for (const item of itens) {
        // Confirma que é a charge certa dentro do payload também
        const idInterno = item.id || (item.data && item.data.id);
        if (chargeIdAtual && idInterno && idInterno !== chargeIdAtual) {
          continue;
        }
        const lt = item.last_transaction || (item.data && item.data.last_transaction);
        const cust = item.customer || (item.data && item.data.customer);
        if (lt && (lt.acquirer_nsu || lt.acquirer)) {
          console.log('[ICD Hub] JSON VÁLIDO capturado de:', url);
          window.postMessage({
            __icdPagarme: true,
            acquirer: (lt.acquirer || '').toString().toLowerCase(),
            nsu: (lt.acquirer_nsu || '').toString(),
            email: cust && cust.email ? cust.email.toString() : ''
          }, '*');
          return;
        }
      }
    } catch (e) {
      // ignora
    }
  }

  // ---- Hook no fetch ----
  const origFetch = window.fetch;
  window.fetch = async function (...args) {
    const resp = await origFetch.apply(this, args);
    try {
      const url = (args[0] && args[0].url) || String(args[0]);
      if (urlPertenceAChargeAtual(url)) {
        const clone = resp.clone();
        clone.text().then((t) => tentarExtrair(t, url)).catch(() => {});
      }
    } catch (_) {}
    return resp;
  };

  // ---- Hook no XHR ----
  const OrigXHR = window.XMLHttpRequest;
  function HookedXHR() {
    const xhr = new OrigXHR();
    xhr.addEventListener('load', function () {
      try {
        const url = xhr.responseURL || '';
        if (urlPertenceAChargeAtual(url)) {
          tentarExtrair(xhr.responseText, url);
        }
      } catch (_) {}
    });
    return xhr;
  }
  HookedXHR.prototype = OrigXHR.prototype;
  window.XMLHttpRequest = HookedXHR;
})();