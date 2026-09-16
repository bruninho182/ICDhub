// scripts/whatsapp_api.js (ATUALIZADO - COM DEDUPLICAÇÃO)

// ================================================================
// ===== SUPABASE - ENVIO DE MÉTRICAS =====
// ================================================================

const SUPABASE_URL = 'https://yqlvdvilddobvangvvva.supabase.co/rest/v1/metricas';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxbHZkdmlsZGRvYnZhbmd2dnZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ1MTMzMzgsImV4cCI6MjEwMDA4OTMzOH0.xMflSQjCBDmSWibfkx2GDuEuWU-qPhxuH0NnHKAIt5I';

// ===== CACHE PARA EVITAR DUPLICIDADE =====
const enviosRecentes = new Set();
const TEMPO_EXPIRACAO = 5000; // 5 segundos

function gerarIdUnico(tipo, detalhes) {
    // Cria um ID único baseado no tipo, timestamp e conteúdo (se houver)
    const agora = Date.now();
    const conteudo = detalhes?.texto || detalhes?.mensagem || detalhes?.destinatario || '';
    return `${tipo}_${conteudo.substring(0, 30)}_${Math.floor(agora / 1000)}`;
}

function limparCacheAntigo() {
    setTimeout(() => {
        enviosRecentes.clear();
    }, TEMPO_EXPIRACAO);
}

async function enviarMetrica(tipo, detalhes = null) {
    try {
        // ===== VERIFICA SE JÁ FOI ENVIADO RECENTEMENTE =====
        const id = gerarIdUnico(tipo, detalhes);
        if (enviosRecentes.has(id)) {
            console.warn(`⚠️ Métrica duplicada ignorada: ${tipo} - ID: ${id}`);
            return;
        }
        enviosRecentes.add(id);
        limparCacheAntigo();

        // ===== OBTÉM O OPERADOR =====
        let operador = { id: null, nome: null };
        if (typeof OperadorConfig !== 'undefined' && OperadorConfig.getOperador) {
            operador = await OperadorConfig.getOperador();
        } else {
            // Fallback: tenta obter do storage
            try {
                const result = await new Promise(resolve => {
                    chrome.storage.local.get(['operador_id', 'operador_nome'], resolve);
                });
                operador.id = result.operador_id || null;
                operador.nome = result.operador_nome || null;
            } catch (e) {
                console.warn('⚠️ Falha ao obter operador do storage:', e);
            }
        }

        if (!operador.id || !operador.nome) {
            console.warn('⚠️ Operador não configurado!');
            return;
        }

        const payload = {
            operador: operador.nome,
            operador_id: operador.id,
            tipo: tipo, // 'whatsapp', 'email', 'voucher'
            timestamp: new Date().toISOString(),
            detalhes: detalhes || {}
        };

        const response = await fetch(SUPABASE_URL, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            console.warn(`⚠️ Erro ao enviar métrica: ${response.status}`);
        } else {
            console.log(`✅ Métrica enviada: ${tipo} - ${operador.nome}`);
        }
    } catch (error) {
        console.error('❌ Erro ao enviar métrica:', error);
    }
}

// ===== FUNÇÕES DE ATAJO =====
function registrarWhatsApp(detalhes = null) {
    enviarMetrica('whatsapp', detalhes);
}

function registrarEmail(detalhes = null) {
    enviarMetrica('email', detalhes);
}

function registrarVoucher(detalhes = null) {
    enviarMetrica('voucher', detalhes);
}

// ===== EXPORTA PARA USO GLOBAL (caso necessário) =====
window.enviarMetrica = enviarMetrica;
window.registrarWhatsApp = registrarWhatsApp;
window.registrarEmail = registrarEmail;
window.registrarVoucher = registrarVoucher;

console.log('✅ whatsapp_api.js carregado com deduplicação ativa!');