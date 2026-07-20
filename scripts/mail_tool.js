// ===== PREENCHIMENTO AUTOMÁTICO DE E-MAIL =====
function preencherWebmail() {
    chrome.storage.local.get(["dadosParaEmail"], (res) => {
        const dados = res.dadosParaEmail;
        if (!dados) {
            console.log("ℹ️ Nenhum dado de e-mail pendente no Hub.");
            return;
        }

        console.log("📧 ICD Hub: Iniciando preenchimento do e-mail...");

        if (dados.modo === 'CCO') {
            const btnBcc = document.querySelector('.add-bcc, #compose-add-bcc, [data-event="add-bcc"]');
            if (btnBcc) btnBcc.click();

            setTimeout(() => {
                const campoCCO = document.querySelector('textarea[name="_bcc"], #_bcc, .recipient-input[data-type="bcc"] input');
                if (campoCCO) {
                    campoCCO.value = dados.email; 
                    campoCCO.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }, 500);
        } else {
            const campoPara = document.querySelector('input[name="_to"], .recipient-input input, #_to');
            if (campoPara) {
                campoPara.value = dados.email;
                campoPara.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }
        const campoAssunto = document.querySelector('input[name="_subject"], #compose-subject');
        if (campoAssunto) {
            campoAssunto.value = dados.assunto;
            campoAssunto.dispatchEvent(new Event('change', { bubbles: true }));
        }

        const editorSimples = document.getElementById('composebody');
        const iframeEditor = document.querySelector('.cke_wysiwyg_frame, #composebody_ifr');

        if (iframeEditor && iframeEditor.contentDocument) {
            const doc = iframeEditor.contentDocument;
            if (doc.body) {
                const textoHub = dados.corpo.replace(/\n/g, '<br>');
                const conteudoAtual = doc.body.innerHTML;
                if (!conteudoAtual.includes(textoHub.substring(0, 10))) {
                    doc.body.innerHTML = `${textoHub}<br><br>${conteudoAtual}`;
                }
            }
        } else if (editorSimples) {
            const conteudoAtual = editorSimples.value;
            if (!conteudoAtual.includes(dados.corpo.substring(0, 10))) {
                editorSimples.value = `${dados.corpo}\n\n${conteudoAtual}`;
                editorSimples.dispatchEvent(new Event('input', { bubbles: true }));
            }
        }

        console.log("✅ E-mail preenchido preservando assinatura!");

        setTimeout(() => {
            chrome.storage.local.remove("dadosParaEmail");
        }, 2000);
    });
}

// ================================================================
// ===== MONITOR DE E-MAILS ENVIADOS (COM CONTROLE DE DUPLICIDADE) =
// ================================================================

// Armazena o último envio de cada operador
const ultimoEnvioEmail = new Map();
const TEMPO_MINIMO_ENTRE_ENVIOS = 30000; // 30 segundos

function iniciarMonitorEmail() {
    console.log("📊 Monitor de E-mail iniciado (com anti-spam de 30s)...");
    
    // Função que será chamada quando o botão Enviar for clicado
    function capturarEnvioEmail(event) {
        const target = event.target;
        const btnEnviar = target.closest('[data-action="sendmail"], .lm-btn-dark, #rcmbtn108, .btn-primary[onclick*="send"]');
        
        if (btnEnviar) {
            // Tenta pegar o assunto e destinatário
            let assunto = '';
            let destinatario = '';
            
            const campoAssunto = document.querySelector('input[name="_subject"], #compose-subject');
            if (campoAssunto) assunto = campoAssunto.value || '';
            
            const campoPara = document.querySelector('input[name="_to"], .recipient-input input, #_to');
            if (campoPara) destinatario = campoPara.value || '';
            
            // ===== CONTROLE DE DUPLICIDADE =====
            // Cria uma chave única para o operador atual
            // Usamos o nome do operador + destinatário + assunto (para diferenciar e-mails diferentes)
            const operador = window.METRICS ? 'operador_temp' : 'sem_metrics';
            
            // Tenta pegar o nome do operador do storage
            chrome.storage.local.get(['nomeOperador'], (res) => {
                const nomeOperador = res.nomeOperador || 'ANÔNIMO';
                const chave = `${nomeOperador}_${destinatario}_${assunto.substring(0, 20)}`;
                const agora = Date.now();
                const ultimo = ultimoEnvioEmail.get(chave);
                
                // Verifica se já passou o tempo mínimo desde o último envio
                if (ultimo && (agora - ultimo) < TEMPO_MINIMO_ENTRE_ENVIOS) {
                    console.log(`⏳ Aguarde ${Math.round((TEMPO_MINIMO_ENTRE_ENVIOS - (agora - ultimo)) / 1000)}s para enviar outro e-mail.`);
                    return; // Ignora o clique
                }
                
                // Registra a métrica
                if (window.METRICS) {
                    window.METRICS.registrar('email', {
                        assunto: assunto,
                        destinatario: destinatario,
                        metodo: 'click'
                    });
                    
                    // Atualiza o timestamp do último envio
                    ultimoEnvioEmail.set(chave, agora);
                    
                    console.log(`📊 E-mail registrado: "${assunto}" para ${destinatario}`);
                } else {
                    console.warn('⚠️ METRICS não disponível!');
                }
            });
        }
    }
    
    // Remove listener anterior se existir
    document.removeEventListener('click', capturarEnvioEmail);
    document.addEventListener('click', capturarEnvioEmail, true);
    
    console.log("✅ Monitor de E-mail ativado!");
}

// ================================================================
// ===== LIMPEZA PERIÓDICA DO CACHE DE ÚLTIMOS ENVIOS =====
// ================================================================

// Limpa o cache a cada 5 minutos para não acumular
setInterval(() => {
    const agora = Date.now();
    for (const [chave, timestamp] of ultimoEnvioEmail) {
        if (agora - timestamp > TEMPO_MINIMO_ENTRE_ENVIOS * 2) {
            ultimoEnvioEmail.delete(chave);
        }
    }
}, 300000); // 5 minutos

// ================================================================
// ===== INICIALIZAÇÃO =====
// ================================================================

// Preenche o e-mail quando a página de composição carregar
if (window.location.href.includes('_action=compose') || window.location.href.includes('task=mail')) {
    setTimeout(preencherWebmail, 2000);
    setTimeout(preencherWebmail, 4000);
}

// Inicia o monitor de envio de e-mails
if (document.readyState === 'complete') {
    iniciarMonitorEmail();
} else {
    window.addEventListener('load', iniciarMonitorEmail);
}

// Também inicia após alguns segundos (para garantir)
setTimeout(iniciarMonitorEmail, 2000);
setTimeout(iniciarMonitorEmail, 4000);
setTimeout(iniciarMonitorEmail, 6000);

// Observa mudanças na DOM para reiniciar o monitor se necessário
const observer = new MutationObserver(() => {
    const btnEnviar = document.querySelector('[data-action="sendmail"], .lm-btn-dark, #rcmbtn108');
    if (btnEnviar && !window._emailMonitorActive) {
        window._emailMonitorActive = true;
        iniciarMonitorEmail();
    }
});

observer.observe(document.body, { childList: true, subtree: true });