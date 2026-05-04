console.log("✅ ICD Hub: Ativado (Versão TicketGo + Voucher Fix)");

// --- 1. MONITORAMENTO DE DADOS ---

chrome.storage.local.get(
  [
    "dadosPedido",
    "nomeOperador",
    "bridgeData",
    "reservaGrayline",
    "ticketgoData", // Adicionado TicketGo
    "usuarioConfigurado",
  ],
  (res) => {
    executarComTentativas(res);
  },
);

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local") {
    chrome.storage.local.get(
      [
        "nomeOperador",
        "usuarioConfigurado",
        "dadosPedido",
        "bridgeData",
        "reservaGrayline",
        "ticketgoData", // Adicionado TicketGo
      ],
      (res) => {
        executarComTentativas(res);
      },
    );
  }
});

function executarComTentativas(res) {
  let tentativas = 0;
  const intervalo = setInterval(() => {
    const sucesso = executarPreenchimento(res);
    tentativas++;
    if (sucesso || tentativas > 20) clearInterval(intervalo);
  }, 600);
}

function executarPreenchimento(res) {
  const isNovoSistema = window.location.href.includes("app.icdgrupo.com.br");

  if (isNovoSistema) {
    // Prioridade TicketGo
    if (res.ticketgoData)
      return preencherNovoSistemaICD(res.ticketgoData, res.nomeOperador, "TicketGo");
    
    if (res.dadosPedido)
      return preencherNovoSistemaICD(res.dadosPedido, res.nomeOperador, "GYG");
    
    if (res.bridgeData)
      return preencherNovoSistemaICD(res.bridgeData, res.usuarioConfigurado, "Bridge");
    
    if (res.reservaGrayline)
      return preencherNovoSistemaICD(res.reservaGrayline, res.usuarioConfigurado, "Grayline");
    
  } else {
    // Sistema Antigo
    if (res.dadosPedido) preencherCamposGYG(res.dadosPedido, res.nomeOperador);
    if (res.bridgeData)
      preencherHeadoutGrayline(res.bridgeData, res.usuarioConfigurado);
    if (res.reservaGrayline)
      preencherHeadoutGrayline(res.reservaGrayline, res.usuarioConfigurado);
    return true;
  }
  return false;
}

// --- 2. CONFIGURAÇÕES E TEXTOS ---

const textoPadraoEmail = `Dear visitor,

Thank you for choosing us!

Your coupon is attached to this email.

We hope you enjoy your visit!

If something prevents you from visiting on your chosen date or time, you can reschedule your tickets by replying to this email or the service channels below:

WhatsApp: (11) 93328-0358 / (11) 93495-1053
Phone: (11) 3939-0435 / (21) 4063-3003

We are at your disposal!

Best regards,`;

// --- 3. SNIPER MUI (SISTEMA NOVO) ---

function findInputByMuiText(term) {
  const textToFind = term.toLowerCase();
  const elements = Array.from(
    document.querySelectorAll("span, label, p, legend"),
  );
  const target = elements.find((el) =>
    el.innerText.toLowerCase().trim().includes(textToFind),
  );

  if (target) {
    const container = target.closest(
      ".MuiFormControl-root, .MuiTextField-root, div.MuiGrid-item",
    );
    if (container) {
      const input = container.querySelector("input");
      const trigger = container.querySelector(
        '[role="button"], [role="combobox"], .MuiSelect-select',
      );
      return { input, trigger };
    }
  }
  return null;
}

async function selecionarBarraMui(labelBusca, valorAlvo) {
  const f = findInputByMuiText(labelBusca);
  if (!f) return;

  const elClique = f.trigger || f.input;
  if (elClique) {
    elClique.focus();
    elClique.click();

    setTimeout(() => {
      const opcoes = Array.from(
        document.querySelectorAll(
          'li.MuiMenuItem-root, li.MuiAutocomplete-option, [role="option"]',
        ),
      );
      const alvo = opcoes.find((opt) => {
        const txt = opt.innerText.toUpperCase();
        return (
          txt.includes(valorAlvo.toUpperCase()) ||
          (valorAlvo === "Brasil" && txt.includes("BRAZIL"))
        );
      });
      if (alvo) alvo.click();
    }, 600);
  }
}

function preencherNovoSistemaICD(dados, operador, dataType) {
  if (!dados) return false;

  // Ajuste para TicketGo usar o Order Number como Documento
  const idReserva = dados.orderNumber || dados.gyg || dados.bookingId || "";
  const refExterna = `${idReserva} - ${operador || "OPERADOR"}`;

  const mapeamento = [
    { busca: "E-mail", valor: dados.email },
    { busca: "Nome", valor: dados.nome },
    { busca: "Telefone", valor: dados.telefone },
    { busca: "Número do documento", valor: idReserva },
    { busca: "Referência Externa", valor: refExterna },
    { busca: "nascimento", valor: "01/01/2001" },
  ];

  let count = 0;
  mapeamento.forEach((item) => {
    const f = findInputByMuiText(item.busca);
    if (f && f.input) {
      forceReactValue(f.input, item.valor);
      count++;
    }
  });

  selecionarBarraMui("País", "Brasil");
  setTimeout(() => selecionarBarraMui("Sexo", "Não informado"), 800);

  if (count > 0) {
    prepararDadosEmail(idReserva, dados.nome, dados.email);
    setTimeout(() => {
      let keysToRemove = [];
      if (dataType === "TicketGo") keysToRemove = ["ticketgoData"];
      else if (dataType === "GYG") keysToRemove = ["dadosPedido"];
      else keysToRemove = ["bridgeData", "reservaGrayline"];
      
      chrome.storage.local.remove(keysToRemove);
    }, 5000);
    return true;
  }
  return false;
}

// --- 4. FUNÇÕES DE SUPORTE E SISTEMA ANTIGO ---

function preencherAposTexto(numero, valor) {
  const todosElementos = Array.from(
    document.querySelectorAll("td, span, font, b"),
  );
  const elementoAlvo = todosElementos.find(
    (el) => el.innerText.trim() === numero.toString(),
  );

  if (elementoAlvo) {
    const inputs = Array.from(
      document.querySelectorAll('input:not([type="hidden"]), select'),
    );
    const inputCorreto = inputs.find(
      (input) =>
        elementoAlvo.compareDocumentPosition(input) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    );
    if (inputCorreto) forceReactValue(inputCorreto, valor);
  }
}

function preencherCamposGYG(dados, nomeOperador) {
  if (!dados) return;
  const valorCV = `${dados.gyg} - ${nomeOperador || "OPERADOR"}`;
  const campos = [
    { nome: "sAge_Nome", valor: dados.nome },
    { nome: "sAge_Email", valor: dados.email },
    { nome: "sAge_CPF", valor: dados.gyg },
    { nome: "_sVen_Cartao", valor: valorCV },
  ];
  campos.forEach((c) => {
    const el = document.getElementsByName(c.nome)[0];
    if (el) forceReactValue(el, c.valor);
  });
  prepararDadosEmail(dados.gyg, dados.nome, dados.email);
  setTimeout(() => {
    chrome.storage.local.remove("dadosPedido");
  }, 2000);
}

function preencherHeadoutGrayline(d, nomeUsuario) {
  if (!d || !d.nome) return;
  const operador = nomeUsuario || "Sem Nome";
  preencherAposTexto(2, d.nome);
  preencherAposTexto(3, d.bookingId);
  preencherAposTexto(4, d.email);
  preencherAposTexto(15, `${d.bookingId} - ${operador}`);
  prepararDadosEmail(d.bookingId, d.nome, d.email);
  setTimeout(() => {
    chrome.storage.local.remove(["bridgeData", "reservaGrayline"]);
  }, 2000);
}

function forceReactValue(input, value) {
  if (!input || !value) return;

  let valorFinal = value;
  if (value === "01/01/2001" || input.type === "date") {
    valorFinal = "2001-01-01";
  }

  input.focus();
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value",
  ).set;
  nativeInputValueSetter.call(input, valorFinal);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
  input.blur();
}

function prepararDadosEmail(id, nome, email) {
  const dadosEmail = {
    email: email,
    assunto: `${id} - ${nome}`,
    corpo: textoPadraoEmail,
  };
  chrome.storage.local.set({ dadosParaEmail: dadosEmail });
}

// --- 5. LÓGICA DE VOUCHERS E TÍTULOS ---

function extrairNomeVoucher() {
  let nome = "";
  const paragrafos = Array.from(document.querySelectorAll("p"));
  for (const p of paragrafos) {
    if (p.innerText.trim() === "Nome:") {
      const next = p.nextElementSibling;
      if (next) {
        nome = next.innerText.trim().toUpperCase();
        break;
      }
    }
  }

  let codigo = "";
  const chips = Array.from(
    document.querySelectorAll('span[class*="MuiChip-label"]'),
  );
  for (const chip of chips) {
    if (/^[A-Z0-9]+-\d+$/.test(chip.innerText.trim())) {
      codigo = chip.innerText.trim();
      break;
    }
  }

  return nome && codigo ? `${codigo} - ${nome}.pdf` : null;
}

function salvarNomeVoucherNoStorage() {
  const filename = extrairNomeVoucher();
  if (filename) {
    chrome.storage.local.set({ nomeVoucherAtual: filename });
  }
}

salvarNomeVoucherNoStorage();

const observerVoucher = new MutationObserver(salvarNomeVoucherNoStorage);
observerVoucher.observe(document.body, { childList: true, subtree: true });

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "GET_NOME_VOUCHER") {
    const filename = extrairNomeVoucher();
    sendResponse(filename ? { filename } : {});
  }
  return true;
});

function renomear() {
  const texto = document.body.innerText;
  const regCod = /Código da Compra:\s*([A-Z0-9]+)/i;
  const regNome = /Nome Completo:\s*([^\n\r]+)/i;
  const mCod = texto.match(regCod);
  const mNome = texto.match(regNome);
  if (mCod && mNome) {
    const resultado = `${mCod[1].trim()} - ${mNome[1].trim().toUpperCase()}`;
    document.title = resultado;
    if (window.top !== window.self) window.top.document.title = resultado;
  }
}
setInterval(renomear, 1000);