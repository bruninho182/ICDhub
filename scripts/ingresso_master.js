console.log("✅ ICD Hub: Maestro do Ingresso com Desconto Ativado (Versão Híbrida 2.5)");


chrome.storage.local.get(["dadosPedido", "nomeOperador", "bridgeData", "reservaGrayline", "usuarioConfigurado"], (res) => {
    executarComTentativas(res);
});

chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local') {
        chrome.storage.local.get(["nomeOperador", "usuarioConfigurado", "dadosPedido", "bridgeData", "reservaGrayline"], (res) => {
            executarComTentativas(res);
        });
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
        if (res.dadosPedido) return preencherNovoSistemaICD(res.dadosPedido, res.nomeOperador, "GYG");
        if (res.bridgeData) return preencherNovoSistemaICD(res.bridgeData, res.usuarioConfigurado, "Bridge");
        if (res.reservaGrayline) return preencherNovoSistemaICD(res.reservaGrayline, res.usuarioConfigurado, "Grayline");
    } else {
        // Sistema Antigo
        if (res.dadosPedido) preencherCamposGYG(res.dadosPedido, res.nomeOperador);
        if (res.bridgeData) preencherHeadoutGrayline(res.bridgeData, res.usuarioConfigurado);
        if (res.reservaGrayline) preencherHeadoutGrayline(res.reservaGrayline, res.usuarioConfigurado);
        return true; 
    }
    return false;
}

// --- 2. CONFIGURAÇÕES ---

const textoPadraoEmail = `Dear visitor,

Thank you for choosing us!

Your coupon is attached to this email.

We hope you enjoy your visit!

If something prevents you from visiting on your chosen date or time, you can reschedule your tickets by replying to this email or the service channels below:

WhatsApp: (11) 93328-0358 / (11) 93495-1053
Phone: (11) 3939-0435 / (21) 4063-3003

We are at your disposal!

Best regards,`;


function findInputByMuiText(term) {
    const textToFind = term.toLowerCase();
    const elements = Array.from(document.querySelectorAll('span, label, p, legend'));
    const target = elements.find(el => el.innerText.toLowerCase().trim().includes(textToFind));

    if (target) {
        const container = target.closest('.MuiFormControl-root, .MuiTextField-root, div.MuiGrid-item');
        if (container) {
            const input = container.querySelector('input');
            if (input) return input;
        }
    }
    return null;
}

function preencherNovoSistemaICD(dados, operador, dataType) {
    if (!dados) return false;

    const idReserva = dados.gyg || dados.bookingId || "";
    const refExterna = `${idReserva} - ${operador || "OPERADOR"}`;

    const mapeamento = [
        { busca: "E-mail", valor: dados.email },
        { busca: "Nome", valor: dados.nome },
        { busca: "Número do documento", valor: idReserva },
        { busca: "Referência Externa", valor: refExterna }
    ];

    let count = 0;
    mapeamento.forEach(item => {
        const input = findInputByMuiText(item.busca);
        if (input) {
            forceReactValue(input, item.valor);
            count++;
        }
    });

    if (count > 0) {
        prepararDadosEmail(idReserva, dados.nome, dados.email);
        setTimeout(() => {
            const keys = dataType === "GYG" ? ["dadosPedido"] : ["bridgeData", "reservaGrayline"];
            chrome.storage.local.remove(keys);
        }, 3000);
        return true;
    }
    return false;
}


function preencherAposTexto(numero, valor) {
    const todosElementos = Array.from(document.querySelectorAll('td, span, font, b'));
    const elementoAlvo = todosElementos.find(el => el.innerText.trim() === numero.toString());

    if (elementoAlvo) {
        const inputs = Array.from(document.querySelectorAll('input:not([type="hidden"]), select'));
        const inputCorreto = inputs.find(input => 
            elementoAlvo.compareDocumentPosition(input) & Node.DOCUMENT_POSITION_FOLLOWING
        );

        if (inputCorreto) {
            forceReactValue(inputCorreto, valor);
        }
    }
}

function preencherCamposGYG(dados, nomeOperador) {
    if (!dados) return;
    const valorCV = `${dados.gyg} - ${nomeOperador || "OPERADOR"}`;
    const campos = [
        { nome: 'sAge_Nome', valor: dados.nome },
        { nome: 'sAge_Email', valor: dados.email },
        { nome: 'sAge_CPF', valor: dados.gyg },
        { nome: '_sVen_Cartao', valor: valorCV }
    ];
    campos.forEach(c => {
        const el = document.getElementsByName(c.nome)[0];
        if (el) forceReactValue(el, c.valor);
    });

    prepararDadosEmail(dados.gyg, dados.nome, dados.email);
    setTimeout(() => { chrome.storage.local.remove("dadosPedido"); }, 2000);
}

function preencherHeadoutGrayline(d, nomeUsuario) {
    if (!d || !d.nome) return;
    const operador = nomeUsuario || "Sem Nome";
    
    preencherAposTexto(2, d.nome);
    preencherAposTexto(3, d.bookingId);
    preencherAposTexto(4, d.email);
    
    const valorFormatadoCV = `${d.bookingId} - ${operador}`;
    preencherAposTexto(15, valorFormatadoCV);
    
    prepararDadosEmail(d.bookingId, d.nome, d.email);

    console.log("✅ Preenchimento concluído! Dados de e-mail preparados.");
    setTimeout(() => { 
        chrome.storage.local.remove(["bridgeData", "reservaGrayline"]); 
    }, 2000);
}


function forceReactValue(input, value) {
    if (!input) return;
    input.focus();
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    nativeInputValueSetter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.blur();
}

function prepararDadosEmail(id, nome, email) {
    const dadosEmail = {
        email: email,
        assunto: `${id} - ${nome}`,
        corpo: textoPadraoEmail
    };
    chrome.storage.local.set({ dadosParaEmail: dadosEmail });
}

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