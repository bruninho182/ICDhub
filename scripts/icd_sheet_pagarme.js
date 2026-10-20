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

  // ---------- 4. Botão de estorno ----------
  function localizarCardMetadata() {
    // O Pagar.me renderiza esse título como um elemento comum, sem tag de heading.
    const titulo = Array.from(document.querySelectorAll('body *'))
      .find((el) => el.children.length === 0 && el.textContent.trim().toLowerCase() === 'metadata');
    if (!titulo) return null;

    // Encontra o card visual que contém o título e os dados do Metadata.
    let elemento = titulo.parentElement;
    let candidato = null;
    while (elemento && elemento !== document.body) {
      const estilo = window.getComputedStyle(elemento);
      const retangulo = elemento.getBoundingClientRect();
      if (retangulo.width >= 180 && retangulo.width <= 500 && retangulo.height >= 60 && retangulo.height <= 300) {
        candidato = elemento;
        if (parseFloat(estilo.borderTopLeftRadius) > 0) return elemento;
      }
      elemento = elemento.parentElement;
    }
    return candidato || titulo.parentElement?.parentElement || null;
  }

  function posicionarBotao(btn) {
    const card = localizarCardMetadata();
    if (!card) {
      btn.style.display = 'none';
      return;
    }

    if (btn.previousElementSibling !== card) {
      card.insertAdjacentElement('afterend', btn);
    }
    btn.style.display = 'block';
  }

  function criarBotao() {
    if (document.getElementById('icdhub-btn-coletar-pagarme')) return;

    const btn = document.createElement('button');
    btn.id = 'icdhub-btn-coletar-pagarme';
    btn.textContent = 'Dados Estorno';
    btn.type = 'button';
    btn.style.cssText = `
      position: static;
      display: block;
      width: 100%;
      margin-top: 10px;
      padding: 10px 16px;
      background: #2fa574;
      color: #fff;
      border: none;
      border-radius: 8px;
      font-family: inherit;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      line-height: 1.5;
      box-shadow: 0 2px 6px rgba(20, 100, 65, 0.2);
    `;

    btn.addEventListener('click', () => {
      const textoOriginal = 'Dados Estorno';
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
    posicionarBotao(btn);
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
    if (document.body) {
      criarBotao();
      const botao = document.getElementById('icdhub-btn-coletar-pagarme');
      if (botao) posicionarBotao(botao);
    }
    else document.addEventListener('DOMContentLoaded', criarBotao, { once: true });
  }

  // O Pagar.me usa navegação SPA e pode recriar o card de Metadata.
  const observador = new MutationObserver(() => {
    const botao = document.getElementById('icdhub-btn-coletar-pagarme');
    if (botao) posicionarBotao(botao);
  });
  observador.observe(document.documentElement, { childList: true, subtree: true });

  chrome.storage.local.get([CHAVE_BOTOES_ESTORNO], (res) => {
    atualizarVisibilidade(res[CHAVE_BOTOES_ESTORNO] === true);
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes[CHAVE_BOTOES_ESTORNO]) {
      atualizarVisibilidade(changes[CHAVE_BOTOES_ESTORNO].newValue !== false);
    }
  });
})();
