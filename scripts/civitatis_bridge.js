"use strict";

console.log("🟢 Bridge Civitatis 2.3: Leitor de PDF - Super Fatiador (Final)");

// ==========================================================
// 📄 CRIAÇÃO DA ÁREA DE DROP
// ==========================================================

let dropZoneCriada = false;

function criarZonaDropPDF() {
    if (document.getElementById('civitatis-drop-zone')) return;

    const dropZone = document.createElement('div');
    dropZone.id = 'civitatis-drop-zone';
    dropZone.innerHTML = `
        <div style="font-size: 24px;">📄</div>
        <div>Arraste o Voucher Civitatis (PDF) aqui</div>
    `;
    dropZone.style = `
        position: fixed; top: 90px; right: 20px; z-index: 999999;
        width: 260px; padding: 20px; background: #612d87; color: white;
        border: 2px dashed rgba(255,255,255,0.6); border-radius: 10px;
        text-align: center; font-family: sans-serif; font-weight: bold;
        box-shadow: 0 4px 10px rgba(0,0,0,0.3); transition: all 0.3s;
        cursor: pointer;
    `;

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

    dropZone.addEventListener('drop', async (e) => {
        e.preventDefault();
        dropZone.style.background = '#612d87';
        dropZone.style.transform = 'scale(1)';

        const arquivo = e.dataTransfer.files[0];
        if (!arquivo) return feedback(dropZone, '⚠️ Nenhum arquivo selecionado.', 'orange');
        if (arquivo.type !== "application/pdf" && !arquivo.name.toLowerCase().endsWith(".pdf")) {
            return feedback(dropZone, '⚠️ Apenas arquivos PDF!', 'orange');
        }

        dropZone.innerHTML = '⏳ Lendo PDF...<br><small>Aguarde alguns segundos</small>';

        try {
            const { dados, confianca } = await lerPDFCivitatis(arquivo);
            if (!dados || !dados.email) {
                console.error("❌ Dados extraídos:", dados);
                feedback(dropZone, '❌ Não foi possível identificar os dados.<br><small>Verifique o PDF.</small>', 'red', 5000);
                return;
            }

            if (confianca.nome >= 60 && confianca.email >= 60) {
                salvarNoStorage(dados, dropZone);
            } else {
                mostrarConfirmacao(dropZone, dados);
            }

        } catch (erro) {
            console.error("❌ Erro no processamento:", erro);
            feedback(dropZone, '❌ Erro na leitura do PDF.<br><small>Veja o console.</small>', 'red', 5000);
        }
    });

    document.body.appendChild(dropZone);
    dropZoneCriada = true;
}

function feedback(zona, msg, cor, timeout = 4000) {
    zona.innerHTML = msg;
    zona.style.background = cor;
    if (timeout > 0) {
        setTimeout(() => {
            if (zona.parentNode) zona.remove();
            dropZoneCriada = false;
        }, timeout);
    }
}

function salvarNoStorage(dados, zona) {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ navioDataBridge: dados }, () => {
            if (chrome.runtime.lastError) {
                console.error("❌ Erro ao salvar:", chrome.runtime.lastError);
                feedback(zona, '❌ Erro ao salvar os dados.', 'red');
                return;
            }
            console.log("✅ Dados enviados para o ICD:", dados);
            feedback(zona, '✅ Dados Copiados!<br><small>Abra o sistema ICD</small>', '#25D366', 4000);
        });
    } else {
        console.warn('chrome.storage indisponível – debug:', dados);
        feedback(zona, '✅ Dados extraídos (modo debug).', '#25D366', 4000);
    }
}

function mostrarConfirmacao(zona, dados) {
    zona.innerHTML = `
        <div style="font-size: 16px;">⚠️ Confiança baixa</div>
        <div style="font-size: 13px; margin: 8px 0; line-height: 1.4;">
            <b>Reserva:</b> ${dados.idOriginal || '---'}<br>
            <b>Nome:</b> ${dados.nome || '---'}<br>
            <b>E-mail:</b> ${dados.email || '---'}<br>
            <b>Telefone:</b> ${dados.telefone || '---'}
        </div>
        <button id="civitatis-confirmar" style="
            margin-top: 8px; padding: 6px 12px; background: #25D366; color: white;
            border: none; border-radius: 4px; cursor: pointer; font-weight: bold;
        ">Usar mesmo assim</button>
        <button id="civitatis-cancelar" style="
            margin-top: 8px; margin-left: 6px; padding: 6px 12px; background: #ccc;
            border: none; border-radius: 4px; cursor: pointer;
        ">Cancelar</button>
    `;
    zona.style.background = '#e67e22';
    zona.style.cursor = 'default';
    zona.style.pointerEvents = 'auto';

    document.getElementById('civitatis-confirmar').addEventListener('click', () => {
        salvarNoStorage(dados, zona);
    });
    document.getElementById('civitatis-cancelar').addEventListener('click', () => {
        feedback(zona, '❌ Operação cancelada', 'red', 3000);
    });
}

// ==========================================================
// 🔁 INICIALIZAÇÃO INTELIGENTE
// ==========================================================
function verificarZonaDrop() {
    if (!dropZoneCriada || !document.getElementById('civitatis-drop-zone')) {
        criarZonaDropPDF();
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', verificarZonaDrop);
} else {
    verificarZonaDrop();
}

const observer = new MutationObserver(() => {
    if (!document.getElementById('civitatis-drop-zone')) {
        dropZoneCriada = false;
        verificarZonaDrop();
    }
});
observer.observe(document.body, { childList: true, subtree: true });

// ==========================================================
// 🔍 LEITURA DO PDF (MODULAR)
// ==========================================================
async function lerPDFCivitatis(arquivo) {
    const pdfjs = window.pdfjsLib || window['pdfjs-dist/build/pdf'];
    if (!pdfjs) {
        console.error("pdf.js não carregado.");
        return { dados: null, confianca: {} };
    }

    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
        pdfjs.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('pdf.worker.min.js');
    } else {
        pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }

    try {
        const arrayBuffer = await arquivo.arrayBuffer();
        const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
        
        const linhas = [];
        for (let i = 1; i <= pdf.numPages; i++) {
            const pagina = await pdf.getPage(i);
            const conteudo = await pagina.getTextContent();
            const itens = conteudo.items.filter(item => item.str && item.str.trim());
            const grupos = [];

            itens.forEach(item => {
                const x = item.transform[4];
                const y = item.transform[5];
                let grupo = grupos.find(g => Math.abs(g.y - y) < 3);
                if (!grupo) {
                    grupo = { y, itens: [] };
                    grupos.push(grupo);
                }
                grupo.itens.push({ x, texto: item.str });
            });

            grupos.sort((a, b) => b.y - a.y);
            grupos.forEach(grupo => {
                grupo.itens.sort((a, b) => a.x - b.x);
                const linha = grupo.itens.map(i => i.texto).join(' ').replace(/\s+/g, ' ').trim();
                if (linha) linhas.push({ texto: linha, y: grupo.y });
            });
        }

        let dados = extrairDados(linhas, arquivo.name);
        const confianca = calcularConfianca(dados, linhas);

        return { dados, confianca };

    } catch (erro) {
        console.error("❌ Erro ao ler PDF:", erro);
        return { dados: null, confianca: {} };
    }
}

// ==========================================================
// 🔎 EXTRAÇÃO POR REGIÃO
// ==========================================================
function extrairDados(linhas, nomeArquivo) {
    let idReserva = 'SEM_ID';
    const matchArquivo = nomeArquivo.match(/voucher-([A-Z0-9]+)\.pdf/i);
    if (matchArquivo) idReserva = matchArquivo[1];
    else {
        const matchTexto = linhas.map(l => l.texto).join('\n').match(/\b[A-Z]\d{7,}\b/i);
        if (matchTexto) idReserva = matchTexto[0];
    }

    const marcadorRegex = /guest\s*details|dati\s+del\s+cliente|datos\s+del\s+cliente/i;
    let idxMarcador = -1;
    for (let i = 0; i < linhas.length; i++) {
        if (marcadorRegex.test(linhas[i].texto)) {
            idxMarcador = i;
            break;
        }
    }

    let email = '', nome = '', telefone = '';

    if (idxMarcador !== -1) {
        const regiao = linhas.slice(idxMarcador + 1);
        const { emailTexto, emailEndIdx } = encontrarEmail(regiao);
        if (emailTexto) {
            email = emailTexto;
            const emailGlobalIdx = idxMarcador + 1 + emailEndIdx;
            nome = extrairNome(linhas, emailGlobalIdx, idxMarcador);
            telefone = extrairTelefone(regiao, emailEndIdx);
        }
    }

    if (!email) {
        const { emailTexto, emailEndIdx } = encontrarEmail(linhas);
        if (emailTexto) {
            email = emailTexto;
            nome = extrairNome(linhas, emailEndIdx, -1);
            const linhasApos = linhas.slice(emailEndIdx + 1);
            telefone = extrairTelefone(linhasApos, -1);
        }
    }

    return {
        idOriginal: idReserva,
        nome,
        email,
        telefone
    };
}

// ==========================================================
// 🛠️ AUXILIARES DE EXTRAÇÃO AVANÇADA
// ==========================================================
function encontrarEmail(linhas) {
    for (let i = 0; i < linhas.length; i++) {
        const linha = linhas[i].texto;
        const match = linha.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
        if (match) return { emailTexto: match[0], emailEndIdx: i };

        if (linha.includes('@')) {
            let candidato = linha.replace(/\s+/g, '');
            for (let j = i + 1; j < linhas.length && (j - i) < 3; j++) {
                candidato += linhas[j].texto.replace(/\s+/g, '');
                const matchJuncao = candidato.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
                if (matchJuncao) return { emailTexto: matchJuncao[0], emailEndIdx: j };
                if (candidato.length > 80) break;
            }
        }
    }
    return { emailTexto: '', emailEndIdx: -1 };
}

function extrairNome(linhas, emailIdx, idxMarcador = -1) {
    const tentarExtrair = (textoBruto) => {
        // 1. Remove e-mails misturados na linha
        let texto = textoBruto.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '');
        // 2. Tira prefixos soltos como "4 "
        texto = texto.replace(/^\d+\s*/, '');
        // 3. O Fatiador: Corta a string no exato momento que achar um número, parêntese (telefone) ou hífen
        texto = texto.split(/[\d+()]/)[0]; 
        // 4. Limpeza final
        texto = texto.replace(/\s+/g, ' ').trim();
        
        if (ehNomeValido(texto)) return texto;
        return '';
    };

    // Tenta primeiro na MESMA linha do e-mail (caso o pdf.js tenha fundido as colunas)
    if (emailIdx >= 0) {
        let nome = tentarExtrair(linhas[emailIdx].texto);
        if (nome) return nome;
    }

    if (emailIdx > 0) {
        const limite = Math.max(0, emailIdx - 4); 
        for (let i = emailIdx - 1; i >= limite; i--) {
            let nome = tentarExtrair(linhas[i].texto);
            if (nome) return nome;
        }
    }
    
    if (idxMarcador !== -1 && idxMarcador + 1 < linhas.length) {
        const limite = Math.min(linhas.length, idxMarcador + 4);
        for (let i = idxMarcador + 1; i < limite; i++) {
            let nome = tentarExtrair(linhas[i].texto);
            if (nome) return nome;
        }
    }

    return '';
}

function ehNomeValido(textoLimpo) {
    if (textoLimpo.length < 3 || textoLimpo.length > 50) return false;
    
    // Lista negra estendida para ignorar itens aleatórios do voucher
    const blockList = /\b(GUEST|DETAILS|DATI|CLIENTE|BOOKING|PROVIDER|IMPORTANT|CANCELLATION|PERSONAS|PAX|ADULTOS|NI[ÑN]OS|TOUR|TICKET|RESERVA|DIRECCI[ÓO]N|ADDRESS|FECHA|HORA|ID|DESCONTO|ESTADIO|ESTÁDIO|INGRESSO|OFICIAL)\b/i;
    if (blockList.test(textoLimpo)) return false;
    
    if (textoLimpo.includes('@') || textoLimpo.includes('http') || textoLimpo.includes('www')) return false;
    
    // Garante que só passou letras reais e não lixo de pontuação
    if (!/[a-zA-ZÀ-ÿ]{3,}/.test(textoLimpo)) return false;
    
    return true; 
}

function extrairTelefone(linhasAposEmail, startFromIdx = 0) {
    const inicio = startFromIdx >= 0 ? startFromIdx + 1 : 0;
    for (let i = inicio; i < linhasAposEmail.length && i < inicio + 5; i++) {
        const texto = linhasAposEmail[i].texto;
        let match = texto.match(/\(\+\d{1,4}\)\s?[\d\s-]{7,20}/);
        if (match) return match[0].replace(/\s+/g, ' ').trim();
        
        match = texto.match(/\b\d{2,4}[\s-]?\d{4,5}[\s-]?\d{4}\b/);
        if (match) return match[0].replace(/\s+/g, ' ').trim();
    }
    return '';
}

// ==========================================================
// 📊 SISTEMA DE CONFIANÇA
// ==========================================================
function calcularConfianca(dados, linhas) {
    const scores = {};
    scores.id = (dados.idOriginal !== 'SEM_ID' && /^[A-Z]\d{7,}$/i.test(dados.idOriginal)) ? 100 : 0;

    if (dados.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dados.email)) {
        scores.email = 100;
    } else {
        scores.email = 0;
    }

    let scoreNome = 0;
    if (dados.nome && dados.nome.length > 2) {
        const palavras = dados.nome.split(/\s+/);
        if (palavras.length >= 2) scoreNome += 70;
        else scoreNome += 40;
        if (/^[A-Za-zÀ-ÖØ-öø-ÿ'’\- ]+$/.test(dados.nome)) scoreNome += 20;
    }
    scores.nome = Math.min(100, scoreNome);

    scores.telefone = dados.telefone && /\d{7,}/.test(dados.telefone.replace(/\D/g, '')) ? 100 : 0;

    return scores;
}