// ================================================================
// ICD HUB — Coletor de dados do ICD Grupo (página de booking)
// Salva os dados em chrome.storage.local para posterior merge
// com os dados do Pagar.me e envio à planilha.
// ================================================================

(function () {
  'use strict';

  const CHAVE_BOTOES_ESTORNO = 'icdRefundButtonsEnabled';

  // ---------- Helpers de extração ----------

  /**
   * Procura um <p> irmão logo após um label de texto.
   * Ex.: <p>E-mail:</p><div><p>valor</p></div>
   */
  function pegarValorPorLabel(labelTexto) {
    const labels = Array.from(document.querySelectorAll('p'));
    for (const el of labels) {
      if (el.textContent.trim() === labelTexto) {
        // Sobe até o container do grid e busca o próximo <p> "de valor"
        const container = el.closest('.MuiGrid-item') || el.parentElement;
        if (!container) continue;

        const candidatos = container.querySelectorAll('p');
        for (const c of candidatos) {
          if (c !== el && c.textContent.trim() && !c.textContent.trim().endsWith(':')) {
            return c.textContent.trim();
          }
        }
      }
    }
    return '';
  }

  /** Extrai o voucher no formato 67720383-1 (dentro do bloco de itens) */
  function pegarVoucher() {
    // 1) tenta pelo chip monoespaçado com hífen
    const chips = document.querySelectorAll('.MuiChip-label');
    for (const c of chips) {
      const t = c.textContent.trim();
      if (/^\d{6,}-\d+$/.test(t)) return t;
    }
    // 2) fallback: label "Voucher:" (vem sem hífen)
    const v = pegarValorPorLabel('Voucher:');
    return v;
  }

  /** Atração: <p> com font-weight:600 que vem logo abaixo do chip do voucher */
  function pegarAtracao() {
    // Busca todos os <p> com font-weight:600 e margin-top:8px (padrão do bloco de itens)
    const ps = document.querySelectorAll('p[style*="font-weight: 600"]');
    for (const p of ps) {
      const t = p.textContent.trim();
      // Ignora totais
      if (t && !t.toLowerCase().startsWith('total')) return t;
    }
    return '';
  }

  /** Data de compra: label "Criado por:" → span irmão com caption */
  function pegarDataCompra() {
    const labels = Array.from(document.querySelectorAll('p'));
    for (const el of labels) {
      if (el.textContent.trim() === 'Criado por:') {
        const container = el.closest('.MuiGrid-item') || el.parentElement;
        if (!container) continue;
        const span = container.querySelector('span.MuiTypography-caption');
        if (span) {
          // "16/10/2026, 15:18:06" → "16/10/2026"
          const m = span.textContent.trim().match(/(\d{2}\/\d{2}\/\d{4})/);
          if (m) return m[1];
        }
      }
    }
    return '';
  }

  /** Data da visita: "Data da visita: 19/10/2026 - 15:40" */
  function pegarDataVisita() {
    const todos = document.querySelectorAll('p');
    for (const p of todos) {
      const t = p.textContent.trim();
      const m = t.match(/Data da visita:\s*(\d{2}\/\d{2}\/\d{4})/);
      if (m) return m[1];
    }
    return '';
  }

  /** Valor total: "Total: R$ 134,00" (pega o último, que é o Total Geral) */
  function pegarValor() {
    let ultimo = '';
    const todos = document.querySelectorAll('p, h5, h6');
    for (const el of todos) {
      const t = el.textContent.trim();
      const m = t.match(/Total(?: Geral)?:\s*(R\$\s*[\d.,]+)/i);
      if (m) ultimo = m[1].replace(/\s+/g, ' ').trim();
    }
    return ultimo;
  }

  function pegarCodigoTransacao() {
    const porLabel = [
      'Código da transação:',
      'Código de transação:',
      'Código transação:',
      'Transação:'
    ];
    for (const label of porLabel) {
      const valor = pegarValorPorLabel(label);
      if (valor) return valor;
    }

    const texto = document.body ? document.body.innerText : '';
    const encontrado = texto.match(/C[oó]digo(?:\s+da|\s+de)?\s+transaç[aã]o:\s*([^\n]+)/i);
    return encontrado ? encontrado[1].trim() : '';
  }

  function ehPix(metodoPagamento) {
    return normalizarTexto(metodoPagamento) === 'PIX';
  }

  function normalizarTexto(valor) {
    return String(valor || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toUpperCase();
  }

  function definirProcessando(btn, processando, textoOriginal) {
    btn.disabled = processando;
    btn.style.opacity = processando ? '0.7' : '1';
    btn.style.cursor = processando ? 'wait' : 'pointer';
    btn.textContent = processando ? '⏳ Processando...' : textoOriginal;
  }

  function enviarLinhaPix(dados, btn, textoOriginal) {
    const linha = {
      E: dados.voucher,
      F: dados.atracao,
      G: 'PIX',
      H: '',
      I: dados.codigoTransacao,
      J: dados.dataCompra,
      K: dados.dataVisita,
      L: dados.valor,
      Q: dados.email
    };

    const faltantes = [
      ['voucher', linha.E],
      ['atração', linha.F],
      ['código da transação', linha.I],
      ['e-mail', linha.Q]
    ]
      .filter(([, valor]) => !String(valor || '').trim())
      .map(([nome]) => nome);

    if (faltantes.length) {
      alert('⚠️ Dados obrigatórios ausentes para PIX: ' + faltantes.join(', '));
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
        alert('✅ PIX enviado para a planilha!\n(Linha ' + resp.linha + ')');
        chrome.storage.local.remove('icdDadosPendentes');
      } else if (resp && resp.duplicado) {
        alert('⚠️ Voucher já existe na planilha.\n(Linha ' + resp.linha + ')\nNenhuma nova linha foi criada.');
      } else {
        alert('❌ Falha ao enviar PIX:\n' + (resp && resp.erro ? resp.erro : 'erro desconhecido'));
      }
      definirProcessando(btn, false, textoOriginal);
    });
  }

  // ---------- Botão flutuante ----------

  function localizarBotaoCancelar() {
    return Array.from(document.querySelectorAll('button'))
      .find((el) => normalizarTexto(el.textContent).includes('CANCELAR RESERVA'));
  }

  function posicionarBotao(btn) {
    const cancelar = localizarBotaoCancelar();
    if (!cancelar) {
      btn.style.display = 'none';
      return;
    }

    // Mantém o botão no mesmo grupo de ações do cabeçalho da reserva.
    if (btn.previousElementSibling !== cancelar) {
      cancelar.insertAdjacentElement('afterend', btn);
    }
    btn.style.display = '';
  }

  function criarBotao() {
    // Evita duplicar o botão se o script rodar 2x
    if (document.getElementById('icdhub-btn-coletar-icd')) return;
    const btn = document.createElement('button');
    btn.id = 'icdhub-btn-coletar-icd';
    btn.textContent = 'Dados Estorno';
    btn.type = 'button';
    btn.style.cssText = `
      position: static;
      margin-left: 8px;
      padding: 6px 16px;
      background: transparent;
      color: #4caf50;
      border: 1px solid #4caf50;
      border-radius: 4px;
      font-family: inherit;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      line-height: 1.75;
      min-height: 36px;
      letter-spacing: 0.02857em;
      text-transform: uppercase;
      box-shadow: none;
      white-space: nowrap;
    `;

    btn.addEventListener('click', () => {
      const textoOriginal = 'Dados Estorno';
      definirProcessando(btn, true, textoOriginal);
      const metodoPagamento = pegarValorPorLabel('Método de pagamento:');
      const dados = {
        voucher: pegarVoucher(),          // E
        atracao: pegarAtracao(),          // F
        metodoPagamento,                  // G
        codigoTransacao: pegarCodigoTransacao(), // I (PIX)
        dataCompra: pegarDataCompra(),    // J
        dataVisita: pegarDataVisita(),    // K
        valor: pegarValor(),              // L
        email: pegarValorPorLabel('E-mail:') // Q (ICD)
      };

      // Validação mínima
      if (!dados.voucher || !dados.email) {
        alert('⚠️ Não foi possível extrair voucher e/ou e-mail do ICD Grupo.\nVerifique se a página terminou de carregar.');
        definirProcessando(btn, false, textoOriginal);
        return;
      }

      if (ehPix(dados.metodoPagamento)) {
        enviarLinhaPix(dados, btn, textoOriginal);
        return;
      }

      chrome.storage.local.set({ icdDadosPendentes: dados }, () => {
        alert('✅ Dados do ICD copiados!\nAgora abra a página do Pagar.me e clique em "Copiar dados Pagar.me".');
        console.log('📦 Dados ICD salvos:', dados);
        definirProcessando(btn, false, textoOriginal);
      });
    });

    document.body.appendChild(btn);
    posicionarBotao(btn);
  }

  function removerBotao() {
    document.getElementById('icdhub-btn-coletar-icd')?.remove();
  }

  function atualizarVisibilidade(ativo) {
    if (!ativo) {
      removerBotao();
      return;
    }

    if (document.body) {
      criarBotao();
      const botao = document.getElementById('icdhub-btn-coletar-icd');
      if (botao) posicionarBotao(botao);
    }
    else document.addEventListener('DOMContentLoaded', criarBotao, { once: true });
  }

  // A tela de reservas é uma SPA: o cabeçalho pode ser montado depois ou recriado.
  const observador = new MutationObserver(() => {
    const botao = document.getElementById('icdhub-btn-coletar-icd');
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
