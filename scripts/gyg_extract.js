function extrairNomeCompletoGetYourGuide() {
    const bodyText = document.body.innerText;
    let nomeCompleto = '';

    // Estratégia 1: Lead traveler
    const leadMatch = bodyText.match(/Lead traveler\s*([^\n]+)/i);
    if (leadMatch) {
        let nome = leadMatch[1].trim();
        nome = nome.split('(')[0].trim();
        nome = limparNomeGYG(nome);
        if (nome) return nome;
    }

    // Estratégia 2: Dados do Cliente
    const clienteSection = bodyText.match(/Dados do Cliente[\s\S]*?Nome:\s*([^\n]+)/i);
    if (clienteSection) {
        let nome = clienteSection[1].trim();
        nome = limparNomeGYG(nome);
        if (nome) return nome;
    }

    // Estratégia 3: Página de bookings - código GYG seguido de nome
    const bookingRegex = /GYG[A-Z0-9]+\s*\n\s*([A-Z][a-zÀ-ÿ]+(?:\s+[A-Z][a-zÀ-ÿ]+)+)/i;
    const match = bodyText.match(bookingRegex);
    if (match && match[1]) {
        let nome = limparNomeGYG(match[1].trim());
        if (nome) return nome;
    }

    // Estratégia 4: Nome antes de telefone
    const phoneNameRegex = /([A-Z][a-zÀ-ÿ]+(?:\s+[A-Z][a-zÀ-ÿ]+)+)\s*\n\s*\+\d+/i;
    const phoneMatch = bodyText.match(phoneNameRegex);
    if (phoneMatch && phoneMatch[1]) {
        let nome = limparNomeGYG(phoneMatch[1].trim());
        if (nome) return nome;
    }

    // Estratégia 5: Padrão de duas palavras maiúsculas
    const namePattern = /([A-Z][a-zÀ-ÿ]+(?:\s+[A-Z][a-zÀ-ÿ]+)+)/g;
    const matches = bodyText.match(namePattern);
    if (matches) {
        for (const match of matches) {
            if (!/\d/.test(match) && !match.includes('@')) {
                let nome = limparNomeGYG(match);
                if (nome) return nome;
            }
        }
    }

    return '';
}

function limparNomeGYG(texto) {
    if (!texto) return '';
    texto = texto.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '');
    texto = texto.replace(/[\+]?\d{1,3}[-.\s]?\(?\d{2,3}\)?[-.\s]?\d{4,5}[-.\s]?\d{4}/g, '');
    texto = texto.replace(/[\+]?\d{10,15}/g, '');
    texto = texto.replace(/\(?\d{2,3}\)?[-.\s]?\d{4,5}[-.\s]?\d{4}/g, '');
    texto = texto.replace(/CUSTOMER-[A-Z0-9]+/gi, '');
    texto = texto.replace(/REPLY\.GETYOURGUIDE\.COM/gi, '');
    texto = texto.replace(/GETYOURGUIDE/gi, '');
    texto = texto.replace(/CUSTOMER/gi, '');
    texto = texto.replace(/[A-Z0-9]{8,}/g, '');
    texto = texto.replace(/[^a-zA-ZÀ-ÿ\s]/g, '');
    texto = texto.replace(/\s+/g, ' ').trim();
    // Se tiver mais de 3 palavras, pega apenas as duas primeiras que parecem nomes
    const words = texto.split(' ');
    if (words.length > 3) {
        let nomeLimpo = '';
        let count = 0;
        for (const word of words) {
            if (/^[A-ZÀ-ÿ]/.test(word) && word.length > 1) {
                nomeLimpo += word + ' ';
                count++;
                if (count >= 2) break;
            }
        }
        texto = nomeLimpo.trim();
    }
    return texto;
}

function extrairDados() {
    const codigoGYG = document.body.innerText.match(/GYG[A-Z0-9]+/)?.[0] || "";
    const nomeCompleto = extrairNomeCompletoGetYourGuide() || "";
    const emailMatch = document.body.innerText.match(/customer-[\w.-]+@[\w.-]+/);
    const email = emailMatch ? emailMatch[0] : "";
    const linkTelefone = document.querySelector('a[href^="tel:"]');
    const telefone = linkTelefone ? linkTelefone.innerText.trim() : "";

    if (nomeCompleto && codigoGYG) {
        const dados = { 
            nome: nomeCompleto, 
            email: email, 
            gyg: codigoGYG,
            telefone: telefone,
            origem: "GETYOURGUIDE" 
        };
        chrome.storage.local.set({ dadosPedido: dados }, () => {
            try {
                chrome.runtime.sendMessage({ acao: "DADOS_PRONTOS", dados: dados });
            } catch (e) { 
                console.log("Aviso: mensagem não enviada, mas dados salvos.");
            }
            alert(`✅ Capturado!\n👤 ${nomeCompleto}\n🎫 ${codigoGYG}\n📞 ${telefone || "Não encontrado"}`);
        });
    } else {
        alert(`⚠️ Dados não encontrados.\nNome: "${nomeCompleto || 'não encontrado'}"\nCódigo: "${codigoGYG || 'não encontrado'}"`);
    }
}

function renderizarBotao() {
    if (document.getElementById('btn-copy-gyg')) return;
    const btn = document.createElement("button");
    btn.id = 'btn-copy-gyg';
    const logoUrl = chrome.runtime.getURL("icon.png"); 
    btn.innerHTML = `<img src="${logoUrl}" style="width:24px;height:24px;margin-right:10px;border-radius:4px;"><span>COPIAR PARA APP</span>`;
    btn.style = "position:fixed;top:100px;right:20px;z-index:9999;padding:12px 20px;background:#ff5a00;color:white;border:none;border-radius:8px;cursor:pointer;font-weight:bold;display:flex;align-items:center;box-shadow: 0 4px 15px rgba(0,0,0,0.4);font-family: Arial;";
    btn.onclick = extrairDados;
    document.body.appendChild(btn);
}

renderizarBotao();
setTimeout(renderizarBotao, 3000);