// scripts/whatsapp_api.js (ATUALIZADO)

// ================================================================
// ===== SUPABASE - ENVIO DE MÉTRICAS =====
// ================================================================

const SUPABASE_URL = 'https://yqlvdvilddobvangvvva.supabase.co/rest/v1/metricas';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxbHZkdmlsZGRvYnZhbmd2dnZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ1MTMzMzgsImV4cCI6MjEwMDA4OTMzOH0.xMflSQjCBDmSWibfkx2GDuEuWU-qPhxuH0NnHKAIt5I';

async function enviarMetrica(tipo, detalhes = null) {
    try {
        // ===== OBTÉM O OPERADOR =====
        const operador = await OperadorConfig.getOperador();
        
        if (!operador.id || !operador.nome) {
            console.warn('⚠️ Operador não configurado!');
            return;
        }
        
        const payload = {
            operador: operador.nome,      // Nome completo para exibição
            operador_id: operador.id,     // ID único para agrupamento
            tipo: tipo,                   // 'whatsapp', 'email', 'voucher'
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