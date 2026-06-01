console.log("🟢 Bridge Civitatis: Leitor de PDF Ativado!");

function criarZonaDropPDF() {
    if (document.getElementById('civitatis-drop-zone')) return;

    const dropZone = document.createElement('div');
    dropZone.id = 'civitatis-drop-zone';
    dropZone.innerHTML = `
        <div style="font-size: 24px;">📄</div>
        <div>Arraste o Voucher Civitatis (PDF) aqui</div>
    `;
    // Aumentamos o z-index para 999999 e baixamos um pouco (top: 90px) para fugir do menu do site
    dropZone.style = `
        position: fixed; top: 90px; right: 20px; z-index: 999999;
        width: 250px; padding: 20px; background: #612d87; color: white;
        border: 2px dashed rgba(255,255,255,0.6); border-radius: 10px;
        text-align: center; font-family: sans-serif; font-weight: bold;
        box-shadow: 0 4px 10px rgba(0,0,0,0.3); transition: all 0.3s;
    `;

    // Efeitos visuais ao arrastar
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.style.background = '#4a2268';
        dropZone.style.transform = 'scale(1.05)';
    });

    dropZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dropZone.style.background = '#612d87';
        dropZone.style.transform = 'scale(1)';
    });

    // O momento mágico: Soltar o arquivo
    dropZone.addEventListener('drop', async (e) => {
        e.preventDefault();
        dropZone.style.background = '#612d87';
        dropZone.style.transform = 'scale(1)';

        const arquivo = e.dataTransfer.files[0];
        if (!arquivo || arquivo.type !== "application/pdf") {
            alert("⚠️ Por favor, arraste apenas arquivos PDF!");
            return;
        }

        dropZone.innerHTML = "⏳ Lendo PDF...";

        // Processa o PDF
        const dadosExtraidos = await lerPDFCivitatis(arquivo);
        
        if (dadosExtraidos.nome) {
            chrome.storage.local.set({ navioDataBridge: dadosExtraidos }, () => {
                dropZone.innerHTML = "✅ Dados Copiados!<br><small>Abra o sistema ICD</small>";
                dropZone.style.background = '#25D366';
                setTimeout(() => dropZone.remove(), 4000); // Some depois de 4s
            });
        } else {
            dropZone.innerHTML = "❌ Erro na leitura.<br><small>Tente novamente.</small>";
            dropZone.style.background = 'red';
            setTimeout(() => dropZone.remove(), 4000);
        }
    });

    document.body.appendChild(dropZone);
}

setInterval(criarZonaDropPDF, 2000);

// ==========================================
// 🔍 O CÉREBRO: LÓGICA DE EXTRAÇÃO DO PDF (SEM WORKER)
// ==========================================
async function lerPDFCivitatis(arquivo) {
    // A maioria das versões expõe a biblioteca na variável global 'pdfjsLib'
    const pdfjs = window.pdfjsLib || window['pdfjs-dist/build/pdf'];

    if (!pdfjs) {
        alert("Erro: Biblioteca pdf.js não carregada! Verifique o manifest.");
        return {};
    }

    // 🔴 O SEGREDO: Força a rodar direto na memória principal, burlando o bloqueio do Chrome
    pdfjs.GlobalWorkerOptions.workerSrc = '';

    try {
        const arrayBuffer = await arquivo.arrayBuffer();
        const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
        
        const pagina = await pdf.getPage(1);
        const conteudo = await pagina.getTextContent();
        const textoCompleto = conteudo.items.map(item => item.str).join(" ");

        let idReserva = "SEM_ID";
        const regexNomeArquivo = /voucher-([A-Z0-9]+)\.pdf/i;
        const matchId = arquivo.name.match(regexNomeArquivo);
        
        if (matchId) {
            idReserva = matchId[1];
        } else {
            const matchIdTexto = textoCompleto.match(/PERSONE\/PAX\s*([A-Z0-9]{8,})/i);
            if (matchIdTexto) idReserva = matchIdTexto[1];
        }

      // ==========================================
        // 2. Extração de Nome, Email e Telefone (NOVA LÓGICA BLINDADA E LIMPA)
        // ==========================================
        let nome = "", email = "", telefone = "";

        // a) Caça o E-mail isoladamente em qualquer lugar do texto
        const matchEmail = textoCompleto.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
        if (matchEmail) email = matchEmail[0];

        // b) Caça o Telefone isoladamente (Procura o padrão (+XX) 99999999)
        const matchTelefone = textoCompleto.match(/\(\+\d{1,4}\)\s?[\d\s-]{7,15}/);
        if (matchTelefone) telefone = matchTelefone[0];

        // c) Caça o Nome (Busca inteligente baseada na posição do E-mail)
        if (email !== "") {
            const emailBusca = email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            
            // Tática 1: Busca qualquer texto que esteja entre a palavra "DETAILS" e o E-mail
            const regexNome = new RegExp(`DETAILS\\s+(.*?)\\s+${emailBusca}`, 'i');
            const matchNome = textoCompleto.match(regexNome);
            
            if (matchNome && matchNome[1] && matchNome[1].trim() !== "") {
                nome = matchNome[1].trim();
            } else {
                // Tática 2: Captura palavras ANTES do e-mail
                const regexFallback = new RegExp(`((?:\\S+\\s+){1,4})${emailBusca}`, 'i');
                const matchFallback = textoCompleto.match(regexFallback);
                if (matchFallback && matchFallback[1]) nome = matchFallback[1];
            }

            // Remove palavras indesejadas (PAX, PERSONE, CLIENTE), números (\d+) e barras.
            nome = nome.replace(/CLIENTE|GUEST|DETAILS|DATI|DEL|PERSONE|PAX|\d+|\/|-/gi, '');
            
            // Remove espaços duplos que sobraram após a limpeza e apara as pontas
            nome = nome.replace(/\s+/g, ' ').trim();
        }

        // Limpa também espaços extras no final do telefone, se houver
        if (telefone !== "") telefone = telefone.trim();

        console.log("🔍 Extração Civitatis Concluída:", { idReserva, nome, email, telefone });

        return {
            idOriginal: idReserva,
            nome: nome,
            email: email,
            telefone: telefone
        };

    } catch (erro) {
        console.error("❌ Erro ao ler PDF:", erro);
        return {};
    }
}