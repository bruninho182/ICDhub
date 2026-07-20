// scripts/inactivity_monitor.js
// Monitor de inatividade dos operadores

// ================================================================
// ===== CONFIGURAÇÕES =====
// ================================================================

const CONFIG = {
    TEMPO_INATIVIDADE_ALERTA: 30, // Minutos sem atividade para disparar alerta
    TEMPO_INATIVIDADE_CRITICO: 60, // Minutos sem atividade para alerta crítico
    INTERVALO_VERIFICACAO: 5, // Minutos entre verificações
    ULTIMA_ATIVIDADE_KEY: 'ultima_atividade_operadores'
};

// ================================================================
// ===== SUPABASE CONFIG =====
// ================================================================

const SUPABASE_URL = 'https://yqlvdvilddobvangvvva.supabase.co/rest/v1/metricas';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxbHZkdmlsZGRvYnZhbmd2dnZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ1MTMzMzgsImV4cCI6MjEwMDA4OTMzOH0.xMflSQjCBDmSWibfkx2GDuEuWU-qPhxuH0NnHKAIt5I';

// ================================================================
// ===== FUNÇÕES PRINCIPAIS =====
// ================================================================

async function buscarUltimasAtividades() {
    try {
        // Busca as últimas atividades de cada operador
        const response = await fetch(`${SUPABASE_URL}?select=operador,timestamp&order=timestamp.desc&limit=100`, {
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`
            }
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const dados = await response.json();
        
        // Agrupa por operador e pega a última atividade
        const ultimaAtividade = {};
        dados.forEach(d => {
            if (!ultimaAtividade[d.operador] || new Date(d.timestamp) > new Date(ultimaAtividade[d.operador])) {
                ultimaAtividade[d.operador] = d.timestamp;
            }
        });
        
        return ultimaAtividade;
    } catch (error) {
        console.error('❌ Erro ao buscar últimas atividades:', error);
        return {};
    }
}

function verificarInatividade(ultimaAtividade) {
    const agora = Date.now();
    const operadoresInativos = [];
    const operadoresCriticos = [];
    
    // Busca a lista de todos os operadores que já foram registrados
    // Para isso, precisamos de uma lista fixa ou buscar do storage
    chrome.storage.local.get(['operadores_conhecidos'], (res) => {
        const operadores = res.operadores_conhecidos || [];
        
        // Se não tiver lista, usa os que estão no objeto de atividades
        const listaOperadores = operadores.length > 0 ? operadores : Object.keys(ultimaAtividade);
        
        listaOperadores.forEach(operador => {
            const ultimo = ultimaAtividade[operador];
            if (!ultimo) {
                // Operador nunca teve atividade
                operadoresCriticos.push({
                    nome: operador,
                    tempoInativo: 'Nunca registrou atividade'
                });
                return;
            }
            
            const tempoInativoMs = agora - new Date(ultimo).getTime();
            const tempoInativoMin = Math.floor(tempoInativoMs / (1000 * 60));
            
            if (tempoInativoMin >= CONFIG.TEMPO_INATIVIDADE_CRITICO) {
                operadoresCriticos.push({
                    nome: operador,
                    tempoInativo: `${tempoInativoMin} minutos`,
                    ultimaAtividade: ultimo
                });
            } else if (tempoInativoMin >= CONFIG.TEMPO_INATIVIDADE_ALERTA) {
                operadoresInativos.push({
                    nome: operador,
                    tempoInativo: `${tempoInativoMin} minutos`,
                    ultimaAtividade: ultimo
                });
            }
        });
        
        // Se encontrou inatividade, envia notificações
        if (operadoresInativos.length > 0 || operadoresCriticos.length > 0) {
            enviarAlertas(operadoresInativos, operadoresCriticos);
        }
    });
}

// ================================================================
// ===== ENVIO DE NOTIFICAÇÕES =====
// ================================================================

function enviarAlertas(inativos, criticos) {
    // 1. Notificação do Chrome
    if (criticos.length > 0) {
        const nomes = criticos.map(o => o.nome).join(', ');
        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icon.png',
            title: '🚨 ALERTA CRÍTICO DE INATIVIDADE!',
            message: `${nomes} está(ão) inativo(s) há mais de ${CONFIG.TEMPO_INATIVIDADE_CRITICO} minutos!`,
            priority: 2,
            requireInteraction: true
        });
    } else if (inativos.length > 0) {
        const nomes = inativos.map(o => o.nome).join(', ');
        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icon.png',
            title: '⚠️ Atenção: Inatividade Detectada',
            message: `${nomes} está(ão) inativo(s) há mais de ${CONFIG.TEMPO_INATIVIDADE_ALERTA} minutos.`,
            priority: 1
        });
    }
    
    // 2. Salva no storage para o dashboard mostrar
    const alertas = {
        timestamp: new Date().toISOString(),
        inativos: inativos,
        criticos: criticos
    };
    
    chrome.storage.local.set({ 
        alertas_ultima_verificacao: alertas,
        alertas_tem_inativos: inativos.length > 0 || criticos.length > 0
    });
    
    // 3. Log no console
    if (criticos.length > 0) {
        console.log(`🚨 ${criticos.length} operador(es) em situação crítica:`, criticos.map(o => o.nome).join(', '));
    }
    if (inativos.length > 0) {
        console.log(`⚠️ ${inativos.length} operador(es) inativo(s):`, inativos.map(o => o.nome).join(', '));
    }
}

// ================================================================
// ===== FUNÇÃO PARA REGISTRAR OPERADORES CONHECIDOS =====
// ================================================================

function registrarOperador(nome) {
    if (!nome || nome === 'ANÔNIMO') return;
    
    chrome.storage.local.get(['operadores_conhecidos'], (res) => {
        let lista = res.operadores_conhecidos || [];
        if (!lista.includes(nome)) {
            lista.push(nome);
            chrome.storage.local.set({ operadores_conhecidos: lista });
        }
    });
}

// ================================================================
// ===== ESCUTA EVENTOS DE MÉTRICAS PARA REGISTRAR OPERADORES =====
// ================================================================

// Quando uma métrica é registrada, registra o operador
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.acao === 'METRICA_REGISTRADA' && request.operador) {
        registrarOperador(request.operador);
    }
});

// ================================================================
// ===== INICIALIZAÇÃO DO MONITOR =====
// ================================================================

async function executarMonitoramento() {
    console.log(`🔍 Verificando inatividade (${new Date().toLocaleString()})...`);
    const ultimaAtividade = await buscarUltimasAtividades();
    verificarInatividade(ultimaAtividade);
}

// Executa imediatamente ao carregar
executarMonitoramento();

// Configura verificação periódica
const intervalMs = CONFIG.INTERVALO_VERIFICACAO * 60 * 1000;
setInterval(executarMonitoramento, intervalMs);

console.log(`✅ Monitor de inatividade iniciado! Verificando a cada ${CONFIG.INTERVALO_VERIFICACAO} minutos.`);