// scripts/voucher_tracker.js
// Monitor de criação de vouchers no sistema ICD

// ================================================================
// ===== MONITOR DE VOUCHERS CRIADOS =====
// ================================================================

// Armazena o último clique de cada operador
const ultimoCliqueVoucher = new Map();
const TEMPO_MINIMO_ENTRE_CLIQUES = 30000; // 30 segundos

function iniciarMonitorVoucher() {
    console.log("📊 Monitor de Vouchers iniciado...");
    
    // Função que será chamada quando o botão "Criar Reserva" for clicado
    function capturarCriacaoVoucher(event) {
        const target = event.target;
        
        // Procura o botão "Criar Reserva" - usando seletores simples e compatíveis
        let btnCriar = null;
        
        // 1. Procura por qualquer botão que contenha "Criar Reserva" no texto
        const todosBotoes = document.querySelectorAll('button');
        for (const botao of todosBotoes) {
            const texto = botao.textContent || '';
            if (texto.includes('Criar Reserva') || texto.includes('Salvar')) {
                // Verifica se o clique foi neste botão ou em um filho dele
                if (botao.contains(target) || target === botao) {
                    btnCriar = botao;
                    break;
                }
            }
        }
        
        // 2. Se não encontrou, tenta por classe específica do Material-UI
        if (!btnCriar) {
            const botoesMUI = document.querySelectorAll('.MuiButton-containedPrimary, .MuiButton-root');
            for (const botao of botoesMUI) {
                const texto = botao.textContent || '';
                if (texto.includes('Criar Reserva') || texto.includes('Salvar')) {
                    if (botao.contains(target) || target === botao) {
                        btnCriar = botao;
                        break;
                    }
                }
            }
        }
        
        if (btnCriar) {
            // Tenta pegar informações adicionais da reserva
            let codigoVoucher = '';
            let cliente = '';
            
            // Tenta pegar o código do voucher
            const camposVoucher = document.querySelectorAll('input[name*="voucher"], input[id*="voucher"], input[placeholder*="voucher"]');
            for (const campo of camposVoucher) {
                if (campo.value) {
                    codigoVoucher = campo.value;
                    break;
                }
            }
            
            // Tenta pegar o nome do cliente
            const camposCliente = document.querySelectorAll('input[name*="cliente"], input[id*="cliente"], input[placeholder*="Cliente"], input[name*="CustomerName"]');
            for (const campo of camposCliente) {
                if (campo.value) {
                    cliente = campo.value;
                    break;
                }
            }
            
            // ===== CONTROLE DE DUPLICIDADE =====
            chrome.storage.local.get(['nomeOperador'], (res) => {
                const nomeOperador = res.nomeOperador || 'ANÔNIMO';
                const chave = `${nomeOperador}_${codigoVoucher || cliente || 'voucher'}`;
                const agora = Date.now();
                const ultimo = ultimoCliqueVoucher.get(chave);
                
                // Verifica se já passou o tempo mínimo
                if (ultimo && (agora - ultimo) < TEMPO_MINIMO_ENTRE_CLIQUES) {
                    console.log(`⏳ Aguarde ${Math.round((TEMPO_MINIMO_ENTRE_CLIQUES - (agora - ultimo)) / 1000)}s para criar outro voucher.`);
                    return; // Ignora o clique
                }
                
                // Registra a métrica
                if (window.METRICS) {
                    window.METRICS.registrar('voucher', {
                        codigo: codigoVoucher || 'sem_codigo',
                        cliente: cliente || 'sem_cliente',
                        metodo: 'click'
                    });
                    
                    // Atualiza o timestamp do último clique
                    ultimoCliqueVoucher.set(chave, agora);
                    
                    console.log(`📊 Voucher registrado: ${codigoVoucher || 'sem código'} para ${cliente || 'cliente'}`);
                } else {
                    console.warn('⚠️ METRICS não disponível!');
                }
            });
        }
    }
    
    // Remove listener anterior se existir
    document.removeEventListener('click', capturarCriacaoVoucher);
    document.addEventListener('click', capturarCriacaoVoucher, true);
    
    console.log("✅ Monitor de Vouchers ativado!");
}

// ================================================================
// ===== LIMPEZA PERIÓDICA DO CACHE =====
// ================================================================

setInterval(() => {
    const agora = Date.now();
    for (const [chave, timestamp] of ultimoCliqueVoucher) {
        if (agora - timestamp > TEMPO_MINIMO_ENTRE_CLIQUES * 2) {
            ultimoCliqueVoucher.delete(chave);
        }
    }
}, 300000); // 5 minutos

// ================================================================
// ===== FUNÇÃO PARA VERIFICAR SE ESTÁ NA PÁGINA CORRETA =====
// ================================================================

function isPaginaCriacaoReserva() {
    // Verifica pela URL
    if (window.location.href.includes('/apps/sales/bookings/new') ||
        window.location.href.includes('bookings/new') ||
        window.location.href.includes('criar-reserva')) {
        return true;
    }
    
    // Verifica se existe algum botão com "Criar Reserva" na página
    const todosBotoes = document.querySelectorAll('button');
    for (const botao of todosBotoes) {
        const texto = botao.textContent || '';
        if (texto.includes('Criar Reserva') || texto.includes('Salvar')) {
            return true;
        }
    }
    
    return false;
}

// ================================================================
// ===== INICIALIZAÇÃO =====
// ================================================================

// Inicia o monitor se estiver na página correta
function inicializarSeNecessario() {
    if (isPaginaCriacaoReserva() && !window._voucherMonitorActive) {
        window._voucherMonitorActive = true;
        iniciarMonitorVoucher();
    }
}

if (document.readyState === 'complete') {
    inicializarSeNecessario();
} else {
    window.addEventListener('load', inicializarSeNecessario);
}

// Também inicia após alguns segundos (para garantir)
setTimeout(inicializarSeNecessario, 2000);
setTimeout(inicializarSeNecessario, 5000);

// Observa mudanças na DOM (para páginas SPA)
const observer = new MutationObserver(() => {
    inicializarSeNecessario();
});

observer.observe(document.body, { childList: true, subtree: true });