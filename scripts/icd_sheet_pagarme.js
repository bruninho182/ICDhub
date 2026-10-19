// ================================================================
// ICD HUB — Coletor de dados do Pagar.me (ISOLATED world) — v3
// ================================================================

(function () {
  'use strict';

  const STORAGE_KEY = 'pagarmeDadosCapturados';
  const CHAVE_BOTOES_ESTORNO = 'icdRefundButtonsEnabled';
  let recursoAtivo = false;

  // ---------- 0. Limpa cache antigo ao iniciar ----------
  // (evita pegar dados da charge anterior quando a SPA do Pagar.me
  //  ainda mantém o estado em memória)
  // ---------- Descobre charge_id atual ----------
  function getChargeIdFromUrl() {
    const m = location.pathname.match(/\/charges\/(ch_[A-Za-z0-9]+)/);
    return m ? m[1] : null;
  }
  const chargeIdAtual = getChargeIdFromUrl();

  // ---------- 1. Escuta mensagens do MAIN world ----------
  window.addEventListener('message', (ev) => {
    if (!recursoAtivo) return;
    if (!ev.data || !ev.data.__icdPagarme) return;
    const { acquirer, nsu, email } = ev.data;
    if (!nsu && !acquirer) return;

    chrome.storage.local.set({
      [STORAGE_KEY]: {
        chargeId: chargeIdAtual,
        acquirer: acquirer || '',
        nsu: nsu || '',
        email: email || ''
      }
    });
    console.log('📦 Pagar.me dados capturados:', { chargeId: chargeIdAtual, acquirer, nsu, email });
  });

  // ---------- 2. Fallback: ler do HTML ----------
  function lerDoHtml() {
    const out = { acquirer: '', nsu: '', email: '' };
    const texto = document.body ? document.body.innerText : '';
    const mNsu = texto.match(/NSU[:\s]*([0-9]{6,12})/i);
    if (mNsu) out.nsu = mNsu[1];
    const mAdq = texto.match(/Adquirente[:\s]*([A-Za-zÀ-ú ]{3,30})/i);
    if (mAdq) out.acquirer = mAdq[1].trim().toLowerCase();
    const mEmail = texto.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
    if (mEmail) out.email = mEmail[0];
    return out;
  }

  // ---------- 3. Normalização ----------
  function normalizarAdquirente(valor) {
    if (!valor) return '';
    const mapa = {
      redecard: 'REDE',
      rede: 'REDE',
      cielo: 'CIELO',
      stone: 'STONE',
      getnet: 'GETNET',
      adyen: 'ADYEN',
      stripe: 'STRIPE',
      mercadopago: 'MERCADO PAGO',
      'mercado_pago': 'MERCADO PAGO',
      pagarme: 'PAGARME',
      pagar_me: 'PAGARME',
      mundipagg: 'MUNDIPAGG'
    };
    const k = valor.toString().toLowerCase().trim();
    return mapa[k] || valor.toString().toUpperCase();
  }

  function definirProcessando(btn, processando, textoOriginal) {
    btn.disabled = processando;
    btn.style.opacity = processando ? '0.7' : '1';
    btn.style.cursor = processando ? 'wait' : 'pointer';
    btn.textContent = processando ? '⏳ Processando...' : textoOriginal;
  }

  // ---------- 4. Botão flutuante ----------
  function criarBotao() {
    if (document.getElementById('icdhub-btn-coletar-pagarme')) return;

    const btn = document.createElement('button');
    btn.id = 'icdhub-btn-coletar-pagarme';
    btn.textContent = '📋 Copiar dados Pagar.me';
    btn.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 999999;
      padding: 12px 18px;
      background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
      color: #fff;
      border: none;
      border-radius: 10px;
      font-family: 'Inter', sans-serif;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 6px 20px rgba(245, 87, 108, 0.4);
    `;

    btn.addEventListener('click', () => {
      const textoOriginal = '📋 Copiar dados Pagar.me';
      definirProcessando(btn, true, textoOriginal);
      chrome.storage.local.get(['icdDadosPendentes', STORAGE_KEY], (res) => {
        const icd = res.icdDadosPendentes;
        const pg = res[STORAGE_KEY] || {};

        if (!icd) {
          alert('⚠️ Nenhum dado do ICD Grupo encontrado.\nAbra primeiro a página do ICD, clique em "Copiar dados ICD" e depois volte aqui.');
          definirProcessando(btn, false, textoOriginal);
          return;
        }

        // Validação: charge_id do storage bate com o da URL?
        if (pg.chargeId && chargeIdAtual && pg.chargeId !== chargeIdAtual) {
          alert(
            '⚠️ Os dados capturados são de OUTRA transação.\n\n' +
            'Capturado: ' + pg.chargeId + '\n' +
            'Aba atual: ' + chargeIdAtual + '\n\n' +
            'Recarregue esta página do Pagar.me (F5) e tente novamente.'
          );
          chrome.storage.local.remove(STORAGE_KEY);
          definirProcessando(btn, false, textoOriginal);
          return;
        }

        let pgFinal = pg;
        if (!pgFinal.nsu) {
          const fb = lerDoHtml();
          pgFinal = {
            chargeId: chargeIdAtual,
            acquirer: pgFinal.acquirer || fb.acquirer,
            nsu: pgFinal.nsu || fb.nsu,
            email: pgFinal.email || fb.email
          };
        }

        if (!pgFinal.nsu) {
          const abrir = confirm(
            '⚠️ Ainda não capturei o NSU/adquirente do Pagar.me.\n\n' +
            'Clique em OK para recarregar a página AGORA.\n' +
            'Depois que carregar tudo, clique no botão rosa novamente.'
          );
          if (abrir) location.reload();
          else definirProcessando(btn, false, textoOriginal);
          return;
        }

        // Divergência de e-mail
        const emailIcd = (icd.email || '').trim().toLowerCase();
        const emailPg = (pgFinal.email || '').trim().toLowerCase();
        if (emailIcd && emailPg && emailIcd !== emailPg) {
          alert(
            '⚠️ DIVERGÊNCIA DE E-MAIL DETECTADA!\n\n' +
            'ICD Grupo:  ' + icd.email + '\n' +
            'Pagar.me:   ' + pgFinal.email + '\n\n' +
            'A linha NÃO foi enviada. Verifique e tente novamente.'
          );
          definirProcessando(btn, false, textoOriginal);
          return;
        }

        const emailFinal = icd.email || pgFinal.email;
        const linha = {
          E: icd.voucher,
          F: icd.atracao,
          G: icd.metodoPagamento,
          H: normalizarAdquirente(pgFinal.acquirer),
          I: pgFinal.nsu,
          J: icd.dataCompra,
          K: icd.dataVisita,
          L: icd.valor,
          Q: emailFinal
        };

        const camposObrigatorios = [
          ['voucher', linha.E],
          ['atração', linha.F],
          ['método de pagamento', linha.G],
          ['NSU', linha.I],
          ['e-mail', linha.Q]
        ];
        const faltantes = camposObrigatorios
          .filter(([, valor]) => !String(valor || '').trim())
          .map(([nome]) => nome);

        if (faltantes.length) {
          alert('⚠️ Dados obrigatórios ausentes: ' + faltantes.join(', '));
          definirProcessando(btn, false, textoOriginal);
          return;
        }

        chrome.runtime.sendMessage({ acao: 'ENVIAR_LINHA_PLANILHA', linha }, (resp) => {
          if (chrome.runtime.lastError) {
            alert('❌ Erro ao comunicar com o background:\n' + chrome.runtime.lastError.message);
            definirProcessando(btn, false, textoOriginal);
            return;
          }
          if (resp && resp.ok) {
            alert('✅ Linha enviada para a planilha!\n(Linha ' + resp.linha + ')');
            chrome.storage.local.remove(['icdDadosPendentes', STORAGE_KEY]);
          } else if (resp && resp.duplicado) {
            alert('⚠️ Voucher já existe na planilha.\n(Linha ' + resp.linha + ')\nNenhuma nova linha foi criada.');
          } else {
            alert('❌ Falha ao enviar:\n' + (resp && resp.erro ? resp.erro : 'erro desconhecido'));
          }
          definirProcessando(btn, false, textoOriginal);
        });
      });
    });

    document.body.appendChild(btn);
  }

  function removerBotao() {
    document.getElementById('icdhub-btn-coletar-pagarme')?.remove();
  }

  function atualizarVisibilidade(ativo) {
    recursoAtivo = ativo;
    if (!ativo) {
      removerBotao();
      return;
    }

    // Evita reaproveitar dados de uma cobrança anterior quando o recurso é ativado.
    chrome.storage.local.remove(STORAGE_KEY);
    if (document.body) criarBotao();
    else document.addEventListener('DOMContentLoaded', criarBotao, { once: true });
  }

  chrome.storage.local.get([CHAVE_BOTOES_ESTORNO], (res) => {
    atualizarVisibilidade(res[CHAVE_BOTOES_ESTORNO] === true);
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes[CHAVE_BOTOES_ESTORNO]) {
      atualizarVisibilidade(changes[CHAVE_BOTOES_ESTORNO].newValue !== false);
    }
  });
})();
