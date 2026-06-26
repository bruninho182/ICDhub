console.log("✅ ICD Hub: Ativado (Versão TicketGo + Voucher Fix + Navio + Renomeador Híbrido)");

// --- 1. MONITORAMENTO DE DADOS ---

chrome.storage.local.get(
  [
    "dadosPedido",
    "nomeOperador",
    "bridgeData",
    "reservaGrayline",
    "ticketgoData", 
    "navioDataBridge",
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
        "ticketgoData", 
        "navioDataBridge",
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
    // Prioridade Navio
    if (res.navioDataBridge)
      return preencherNovoSistemaICD(res.navioDataBridge, res.nomeOperador, "Navio");

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

// ============================================================
// ========== FUNÇÕES DE EXTRAÇÃO E LIMPEZA (CORRIGIDAS) ======
// ============================================================

function limparNome(texto) {
    if (!texto) return '';
    
    // Remove tudo que parece ser email
    texto = texto.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '');
    
    // Remove tudo que parece ser telefone (com +, números, parênteses, traços, pontos)
    texto = texto.replace(/[\+]?\d{1,3}[-.\s]?\(?\d{2,3}\)?[-.\s]?\d{4,5}[-.\s]?\d{4}/g, '');
    texto = texto.replace(/[\+]?\d{10,15}/g, '');
    texto = texto.replace(/\(?\d{2,3}\)?[-.\s]?\d{4,5}[-.\s]?\d{4}/g, '');
    
    // Remove "CUSTOMER-", "REPLY.GET..." e outras palavras-chave
    texto = texto.replace(/CUSTOMER-[A-Z0-9]+/gi, '');
    texto = texto.replace(/REPLY\.GETYOURGUIDE\.COM/gi, '');
    texto = texto.replace(/GETYOURGUIDE/gi, '');
    texto = texto.replace(/CUSTOMER/gi, '');
    
    // Remove qualquer sequência de letras maiúsculas e números com 8+ caracteres (códigos)
    texto = texto.replace(/[A-Z0-9]{8,}/g, '');
    
    // Remove tudo que não é letra (inclui números, símbolos, etc)
    texto = texto.replace(/[^a-zA-ZÀ-ÿ\s]/g, '');
    
    // Remove espaços extras
    texto = texto.replace(/\s+/g, ' ').trim();
    
    // Se ainda tiver mais de 3 palavras, pega só as duas primeiras que parecem nomes
    const words = texto.split(' ');
    if (words.length > 3) {
        let nomeLimpo = '';
        let count = 0;
        for (const word of words) {
            // Palavra que parece nome (começa com maiúscula e tem mais de 1 letra)
            if (/^[A-ZÀ-ÿ][a-zà-ÿ]+$/.test(word) && word.length > 1) {
                nomeLimpo += word + ' ';
                count++;
                if (count >= 2) break;
            }
        }
        texto = nomeLimpo.trim();
    }
    
    // Se ainda tiver vazio, tenta pegar duas palavras quaisquer
    if (!texto || texto.length < 3) {
        const match = texto.match(/([A-ZÀ-ÿ][a-zà-ÿ]+(?:\s+[A-ZÀ-ÿ][a-zà-ÿ]+)?)/);
        if (match) texto = match[1];
    }
    
    return texto;
}

function extrairNomeCliente() {
    const bodyText = document.body.innerText;
    
    // 1. Tenta encontrar a seção "Dados do Cliente"
    const sectionRegex = /Dados do Cliente[\s\S]*?(?=Telefone|E-mail|Email|Número|Data|País|Sexo|$)/i;
    const sectionMatch = bodyText.match(sectionRegex);
    if (sectionMatch) {
        const section = sectionMatch[0];
        // Procura por "Nome:" seguido de algo
        const nomeMatch = section.match(/Nome\s*[:]\s*([^\n]+?)(?=\s*(?:Telefone|E-mail|Email|Número|Data|País|Sexo|$))/i);
        if (nomeMatch) {
            let nome = nomeMatch[1].trim();
            // Remove tudo que não é letra (incluindo números, @, +, etc)
            nome = nome.replace(/[^a-zA-Z\s]/g, '').trim();
            // Se tiver mais de 2 palavras, pega só as duas primeiras
            const parts = nome.split(/\s+/);
            if (parts.length > 2) {
                nome = parts.slice(0, 2).join(' ');
            }
            if (nome.length > 2) {
                console.log("👤 Nome extraído da seção:", nome);
                return nome;
            }
        }
    }
    
    // 2. Fallback: procura por "Nome:" em qualquer lugar
    const nomeMatch2 = bodyText.match(/Nome\s*[:]\s*([^\n]+?)(?=\s*(?:Telefone|E-mail|Email|Número|Data|País|Sexo|$))/i);
    if (nomeMatch2) {
        let nome = nomeMatch2[1].trim();
        nome = nome.replace(/[^a-zA-Z\s]/g, '').trim();
        const parts = nome.split(/\s+/);
        if (parts.length > 2) {
            nome = parts.slice(0, 2).join(' ');
        }
        if (nome.length > 2) {
            console.log("👤 Nome extraído via fallback:", nome);
            return nome;
        }
    }
    
    // 3. Último recurso: procura por duas palavras maiúsculas (nome e sobrenome)
    const namePattern = /([A-Z][a-zÀ-ÿ]+(?:\s+[A-Z][a-zÀ-ÿ]+))/g;
    const matches = bodyText.match(namePattern);
    if (matches) {
        for (const match of matches) {
            // Verifica se não tem números ou @
            if (!/\d/.test(match) && !match.includes('@')) {
                console.log("👤 Nome extraído via padrão:", match);
                return match;
            }
        }
    }
    
    console.log("⚠️ Nenhum nome encontrado");
    return '';
}

function extrairEmailCliente() {
    const bodyText = document.body.innerText;
    const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const matches = bodyText.match(emailPattern);
    if (matches && matches.length > 0) {
        for (const email of matches) {
            if (!email.includes('reply.getyourguide.com')) {
                return email;
            }
        }
        return matches[0];
    }
    return '';
}

function extrairTelefoneCliente() {
    const bodyText = document.body.innerText;
    const phonePatterns = [
        /\+\d{1,3}[-.\s]?\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{1,4}/g,
        /\(?\d{2,3}\)?[-.\s]?\d{4,5}[-.\s]?\d{4}/g,
        /\+\d{10,15}/g
    ];
    
    for (const pattern of phonePatterns) {
        const matches = bodyText.match(pattern);
        if (matches && matches.length > 0) {
            for (const phone of matches) {
                if (phone.length > 6 && !phone.includes('@')) {
                    return phone.trim();
                }
            }
        }
    }
    return '';
}

// --- 3. EXTRAÇÃO DE DADOS GETYOURGUIDE ---

function extrairDadosGYG() {
    const dados = {
        gyg: '',
        nome: '',
        email: '',
        telefone: '',
        passeio: '',
        data: '',
        adultos: 0,
        criancas: 0
    };
    
    try {
        // 1. Código da reserva
        const tituloElement = document.querySelector('h1.text-title-3, .p-dialog-title, [data-testid="booking-reference"]');
        if (tituloElement) {
            const texto = tituloElement.textContent.trim();
            const match = texto.match(/GYG\d+/i);
            if (match) {
                dados.gyg = match[0];
            } else {
                const urlMatch = window.location.href.match(/GYG\d+/i);
                if (urlMatch) dados.gyg = urlMatch[0];
            }
        }
        
        // 2. Nome - usando a função melhorada
        const nome = extrairNomeCliente();
        if (nome) {
            dados.nome = nome;
        }
        
        // 3. E-mail
        const email = extrairEmailCliente();
        if (email) {
            dados.email = email;
        }
        
        // 4. Telefone
        const telefone = extrairTelefoneCliente();
        if (telefone) {
            dados.telefone = telefone;
        }
        
        // 5. Nome do passeio
        const passeioSelectors = [
            'h2.text-title-3',
            '.text-label-primary.font-bold.text-title-4',
            '[data-testid="product-name"]',
            '.p-dialog .font-bold.text-body'
        ];
        for (const selector of passeioSelectors) {
            const el = document.querySelector(selector);
            if (el) {
                dados.passeio = el.textContent.trim();
                break;
            }
        }
        
        // 6. Data
        const allText = document.body.innerText;
        const datePattern = /\d{1,2}\/\d{1,2}\/\d{4}/;
        const dateMatch = allText.match(datePattern);
        if (dateMatch) {
            dados.data = dateMatch[0];
        }
        
        // 7. Quantidade
        const adultMatch = allText.match(/(\d+)\s*(?:adulto|adultos|adult|pax)/i);
        if (adultMatch) {
            dados.adultos = parseInt(adultMatch[1]);
        }
        
        const childMatch = allText.match(/(\d+)\s*(?:criança|crianças|child|children)/i);
        if (childMatch) {
            dados.criancas = parseInt(childMatch[1]);
        }
        
        console.log("📊 Dados extraídos da GetYourGuide:", dados);
        return dados;
        
    } catch (error) {
        console.error("❌ Erro ao extrair dados:", error);
        return null;
    }
}

// --- 4. SNIPER MUI (SISTEMA NOVO) ---

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

  // Cria uma cópia para não modificar o original
  let dadosCompletos = { ...dados };

  // Se for GYG, aplica limpeza agressiva no nome
  if (dataType === "GYG") {
    // Limpa o nome vindo do storage
    if (dadosCompletos.nome) {
      dadosCompletos.nome = limparNome(dadosCompletos.nome);
      console.log("🧹 Nome limpo (storage):", dadosCompletos.nome);
    }
    if (dadosCompletos.nomeCliente) {
      dadosCompletos.nomeCliente = limparNome(dadosCompletos.nomeCliente);
    }
    
    // Se depois de limpar ainda estiver vazio ou muito curto, tenta extrair da página
    if (!dadosCompletos.nome || dadosCompletos.nome.length < 2) {
      const extraidos = extrairDadosGYG();
      if (extraidos && extraidos.nome) {
        dadosCompletos.nome = extraidos.nome;
        console.log("🧹 Nome limpo (extração):", dadosCompletos.nome);
      }
    }
  }

  const idReserva = dadosCompletos.orderNumber || dadosCompletos.gyg || dadosCompletos.bookingId || dadosCompletos.idOriginal || "";
  const refExterna = `${idReserva} - ${operador || "OPERADOR"}`;

  const mapeamento = [
    { busca: "E-mail", valor: dadosCompletos.email || dadosCompletos.emailCliente || "" },
    { busca: "Nome", valor: dadosCompletos.nome || dadosCompletos.nomeCliente || "" },
    { busca: "Telefone", valor: dadosCompletos.telefone || dadosCompletos.telefoneCliente || "" },
    { busca: "Número do documento", valor: idReserva },
    { busca: "Referência Externa", valor: refExterna },
    { busca: "nascimento", valor: "01/01/2001" },
  ];

  let count = 0;
  mapeamento.forEach((item) => {
    const f = findInputByMuiText(item.busca);
    if (f && f.input) {
      let valorFinal = item.valor;
      // Se for o campo "Nome", aplica limpeza novamente para garantir
      if (item.busca === "Nome" && dataType !== "Navio") {
    valorFinal = limparNome(valorFinal);
}
      forceReactValue(f.input, valorFinal);
      count++;
    }
  });

  selecionarBarraMui("País", "Brasil");
  setTimeout(() => selecionarBarraMui("Sexo", "Não informado"), 800);

  if (count > 0) {
    const emailParaEnvio = dadosCompletos.email || dadosCompletos.emailCliente || "";
    const nomeParaEnvio = dadosCompletos.nome || dadosCompletos.nomeCliente || "";
    prepararDadosEmail(idReserva, nomeParaEnvio, emailParaEnvio);
    
    setTimeout(() => {
      let keysToRemove = [];
      if (dataType === "TicketGo") keysToRemove = ["ticketgoData"];
      else if (dataType === "Navio") keysToRemove = ["navioDataBridge"];
      else if (dataType === "GYG") keysToRemove = ["dadosPedido"];
      else keysToRemove = ["bridgeData", "reservaGrayline"];
      
      chrome.storage.local.remove(keysToRemove);
    }, 5000);
    return true;
  }
  return false;
}

// --- 5. FUNÇÕES DE SUPORTE E SISTEMA ANTIGO ---

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
  
  const extraidos = extrairDadosGYG();
  const dadosCompletos = { ...dados, ...extraidos };
  
  const valorCV = `${dadosCompletos.gyg} - ${nomeOperador || "OPERADOR"}`;
  const campos = [
    { nome: "sAge_Nome", valor: dadosCompletos.nome },
    { nome: "sAge_Email", valor: dadosCompletos.email },
    { nome: "sAge_CPF", valor: dadosCompletos.gyg },
    { nome: "_sVen_Cartao", valor: valorCV },
  ];
  campos.forEach((c) => {
    const el = document.getElementsByName(c.nome)[0];
    if (el) forceReactValue(el, c.valor);
  });
  prepararDadosEmail(dadosCompletos.gyg, dadosCompletos.nome, dadosCompletos.email);
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

// --- 6. LÓGICA DE VOUCHERS E TÍTULOS ---

function extrairNomeVoucher() {
  let nome = "";
  let codigo = "";
  
  const paragrafos = Array.from(document.querySelectorAll("p"));
  for (const p of paragrafos) {
    if (p.innerText.trim() === "Nome:" || p.innerText.trim() === "Name:") {
      const next = p.nextElementSibling;
      if (next) {
        nome = limparNome(next.innerText.trim().toUpperCase());
        break;
      }
    }
  }

  const chips = Array.from(
    document.querySelectorAll('span[class*="MuiChip-label"], .p-chip, [class*="chip"]'),
  );
  for (const chip of chips) {
    const text = chip.innerText.trim();
    if (/^[A-Z0-9]+-\d+$/.test(text) || /^GYG\d+/.test(text)) {
      codigo = text;
      break;
    }
  }

  if (!codigo || !nome) {
    const texto = document.body.innerText;
    const regCod = /Código da Compra:\s*([A-Z0-9]+)/i;
    const regNome = /Nome Completo:\s*([^\n\r]+)/i;
    const mCod = texto.match(regCod);
    const mNome = texto.match(regNome);
    if (mCod && !codigo) codigo = mCod[1].trim();
    if (mNome && !nome) nome = limparNome(mNome[1].trim().toUpperCase());
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

// --- 7. RENOMEADOR HÍBRIDO ---

function renomearAba() {
  let resultado = null;

  const nomeNovoSistema = extrairNomeVoucher();
  if (nomeNovoSistema) {
    resultado = nomeNovoSistema.replace('.pdf', '');
  } 
  
  if (!resultado) {
    const texto = document.body.innerText;
    const regCod = /Código da Compra:\s*([A-Z0-9]+)/i;
    const regNome = /Nome Completo:\s*([^\n\r]+)/i;
    const mCod = texto.match(regCod);
    const mNome = texto.match(regNome);
    if (mCod && mNome) {
      resultado = `${mCod[1].trim()} - ${limparNome(mNome[1].trim().toUpperCase())}`;
    }
  }
  
  if (!resultado) {
    const titulo = document.title;
    const match = titulo.match(/GYG\d+/i);
    if (match) {
      const nomeMatch = document.body.innerText.match(/Nome[:\s]+([^\n]+)/i);
      if (nomeMatch) {
        resultado = `${match[0]} - ${limparNome(nomeMatch[1].trim().toUpperCase())}`;
      }
    }
  }

  if (resultado && document.title !== resultado) {
    document.title = resultado;
    if (window.top !== window.self) window.top.document.title = resultado;
    console.log("📌 Aba renomeada para:", resultado);
  }
}

setInterval(renomearAba, 1000);

console.log("✅ ICD Hub: Todos os sistemas carregados e prontos!");