// dashboard.js
// ===== CONFIGURAÇÕES =====
const CHAVE_OPERADORES_DESATIVADOS = 'operadores_desativados';

// ================================================================
// ===== SUPABASE CONFIG =====
// ================================================================

const SUPABASE_URL = 'https://yqlvdvilddobvangvvva.supabase.co/rest/v1/metricas';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxbHZkdmlsZGRvYnZhbmd2dnZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ1MTMzMzgsImV4cCI6MjEwMDA4OTMzOH0.xMflSQjCBDmSWibfkx2GDuEuWU-qPhxuH0NnHKAIt5I';

// ================================================================
// ===== UTILITÁRIO PARA GERAR ID ÚNICO =====
// ================================================================

function gerarIdUnico(nome) {
    if (!nome) return null;
    return nome
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
}

// ================================================================
// ===== AUTENTICAÇÃO =====
// ================================================================

const supabase = new URL(SUPABASE_URL).origin;
let sessaoMaster = null;
let consultaAtual = 0;
const chaveSessaoLembrada = 'icd_dashboard_sessao_master';

function lerSessaoLembrada() {
    try {
        const dados = JSON.parse(localStorage.getItem(chaveSessaoLembrada));
        return dados?.id && dados.token && dados.renovacao && Number.isFinite(dados.expiraEm) ? dados : null;
    } catch {
        return null;
    }
}

function salvarSessaoLembrada(sessao) {
    const { id, email, token, renovacao, expiraEm } = sessao;
    localStorage.setItem(chaveSessaoLembrada, JSON.stringify({ id, email, token, renovacao, expiraEm }));
}

function abrirDashboard() {
    document.getElementById('telaLogin').style.display = 'none';
    document.getElementById('conteudoDashboard').classList.add('visible');
}

async function restaurarSessaoLembrada() {
    const dados = lerSessaoLembrada();
    if (!dados) return;
    const botao = document.getElementById('btnLogin');
    document.getElementById('emailDashboard').value = dados.email;
    document.getElementById('lembrarSessao').checked = true;
    botao.disabled = true;
    botao.textContent = 'Restaurando sessão…';
    sessaoMaster = { ...dados, lembrada: true, renovando: null };
    try {
        await carregarDados(true);
        if (sessaoMaster?.id === dados.id) abrirDashboard();
    } catch (erro) {
        if (/Sessão encerrada|acesso master/.test(erro.message) && lerSessaoLembrada()?.id === dados.id) {
            localStorage.removeItem(chaveSessaoLembrada);
        }
        sessaoMaster = null;
        mostrarErroLogin(erro.message);
    } finally {
        botao.disabled = false;
        botao.textContent = 'Entrar no painel';
    }
}

function mostrarErroLogin(mensagem) {
    const erro = document.getElementById('erroLogin');
    erro.textContent = mensagem;
    erro.classList.toggle('visible', Boolean(mensagem));
}

async function validarSenha() {
    const email = document.getElementById('emailDashboard');
    const senha = document.getElementById('senhaDashboard');
    const botao = document.getElementById('btnLogin');
    if (botao.disabled) return;
    if (!email.value.trim() || !senha.value) {
        mostrarErroLogin('Informe seu e-mail e sua senha.');
        return;
    }
    botao.disabled = true;
    botao.textContent = 'Entrando…';
    mostrarErroLogin('');
    try {
        const resposta = await fetch(supabase + '/auth/v1/token?grant_type=password', {
            method: 'POST',
            headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email.value.trim(), password: senha.value }),
            signal: AbortSignal.timeout(15000)
        });
        if (!resposta.ok) throw new Error(resposta.status === 400 || resposta.status === 401
            ? 'Confira seu e-mail e sua senha.' : 'Não foi possível entrar no Supabase. Tente novamente.');
        const sessao = await resposta.json();
        if (!sessao.access_token) throw new Error('O Supabase não retornou uma sessão válida.');
        sessaoMaster = {
            token: sessao.access_token,
            renovacao: sessao.refresh_token,
            expiraEm: Date.now() + (sessao.expires_in || 3600) * 1000,
            renovando: null,
            id: crypto.randomUUID(),
            email: email.value.trim(),
            lembrada: false
        };
        await carregarDados(true);
        if (!sessaoMaster) return;
        if (document.getElementById('lembrarSessao').checked && sessaoMaster.renovacao) {
            salvarSessaoLembrada(sessaoMaster);
            sessaoMaster.lembrada = true;
        } else {
            localStorage.removeItem(chaveSessaoLembrada);
        }
        abrirDashboard();
    } catch (erro) {
        sessaoMaster = null;
        mostrarErroLogin(erro.message);
    } finally {
        senha.value = '';
        botao.disabled = false;
        botao.textContent = 'Entrar no painel';
    }
}

async function sair() {
    const sessao = sessaoMaster;
    sessaoMaster = null;
    if (sessao?.id && lerSessaoLembrada()?.id === sessao.id) localStorage.removeItem(chaveSessaoLembrada);
    consultaAtual++;
    dadosAtuais = [];
    intervaloExibido = null;
    document.getElementById('telaLogin').style.display = 'flex';
    document.getElementById('conteudoDashboard').classList.remove('visible');
    document.getElementById('emailDashboard').focus();
    if (!sessao) return;
    await sessao.renovando?.catch(() => {});
    fetch(supabase + '/auth/v1/logout?scope=local', {
        method: 'POST', headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + sessao.token },
        signal: AbortSignal.timeout(15000)
    }).catch(() => {});
}

// ================================================================
// ===== GERENCIADOR DE OPERADORES DESATIVADOS =====
// ================================================================

function getOperadoresDesativados() {
    try {
        const dados = localStorage.getItem(CHAVE_OPERADORES_DESATIVADOS);
        return dados ? JSON.parse(dados) : [];
    } catch {
        return [];
    }
}

function isOperadorDesativado(identificador) {
    const desativados = getOperadoresDesativados();
    return desativados.includes(identificador);
}

function toggleOperadorDesativado(id, nome) {
    let desativados = getOperadoresDesativados();
    const index = desativados.indexOf(id);
    
    if (index >= 0) {
        desativados.splice(index, 1);
        mostrarFeedback(`✅ ${nome} foi reativado!`, 'success');
    } else {
        desativados.push(id);
        mostrarFeedback(`⛔ ${nome} foi desativado (modo folga)!`, 'warning');
    }
    
    localStorage.setItem(CHAVE_OPERADORES_DESATIVADOS, JSON.stringify(desativados));
    carregarDados();
}

// ================================================================
// ===== AGRUPAR POR OPERADOR_ID COM FALLBACK =====
// ================================================================

function agruparPorOperador(dados) {
    const agrupado = Object.create(null);
    
    dados.forEach(d => {
        let id = d.operador_id;
        let nome = d.operador;
        
        if (!id && nome) {
            id = gerarIdUnico(nome);
        }
        
        if (!nome && id) {
            nome = id;
        }
        
        if (!id || !nome) return;
        
        if (!agrupado[id]) {
            agrupado[id] = {
                id: id,
                nome: nome,
                whatsapp: 0,
                email: 0,
                voucher: 0,
                total: 0,
                ultimo: null,
                ultimoTimestamp: null,
                desativado: isOperadorDesativado(id),
                atividades: []
            };
        }
        
        agrupado[id].whatsapp += Number(d.whatsapp);
        agrupado[id].email += Number(d.email);
        agrupado[id].voucher += Number(d.voucher);
        agrupado[id].total = agrupado[id].whatsapp + agrupado[id].email + agrupado[id].voucher;
        
        const ts = new Date(d.timestamp);
        if (!agrupado[id].ultimo || ts > new Date(agrupado[id].ultimo)) {
            agrupado[id].ultimo = d.timestamp;
            agrupado[id].ultimoTimestamp = ts;
        }
        
        agrupado[id].atividades.push(d);
    });
    
    return agrupado;
}

// ================================================================
// ===== NOVO: CALCULAR RANKING =====
// ================================================================

function calcularRanking(operadores) {
    // Filtra apenas operadores ativos
    const ativos = operadores.filter(op => !op.desativado);
    
    // Ordena por total de atividades (decrescente)
    const sorted = [...ativos].sort((a, b) => b.total - a.total);
    
    // Atribui posição e medalha
    sorted.forEach((op, index) => {
        op.posicao = index + 1;
        
        if (index === 0 && op.total > 0) {
            op.medalha = '🥇';
            op.medalhaLabel = 'Ouro';
        } else if (index === 1 && op.total > 0) {
            op.medalha = '🥈';
            op.medalhaLabel = 'Prata';
        } else if (index === 2 && op.total > 0) {
            op.medalha = '🥉';
            op.medalhaLabel = 'Bronze';
        } else {
            op.medalha = `#${index + 1}`;
            op.medalhaLabel = `${index + 1}º lugar`;
        }
    });
    
    return sorted;
}

// ================================================================
// ===== NOVO: RENDERIZAR TOP 3 =====
// ================================================================

function renderizarTop3(ranking) {
    const container = document.getElementById('top3Container');
    if (!container) return;
    
    const top3 = ranking.filter(op => op.posicao <= 3 && op.total > 0);
    
    if (top3.length === 0) {
        container.innerHTML = `
            <div style="text-align:center; color:#64748b; padding:20px;">
                <i class="fas fa-trophy" style="font-size:24px; color:#a855f7;"></i>
                <p style="margin-top:8px;">Ainda não há dados suficientes para o ranking.</p>
            </div>
        `;
        return;
    }
    
    let html = '<div style="display:flex; justify-content:center; gap:20px; flex-wrap:wrap; padding:10px 0;">';
    
    // Ordem: 2º, 1º, 3º (para o pódio)
    const ordem = [1, 0, 2];
    const cores = ['#FFD700', '#C0C0C0', '#CD7F32'];
    const tamanhos = ['80px', '100px', '70px'];
    const fontSizes = ['28px', '36px', '24px'];
    const labels = ['🥇 Ouro', '🥈 Prata', '🥉 Bronze'];
    
    ordem.forEach((idx) => {
        if (idx >= top3.length) return;
        const op = top3[idx];
        const cor = cores[idx] || '#64748b';
        const tamanho = tamanhos[idx] || '70px';
        const fontSize = fontSizes[idx] || '24px';
        const label = labels[idx] || `${op.posicao}º`;
        
        html += `
            <div style="
                background: #1e293b;
                border: 2px solid ${cor};
                border-radius: 16px;
                padding: 16px 24px;
                text-align: center;
                min-width: 120px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.3);
                transition: transform 0.3s;
                cursor: default;
            " 
            onmouseover="this.style.transform='scale(1.05)'" 
            onmouseout="this.style.transform='scale(1)'">
                <div style="font-size: ${fontSize}; margin-bottom: 4px;">${op.medalha}</div>
                <div style="font-weight:700; color:#f1f5f9; font-size:14px;">${escaparDashboard(op.nome)}</div>
                <div style="color:${cor}; font-weight:600; font-size:12px;">${label}</div>
                <div style="color:#94a3b8; font-size:11px; margin-top:4px;">
                    📊 ${op.total} atividades
                </div>
                <div style="display:flex; justify-content:center; gap:8px; margin-top:4px; font-size:10px; color:#64748b;">
                    <span>💬 ${op.whatsapp}</span>
                    <span>📧 ${op.email}</span>
                    <span>🎫 ${op.voucher}</span>
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    container.innerHTML = html;
}

// ================================================================
// ===== DASHBOARD =====
// ================================================================

let dadosAtuais = [];
let intervaloExibido = null;
let filtroPeriodo = 'hoje';
let dataInicio = null;
let dataFim = null;

const fusoDashboard = 'America/Sao_Paulo';
const dataSaoPaulo = new Intl.DateTimeFormat('sv-SE', {timeZone: fusoDashboard, year: 'numeric', month: '2-digit', day: '2-digit'});

function intervaloDashboard(periodo, agora = new Date(), inicio = dataInicio, fim = dataFim) {
    const hoje = dataSaoPaulo.format(agora);
    const dia = new Date(hoje + 'T00:00:00Z');
    const deslocar = (data, dias) => new Date(Date.parse(data + 'T00:00:00Z') + dias * 86400000).toISOString().slice(0, 10);
    let primeiroDia = hoje;
    let ultimoDia = hoje;
    if (periodo === 'semana') primeiroDia = deslocar(hoje, -((dia.getUTCDay() + 6) % 7));
    if (periodo === 'mes') primeiroDia = hoje.slice(0, 7) + '-01';
    if (periodo === 'ano') primeiroDia = hoje.slice(0, 4) + '-01-01';
    if (periodo === 'personalizado') {
        primeiroDia = inicio;
        ultimoDia = fim;
    }
    const duracao = Date.parse(ultimoDia + 'T00:00:00Z') - Date.parse(primeiroDia + 'T00:00:00Z');
    if (!Number.isFinite(duracao) || duracao < 0 || duracao >= 366 * 86400000) {
        throw new Error('Selecione um intervalo válido de até 366 dias.');
    }
    return { p_inicio: primeiroDia, p_fim_exclusivo: deslocar(ultimoDia, 1) };
}

async function tokenDashboard(sessao, forcar = false) {
    if (sessao !== sessaoMaster) throw new Error('Sessão encerrada. Entre novamente.');
    if (!forcar && sessao.expiraEm - Date.now() > 60000) return sessao.token;
    if (!sessao.renovacao) throw new Error('Sessão encerrada. Entre novamente.');
    if (!sessao.renovando) {
        const renovar = async () => {
            if (sessao !== sessaoMaster) throw new Error('Sessão encerrada. Entre novamente.');
            if (sessao.lembrada) {
                const salva = lerSessaoLembrada();
                if (salva?.id !== sessao.id) throw new Error('Sessão encerrada. Entre novamente.');
                if (salva.renovacao !== sessao.renovacao) {
                    Object.assign(sessao, salva);
                    if (sessao.expiraEm - Date.now() > 60000) return sessao.token;
                }
            }
            const resposta = await fetch(supabase + '/auth/v1/token?grant_type=refresh_token', {
                method: 'POST',
                headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
                body: JSON.stringify({ refresh_token: sessao.renovacao }),
                signal: AbortSignal.timeout(15000)
            });
            if ([400, 401, 403].includes(resposta.status)) throw new Error('Sessão encerrada. Entre novamente.');
            if (!resposta.ok) throw new Error('Não foi possível renovar a sessão agora.');
            const nova = await resposta.json();
            if (!nova.access_token || !nova.refresh_token) throw new Error('Sessão encerrada. Entre novamente.');
            sessao.token = nova.access_token;
            sessao.renovacao = nova.refresh_token;
            sessao.expiraEm = Date.now() + (nova.expires_in || 3600) * 1000;
            if (sessao.lembrada && sessao === sessaoMaster && lerSessaoLembrada()?.id === sessao.id) {
                salvarSessaoLembrada(sessao);
            }
            return sessao.token;
        };
        const tarefa = sessao.lembrada && navigator.locks
            ? navigator.locks.request(chaveSessaoLembrada, renovar) : renovar();
        sessao.renovando = tarefa.finally(() => { sessao.renovando = null; });
    }
    return sessao.renovando;
}

async function consultarMetricas(sessao, intervalo) {
    const consultar = token => {
        if (sessao !== sessaoMaster) throw new Error('Sessão encerrada. Entre novamente.');
        return fetch(supabase + '/rest/v1/rpc/icd_dashboard_metricas', {
            method: 'POST',
            headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
            body: JSON.stringify(intervalo),
            signal: AbortSignal.timeout(20000)
        });
    };
    const token = await tokenDashboard(sessao);
    const resposta = await consultar(token);
    if (resposta.status !== 401 || !sessao.renovacao) return resposta;
    return consultar(token === sessao.token ? await tokenDashboard(sessao, true) : sessao.token);
}

function validarResumoMetricas(dados) {
    if (!Array.isArray(dados) || dados.some(linha =>
        !linha || typeof linha.dia !== 'string' || !Number.isFinite(Date.parse(linha.timestamp)) ||
        [linha.whatsapp, linha.email, linha.voucher].some(total => !Number.isSafeInteger(total) || total < 0))) {
        throw new Error('O Supabase retornou métricas em um formato inesperado.');
    }
}

function intervalosComparacao(periodo, intervalo) {
    const inicio = new Date(intervalo.p_inicio + 'T00:00:00Z');
    const fim = new Date(intervalo.p_fim_exclusivo + 'T00:00:00Z');
    const anterior = new Date(inicio);
    if (periodo === 'semana') anterior.setUTCDate(anterior.getUTCDate() - 7);
    else anterior.setUTCMonth(anterior.getUTCMonth() - 1);
    const duracao = Math.min(fim - inicio - 86400000, inicio - anterior);
    if (duracao <= 0) return null;
    const iso = data => new Date(data).toISOString().slice(0, 10);
    return {
        atual: { p_inicio: intervalo.p_inicio, p_fim_exclusivo: iso(+inicio + duracao) },
        anterior: { p_inicio: iso(anterior), p_fim_exclusivo: iso(+anterior + duracao) }
    };
}

let comparacaoIndividual;

async function carregarComparacao(sessao, periodo, intervalo, dados, atual) {
    comparacaoIndividual = null;
    const painel = document.getElementById('comparacaoOperadores');
    painel.hidden = !['semana', 'mes'].includes(periodo);
    if (painel.hidden) return;
    const corpo = painel.querySelector('tbody');
    const status = document.getElementById('comparacaoStatus');
    corpo.replaceChildren();
    status.textContent = 'Consultando período anterior…';
    const janelas = intervalosComparacao(periodo, intervalo);
    if (!janelas) {
        status.textContent = 'A comparação estará disponível após o primeiro dia completo do período.';
        return;
    }
    try {
        const resposta = await consultarMetricas(sessao, janelas.anterior);
        if (!resposta.ok) throw new Error();
        const historico = await resposta.json();
        if (!atual()) return;
        validarResumoMetricas(historico);
        const recentes = agruparPorOperador(dados.filter(linha => linha.dia < janelas.atual.p_fim_exclusivo));
        const anteriores = agruparPorOperador(historico);
        for (const id of new Set([...Object.keys(recentes), ...Object.keys(anteriores)])) {
            const agora = recentes[id]?.total || 0;
            const antes = anteriores[id]?.total || 0;
            const diferenca = agora - antes;
            const linha = corpo.insertRow();
            for (const valor of [recentes[id]?.nome || anteriores[id].nome, agora, antes, diferenca > 0 ? '+' + diferenca : diferenca]) {
                linha.insertCell().textContent = valor;
            }
        }
        const faixa = janela => {
            const inicio = janela.p_inicio.split('-').reverse().join('/');
            const fim = new Date(Date.parse(janela.p_fim_exclusivo + 'T00:00:00Z') - 86400000)
                .toLocaleDateString('pt-BR', { timeZone: 'UTC' });
            return inicio + ' a ' + fim;
        };
        comparacaoIndividual = { recentes, anteriores, faixaAtual: faixa(janelas.atual), faixaAnterior: faixa(janelas.anterior) };
        status.textContent = 'Atual: ' + faixa(janelas.atual) + ' · Anterior: ' + faixa(janelas.anterior)
            + (corpo.rows.length ? '' : ' · Sem registros.');
    } catch {
        if (atual()) status.textContent = 'Não foi possível carregar a comparação.';
    }
}

async function carregarDados(entrada = false) {
    const sessao = sessaoMaster;
    if (!sessao) return;
    const consulta = ++consultaAtual;
    const atual = () => consulta === consultaAtual && sessao === sessaoMaster;
    const status = document.getElementById('ultimaAtualizacao');
    const exportar = document.getElementById('exportarCSV');
    exportar.disabled = true;
    status.textContent = 'Consultando métricas…';
    try {
        const intervalo = intervaloDashboard(filtroPeriodo);
        const periodo = filtroPeriodo;
        const resposta = await consultarMetricas(sessao, intervalo);
        if (resposta.status === 401 || resposta.status === 403) {
            throw new Error(entrada ? 'Esta conta precisa de acesso master no Supabase.' : 'Sessão encerrada ou acesso master removido. Entre novamente.');
        }
        if (resposta.status === 404) throw new Error('Instale a função do dashboard no Supabase.');
        if (!resposta.ok) throw new Error('Falha ao consultar as métricas. Tente novamente.');
        const dados = await resposta.json();
        if (!atual()) return;
        validarResumoMetricas(dados);
        dadosAtuais = dados;
        intervaloExibido = intervalo;
        const primeiro = intervalo.p_inicio.split('-').reverse().join('/');
        const ultimo = new Date(Date.parse(intervalo.p_fim_exclusivo + 'T00:00:00Z') - 86400000)
            .toLocaleDateString('pt-BR', { timeZone: 'UTC' });
        document.getElementById('periodoExibido').textContent =
            (primeiro === ultimo ? primeiro : primeiro + ' a ' + ultimo) + ' · horário de São Paulo';
        const ultimaAtividade = dados.reduce((maisRecente, linha) => Math.max(maisRecente, Date.parse(linha.timestamp)), 0);
        document.getElementById('ultimaMetrica').textContent = ultimaAtividade
            ? 'Última atividade registrada no período: ' + new Date(ultimaAtividade).toLocaleString('pt-BR', { timeZone: fusoDashboard })
            : 'Nenhuma atividade registrada no período.';
        renderizar(dadosAtuais);
        carregarAlertas();
        carregarStatusChefe();
        void carregarComparacao(sessao, periodo, intervalo, dados, atual);
        status.textContent = 'Última atualização em ' + new Date().toLocaleString('pt-BR', {timeZone: fusoDashboard});
    } catch (erro) {
        if (!atual()) return;
        if (entrada) throw erro;
        if (erro.message.startsWith('Sessão encerrada')) {
            sair();
            mostrarErroLogin(erro.message);
        } else {
            status.textContent = erro.message + ' Exibindo a última consulta bem-sucedida.';
        }
    } finally {
        if (atual()) exportar.disabled = !dadosAtuais.length;
    }
}

function escaparDashboard(valor) {
    return String(valor).replace(/[&<>"']/g, caractere => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[caractere]);
}

function renderizar(dados) {
  // ===== AGRUPA POR OPERADOR_ID =====
  const agrupado = agruparPorOperador(dados);
  const operadores = Object.values(agrupado);
  
  // ===== CALCULA RANKING =====
  const ranking = calcularRanking(operadores);
  
  // ===== RENDERIZA TOP 3 =====
  renderizarTop3(ranking);
  
  // ===== CARDS =====
  const totalOps = operadores.length;
  
  document.getElementById('totalOperadores').textContent = totalOps;
  document.getElementById('totalWhatsapp').textContent = operadores.reduce((s, op) => s + op.whatsapp, 0);
  document.getElementById('totalEmails').textContent = operadores.reduce((s, op) => s + op.email, 0);
  document.getElementById('totalVouchers').textContent = operadores.reduce((s, op) => s + op.voucher, 0);

  // ===== TABELA =====
  const tbody = document.getElementById('tabelaCorpo');
  if (operadores.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; color:#64748b;">Nenhuma atividade registrada no período.</td></tr>`;
    atualizarGraficos([]);
    return;
  }

  // Ordena por ranking (posição)
  const sorted = [...ranking];
  
  // Adiciona os desativados no final
  const desativados = operadores.filter(op => op.desativado);
  sorted.push(...desativados);

  let html = '';
  sorted.forEach(op => {
    const desativado = op.desativado;
    const ultimo = op.ultimo ? new Date(op.ultimo).toLocaleString('pt-BR', {timeZone: fusoDashboard}) : 'Nunca';
    const ultimoTimestamp = periodoIncluiHoje() ? op.ultimoTimestamp : null;
    
    // ===== STATUS E BADGES =====
    let badgeInativo = '';
    let tempoLabel = '⏱️ --';
    let tempoClass = 'tempo-inativo online';
    
    if (desativado) {
      badgeInativo = `<span class="badge-desativado">⛔ DESATIVADO</span>`;
      tempoLabel = '⛔ Folga';
      tempoClass = 'tempo-inativo desativado';
    } else if (ultimoTimestamp) {
      const agora = new Date();
      const diffMs = agora - ultimoTimestamp;
      const diffMin = Math.floor(diffMs / 60000);
      
      if (diffMin < 30) {
        badgeInativo = `<span class="badge-inativo online">🟢 Online</span>`;
        tempoLabel = `⏱️ ${diffMin} min`;
        tempoClass = 'tempo-inativo online';
      } else if (diffMin < 60) {
        badgeInativo = `<span class="badge-inativo atencao">🟡 Offline (30+)</span>`;
        tempoLabel = `⏱️ ${diffMin} min`;
        tempoClass = 'tempo-inativo atencao';
      } else {
        const horas = Math.floor(diffMin / 60);
        const mins = diffMin % 60;
        badgeInativo = `<span class="badge-inativo critico">🔴 Offline (60+)</span>`;
        tempoLabel = `⏱️ ${horas}h ${mins}min`;
        tempoClass = 'tempo-inativo critico';
      }
    }
    
    // ===== RANKING (posição) =====
    if (!periodoIncluiHoje()) {
      badgeInativo = '<span>—</span>';
      tempoLabel = '—';
    }

    let rankingDisplay = '';
    if (!desativado && op.posicao) {
      if (op.posicao <= 3) {
        rankingDisplay = `<span style="font-size:20px;">${op.medalha}</span>`;
      } else {
        rankingDisplay = `<span style="color:#64748b; font-weight:600; font-size:13px;">#${op.posicao}</span>`;
      }
    } else if (desativado) {
      rankingDisplay = `<span style="color:#475569; font-size:13px;">⛔</span>`;
    }
    
    // ===== BOTÃO DE TOGGLE =====
    const toggleBtn = `
      <button class="btn-toggle ${desativado ? 'desativado' : 'ativado'}" 
              data-operador-id="${escaparDashboard(op.id)}"
              data-operador-nome="${escaparDashboard(op.nome)}"
              data-acao="toggle-desativar"
              title="${desativado ? 'Reativar funcionário' : 'Desativar funcionário (folga)'}">
        ${desativado ? '✅ Reativar' : '⛔ Desativar'}
      </button>
    `;
    
    // ===== TABELA COM COLUNA DE RANKING =====
    html += `<tr class="${desativado ? 'linha-desativada' : op.posicao === 1 ? 'linha-lider' : ''}">
      <td style="text-align:center; width:50px;">${rankingDisplay}</td>
      <td>
        <button type="button" class="btn-detalhar" data-detalhar="${escaparDashboard(op.id)}">${escaparDashboard(op.nome)}</button>
        <br><small style="color:#64748b; font-size:10px;">ID: ${escaparDashboard(op.id)}</small>
        ${desativado ? '<br><small style="color:#94a3b8; font-size:10px;">⛔ Em folga</small>' : ''}
      </td>
      <td>${badgeInativo || '<span class="status-offline">🔴 Offline</span>'}</td>
      <td>${op.whatsapp}</td>
      <td>${op.email}</td>
      <td>${op.voucher}</td>
      <td><strong>${op.total}</strong></td>
      <td>${ultimo}</td>
      <td><span class="${tempoClass}">${tempoLabel}</span></td>
      <td>${toggleBtn}</td>
    </tr>`;
  });
  tbody.innerHTML = html;
  filtrarOperadores();
  
  // ===== DELEGAÇÃO DE EVENTOS =====
  const newTbody = tbody.cloneNode(true);
  tbody.parentNode.replaceChild(newTbody, tbody);
  
  document.querySelector('.tabela-container table tbody').addEventListener('click', function(e) {
    const detalhe = e.target.closest('[data-detalhar]');
    if (detalhe) {
      abrirDetalheOperador(agrupado[detalhe.dataset.detalhar]);
      return;
    }
    const target = e.target.closest('.btn-toggle');
    if (!target) return;
    
    const acao = target.dataset.acao;
    if (acao === 'toggle-desativar') {
      const id = target.dataset.operadorId;
      const nome = target.dataset.operadorNome;
      if (id && nome) {
        toggleOperadorDesativado(id, nome);
      }
    }
  });
  
  // ===== GRÁFICOS =====
  atualizarGraficos(operadores);
}

// ================================================================
// ===== ALERTAS DE INATIVIDADE =====
// ================================================================

function periodoIncluiHoje() {
    const hoje = dataSaoPaulo.format(new Date());
    return intervaloExibido && hoje >= intervaloExibido.p_inicio && hoje < intervaloExibido.p_fim_exclusivo;
}

function carregarAlertas() {
    const container = document.getElementById('alertasContainer');
    if (!container) return;
    container.hidden = !periodoIncluiHoje();
    if (container.hidden) return;

    if (!dadosAtuais || dadosAtuais.length === 0) {
        container.innerHTML = `
            <div class="alerta-ok">
                <i class="fas fa-info-circle"></i>
                <span>Aguardando dados...</span>
            </div>
        `;
        container.style.display = 'block';
        return;
    }
    
    const agrupado = agruparPorOperador(dadosAtuais);
    const agora = new Date();
    const criticos = [];
    const atencao = [];
    
    Object.values(agrupado).forEach(op => {
        if (op.desativado) return;
        if (!op.ultimoTimestamp) return;
        
        const diffMs = agora - op.ultimoTimestamp;
        const diffMin = Math.floor(diffMs / 60000);
        
        if (diffMin >= 60) {
            criticos.push({ 
                id: op.id,
                nome: op.nome, 
                tempoInativo: `${Math.floor(diffMin/60)}h ${diffMin%60}min`,
                ultimo: op.ultimo
            });
        } else if (diffMin >= 30) {
            atencao.push({ 
                id: op.id,
                nome: op.nome, 
                tempoInativo: `${diffMin} min`,
                ultimo: op.ultimo
            });
        }
    });
    
    let html = '';
    
    if (criticos.length > 0) {
        const nomes = criticos.map(o => o.nome).join(', ');
        const tempos = criticos.map(o => o.tempoInativo).join(', ');
        html += `
            <div class="alerta-critico">
                <i class="fas fa-exclamation-triangle"></i>
                <div>
                    <strong>🚨 CRÍTICO:</strong> 
                    <span class="destaque">${escaparDashboard(nomes)}</span>
                    está(ão) inativo(s) há mais de 60 minutos!
                    <span style="display:block; font-size:12px; color:#fca5a5; margin-top:4px;">
                        Última atividade: ${tempos}
                    </span>
                </div>
            </div>
        `;
    }
    
    if (atencao.length > 0) {
        const nomes = atencao.map(o => o.nome).join(', ');
        const tempos = atencao.map(o => o.tempoInativo).join(', ');
        html += `
            <div class="alerta-atencao">
                <i class="fas fa-clock"></i>
                <div>
                    <strong>⚠️ ATENÇÃO:</strong> 
                    <span class="destaque">${escaparDashboard(nomes)}</span>
                    está(ão) inativo(s) há mais de 30 minutos!
                    <span style="display:block; font-size:12px; color:#fcd34d; margin-top:4px;">
                        Última atividade: ${tempos}
                    </span>
                </div>
            </div>
        `;
    }
    
    if (criticos.length === 0 && atencao.length === 0) {
        const desativados = getOperadoresDesativados();
        let msgExtra = '';
        if (desativados.length > 0) {
            msgExtra = ` (${desativados.length} funcionário(s) em folga)`;
        }
        html = `
            <div class="alerta-ok">
                <i class="fas fa-check-circle"></i>
                <span>Todos os operadores ativos estão online! 🎉${msgExtra}</span>
            </div>
        `;
    }
    
    container.innerHTML = html;
    container.style.display = 'block';
}

// ================================================================
// ===== POP-UP IGNORA DESATIVADOS =====
// ================================================================

function verificarInatividadePopUp() {
    if (!periodoIncluiHoje()) return;
    chrome.storage.local.get(['isChefe'], (res) => {
        if (!res.isChefe) return;
        if (!dadosAtuais || dadosAtuais.length === 0) return;
        
        const agrupado = agruparPorOperador(dadosAtuais);
        const agora = new Date();
        const jaNotificados = JSON.parse(localStorage.getItem('alertas_notificados') || '{}');
        let alterado = false;
        
        Object.values(agrupado).forEach(op => {
            if (op.desativado) return;
            if (!op.ultimoTimestamp) return;
            
            const diffMs = agora - op.ultimoTimestamp;
            const diffMin = Math.floor(diffMs / 60000);
            const key = op.id;
            
            if (diffMin >= 30 && diffMin < 31 && !jaNotificados[key + '_30']) {
                alert(`🟡 ATENÇÃO: ${op.nome} está inativo há 30 minutos!`);
                jaNotificados[key + '_30'] = true;
                alterado = true;
            }
            
            if (diffMin >= 60 && diffMin < 61 && !jaNotificados[key + '_60']) {
                alert(`🔴 CRÍTICO: ${op.nome} está inativo há 60 minutos!`);
                jaNotificados[key + '_60'] = true;
                alterado = true;
            }
            
            if (diffMin < 30) {
                if (jaNotificados[key + '_30']) {
                    delete jaNotificados[key + '_30'];
                    alterado = true;
                }
                if (jaNotificados[key + '_60']) {
                    delete jaNotificados[key + '_60'];
                    alterado = true;
                }
            }
        });
        
        if (alterado) {
            localStorage.setItem('alertas_notificados', JSON.stringify(jaNotificados));
        }
    });
}

// ================================================================
// ===== BOTÃO POP-UP =====
// ================================================================

function toggleModoChefe() {
    chrome.storage.local.get(['isChefe'], (res) => {
        const novoStatus = !res.isChefe;
        chrome.storage.local.set({ isChefe: novoStatus }, () => {
            atualizarStatusChefe(novoStatus);
            const mensagem = novoStatus ? '✅ Notificação por Pop-Up ativada!' : '❌ Notificação por Pop-Up desativada.';
            mostrarFeedback(mensagem, novoStatus ? 'success' : 'info');
        });
    });
}

function carregarStatusChefe() {
    chrome.storage.local.get(['isChefe'], (res) => {
        atualizarStatusChefe(res.isChefe === true);
    });
}

function atualizarStatusChefe(ativo) {
    const span = document.getElementById('statusChefe');
    const btn = document.getElementById('btnModoChefe');
    if (!span || !btn) return;
    
    if (ativo) {
        span.textContent = '✅ Notificação por Pop-Up Ativa';
        btn.classList.add('ativo');
        btn.style.borderColor = '#10b981';
        btn.style.color = '#10b981';
        btn.style.background = 'rgba(16, 185, 129, 0.1)';
    } else {
        span.textContent = 'Ativar Notificação por Pop-Up';
        btn.classList.remove('ativo');
        btn.style.borderColor = '#64748b';
        btn.style.color = '#94a3b8';
        btn.style.background = 'transparent';
    }
}

function mostrarFeedback(mensagem, tipo = 'info') {
    const container = document.getElementById('alertasContainer');
    if (!container) return;
    
    const cores = {
        success: '#10b981',
        info: '#3b82f6',
        warning: '#f59e0b',
        error: '#ef4444'
    };
    
    const icones = {
        success: 'fa-check-circle',
        info: 'fa-info-circle',
        warning: 'fa-exclamation-triangle',
        error: 'fa-times-circle'
    };
    
    const feedback = document.createElement('div');
    feedback.style.cssText = `
        background: rgba(${cores[tipo] === '#10b981' ? '16,185,129' : cores[tipo] === '#3b82f6' ? '59,130,246' : cores[tipo] === '#f59e0b' ? '245,158,11' : '239,68,68'}, 0.15);
        border: 1px solid ${cores[tipo]};
        color: ${cores[tipo]};
        padding: 12px 16px;
        border-radius: 10px;
        margin-bottom: 10px;
        display: flex;
        align-items: center;
        gap: 10px;
        animation: fadeIn 0.3s ease;
    `;
    feedback.innerHTML = `<i class="fas ${icones[tipo]}"></i> ${escaparDashboard(mensagem)}`;
    
    container.prepend(feedback);
    
    setTimeout(() => {
        feedback.style.opacity = '0';
        feedback.style.transition = 'opacity 0.3s';
        setTimeout(() => feedback.remove(), 300);
    }, 3000);
}

// ================================================================
// ===== GRÁFICOS =====
// ================================================================

function atualizarGraficos(operadores) {
    console.log('📊 Atualizando gráficos...', operadores ? operadores.length : 0, 'operadores');
    
    const containerBarras = document.getElementById('graficoBarras');
    const containerPizza = document.getElementById('graficoPizza');
    
    if (!containerBarras || !containerPizza) {
        console.error('❌ Elementos dos gráficos não encontrados!');
        return;
    }
    
    if (operadores.length === 0) {
        containerBarras.innerHTML = '<div class="sem-dados">Sem dados para exibir</div>';
        containerPizza.innerHTML = '<div class="sem-dados">Sem dados para exibir</div>';
        return;
    }
    
    // ===== GRÁFICO DE BARRAS =====
    const dias = {};
    operadores.forEach(op => {
        op.atividades.forEach(d => {
            const data = d.dia.split('-').reverse().join('/');
            if (!dias[data]) {
                dias[data] = { whatsapp: 0, email: 0, voucher: 0 };
            }
            dias[data].whatsapp += Number(d.whatsapp);
            dias[data].email += Number(d.email);
            dias[data].voucher += Number(d.voucher);
        });
    });
    
    const labels = Object.keys(dias).sort((a, b) => {
        const [da, ma, aa] = a.split('/');
        const [db, mb, ab] = b.split('/');
        return new Date(aa, ma-1, da) - new Date(ab, mb-1, db);
    });
    
    let maxValor = 0;
    labels.forEach(label => {
        const total = dias[label].whatsapp + dias[label].email + dias[label].voucher;
        if (total > maxValor) maxValor = total;
    });
    maxValor = Math.max(maxValor, 1);
    
    let htmlBarras = '';
    if (labels.length === 0) {
        htmlBarras = '<div class="sem-dados">Sem dados para exibir</div>';
    } else {
        labels.forEach(label => {
            const w = dias[label].whatsapp || 0;
            const e = dias[label].email || 0;
            const v = dias[label].voucher || 0;
            const total = w + e + v;
            const altura = Math.max((total / maxValor) * 100, 5);
            
            htmlBarras += `
                <div class="barra-item">
                    <div class="barra-valor">${total}</div>
                    <div class="barra barra-whatsapp" style="height: ${altura * 0.7}%;"></div>
                    <div class="barra barra-email" style="height: ${altura * 0.5}%;"></div>
                    <div class="barra barra-voucher" style="height: ${altura * 0.3}%;"></div>
                    <div class="barra-label">${label}</div>
                </div>
            `;
        });
    }
    
    containerBarras.innerHTML = htmlBarras;
    
    // ===== GRÁFICO DE ROSCA =====
    const totalWhatsapp = operadores.reduce((s, op) => s + op.whatsapp, 0);
    const totalEmail = operadores.reduce((s, op) => s + op.email, 0);
    const totalVoucher = operadores.reduce((s, op) => s + op.voucher, 0);
    const totalGeral = totalWhatsapp + totalEmail + totalVoucher;
    
    if (totalGeral === 0) {
        containerPizza.innerHTML = '<div class="sem-dados">Sem dados para exibir</div>';
        return;
    }
    
    const cores = ['#25D366', '#34B7F1', '#8b5cf6'];
    const valores = [totalWhatsapp, totalEmail, totalVoucher];
    const labelsPizza = ['WhatsApp', 'E-mails', 'Vouchers'];
    
    containerPizza.innerHTML = '';
    
    const pizzaContainer = document.createElement('div');
    pizzaContainer.className = 'pizza-container';
    
    let anguloAtual = 0;
    let temDados = false;
    
    valores.forEach((valor, index) => {
        if (valor === 0) return;
        temDados = true;
        const angulo = (valor / totalGeral) * 360;
        const cor = cores[index];
        
        const slice = document.createElement('div');
        slice.className = 'pizza-slice';
        slice.style.cssText = `
            background: conic-gradient(from ${anguloAtual}deg, ${cor} 0%, ${cor} ${angulo}deg, transparent ${angulo}deg, transparent 100%);
            width: 100%;
            height: 100%;
            position: absolute;
            top: 0;
            left: 0;
            border-radius: 50%;
        `;
        pizzaContainer.appendChild(slice);
        anguloAtual += angulo;
    });
    
    if (!temDados) {
        containerPizza.innerHTML = '<div class="sem-dados">Sem dados para exibir</div>';
        return;
    }
    
    const centro = document.createElement('div');
    centro.style.cssText = `
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 55%;
        height: 55%;
        background: #1e293b;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
        font-weight: 700;
        color: #a855f7;
        flex-direction: column;
        line-height: 1.2;
    `;
    centro.innerHTML = `${totalGeral}<span style="font-size: 10px; color: #64748b; font-weight: 400;">total</span>`;
    pizzaContainer.appendChild(centro);
    
    let legendaHtml = '<div class="pizza-legenda">';
    valores.forEach((valor, index) => {
        const percentual = totalGeral > 0 ? Math.round((valor / totalGeral) * 100) : 0;
        legendaHtml += `
            <div class="pizza-legenda-item">
                <div class="pizza-legenda-cor" style="background: ${cores[index]};"></div>
                <span>${labelsPizza[index]}</span>
                <span class="pizza-legenda-valor">${valor} (${percentual}%)</span>
            </div>
        `;
    });
    legendaHtml += '</div>';
    
    containerPizza.appendChild(pizzaContainer);
    containerPizza.insertAdjacentHTML('beforeend', legendaHtml);
    
    console.log('✅ Gráficos atualizados com sucesso!');
}

// ================================================================
// ===== EVENTOS =====
// ================================================================

document.getElementById('filtroPeriodo').addEventListener('change', e => {
    for (const id of ['dataInicio', 'dataFim']) {
        document.getElementById(id).style.display = e.target.value === 'personalizado' ? 'inline' : 'none';
    }
});

document.getElementById('aplicarFiltro').addEventListener('click', () => {
    const periodo = document.getElementById('filtroPeriodo').value;
    const inicio = document.getElementById('dataInicio').value;
    const fim = document.getElementById('dataFim').value;
    try {
        intervaloDashboard(periodo, new Date(), inicio, fim);
    } catch (erro) {
        document.getElementById('ultimaAtualizacao').textContent = erro.message;
        return;
    }
    filtroPeriodo = periodo;
    dataInicio = inicio;
    dataFim = fim;
    carregarDados();
});

function baixarCSV(linhas, nome) {
  const texto = linhas.map(linha => linha.map(valor => {
    const bruto = String(valor ?? '');
    const seguro = /^[\s]*[=+@-]|^[\t\r\n]/.test(bruto) ? "'" + bruto : bruto;
    return '"' + seguro.replaceAll('"', '""') + '"';
  }).join(';')).join('\r\n');
  const url = URL.createObjectURL(new Blob(['\uFEFF', texto], { type: 'text/csv;charset=utf-8;' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = nome + '.csv';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function filtrarOperadores() {
  const normalizar = texto => texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const busca = normalizar(document.getElementById('buscarOperador').value.trim());
  const botoes = [...document.querySelectorAll('#tabelaCorpo [data-detalhar]')];
  let encontrados = 0;
  for (const botao of botoes) {
    const corresponde = normalizar(botao.textContent + ' ' + botao.dataset.detalhar).includes(busca);
    botao.closest('tr').hidden = !corresponde;
    encontrados += Number(corresponde);
  }
  document.getElementById('buscaSemResultado').hidden = !busca || encontrados > 0;
}

document.getElementById('buscarOperador').addEventListener('input', filtrarOperadores);

function abrirDetalheOperador(operador) {
  const recebimento = operador.atividades.reduce((maximo, linha) =>
    Math.max(maximo, Date.parse(linha.recebido_em) || 0), 0);
  document.getElementById('detalheSincronizacao').textContent = recebimento
    ? 'Último recebimento pelo Supabase no período: ' + new Date(recebimento).toLocaleString('pt-BR', { timeZone: fusoDashboard })
    : 'Horário de recebimento indisponível para os registros deste período.';
  const comparacao = document.getElementById('detalheComparacao');
  comparacao.textContent = 'Comparação individual disponível para semana e mês com dados comparáveis.';
  if (comparacaoIndividual) {
    const { recentes, anteriores, faixaAtual, faixaAnterior } = comparacaoIndividual;
    const diferencas = [['WhatsApp', 'whatsapp'], ['E-mails', 'email'], ['Vouchers', 'voucher']].map(([rotulo, campo]) => {
      const atual = recentes[operador.id]?.[campo] || 0;
      const anterior = anteriores[operador.id]?.[campo] || 0;
      const delta = atual - anterior;
      return rotulo + ' ' + atual + ' × ' + anterior + ' (' + (delta > 0 ? '+' : '') + delta + ')';
    });
    comparacao.textContent = 'Atual (' + faixaAtual + ') × anterior (' + faixaAnterior + '): ' + diferencas.join(' · ');
  }
  const dialogo = document.getElementById('detalheOperador');
  const dias = new Map();
  for (const linha of operador.atividades) {
    const totais = dias.get(linha.dia) || [0, 0, 0];
    totais[0] += Number(linha.whatsapp);
    totais[1] += Number(linha.email);
    totais[2] += Number(linha.voucher);
    dias.set(linha.dia, totais);
  }
  const linhas = [...dias.keys()].sort().map(dia => {
    const totais = dias.get(dia);
    return [dia.split('-').reverse().join('/'), ...totais, totais.reduce((soma, valor) => soma + valor, 0)];
  });
  const intervalo = intervaloExibido;
  dialogo.querySelector('h2').textContent = operador.nome;
  dialogo.querySelector('p').textContent = document.getElementById('periodoExibido').textContent;
  const corpo = dialogo.querySelector('tbody');
  corpo.replaceChildren();
  for (const linha of linhas) {
    const tr = corpo.insertRow();
    for (const valor of linha) tr.insertCell().textContent = valor;
  }
  dialogo.querySelector('[data-exportar]').onclick = () => baixarCSV(
    [['Operador', 'Data', 'WhatsApp', 'E-mails', 'Vouchers', 'Total'],
      ...linhas.map(linha => [operador.nome, ...linha])],
    'metricas_' + operador.id.replace(/[^a-z0-9_-]/gi, '_') + '_' + intervalo.p_inicio
  );
  dialogo.showModal();
}

document.getElementById('exportarCSV').addEventListener('click', () => {
  if (!dadosAtuais.length) return alert('Sem dados para exportar.');
  const linhas = [['Posição', 'Operador', 'Operador ID', 'Status', 'WhatsApp', 'E-mails', 'Vouchers', 'Total', 'Última atividade', 'Tempo inativo']];
  
  // Recalcula ranking para exportação
  const agrupado = agruparPorOperador(dadosAtuais);
  const operadores = Object.values(agrupado);
  const ranking = calcularRanking(operadores);
  const desativados = operadores.filter(op => op.desativado);
  const todos = [...ranking, ...desativados];
  
  todos.forEach(op => {
    const status = !periodoIncluiHoje() ? '—' : op.desativado ? 'Desativado' :
                   op.ultimoTimestamp ? (new Date() - op.ultimoTimestamp < 30*60000 ? 'Online' : 'Offline') : 'Offline';
    const tempo = periodoIncluiHoje() && op.ultimoTimestamp ?
                  (() => { const diff = Math.floor((new Date() - op.ultimoTimestamp)/60000); return diff < 30 ? `${diff} min` : `${Math.floor(diff/60)}h ${diff%60}min`; })() : 
                  'Nunca';
    const posicao = op.desativado ? '⛔' : (op.posicao || '--');
    linhas.push([posicao, op.nome, op.id, status, op.whatsapp, op.email, op.voucher, op.total,
      op.ultimo ? new Date(op.ultimo).toLocaleString('pt-BR', { timeZone: fusoDashboard }) : 'Nunca', tempo]);
  });
  
  const fim = new Date(Date.parse(intervaloExibido.p_fim_exclusivo + 'T00:00:00Z') - 86400000).toISOString().slice(0, 10);
  baixarCSV(linhas, 'metricas_' + intervaloExibido.p_inicio + '_ate_' + fim);
});

// ================================================================
// ===== INICIALIZAÇÃO =====
// ================================================================

function inicializarEventos() {
    document.getElementById('formLogin').addEventListener('submit', evento => {
        evento.preventDefault();
        validarSenha();
    });
    document.getElementById('alternarSenha').addEventListener('click', evento => {
        const senha = document.getElementById('senhaDashboard');
        const mostrar = senha.type === 'password';
        senha.type = mostrar ? 'text' : 'password';
        evento.currentTarget.textContent = mostrar ? 'Ocultar' : 'Mostrar';
        evento.currentTarget.setAttribute('aria-pressed', String(mostrar));
    });
    
    const btnSair = document.getElementById('btnSair');
    if (btnSair) {
        btnSair.addEventListener('click', sair);
    }
    
    const btnModoChefe = document.getElementById('btnModoChefe');
    if (btnModoChefe) {
        btnModoChefe.addEventListener('click', toggleModoChefe);
    }

}

localStorage.removeItem('dashboard_senha_salva');
sessionStorage.removeItem('dashboard_autenticado');
window.addEventListener('storage', evento => {
    if (evento.key === chaveSessaoLembrada && sessaoMaster?.lembrada && lerSessaoLembrada()?.id !== sessaoMaster.id) {
        void sair();
    }
});
void restaurarSessaoLembrada();

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializarEventos);
} else {
    inicializarEventos();
}

setInterval(() => {
    if (sessaoMaster && !document.getElementById('btnLogin').disabled) {
        carregarDados();
        verificarInatividadePopUp();
    }
}, 30000);

setInterval(() => {
    if (sessaoMaster && !document.getElementById('btnLogin').disabled) {
        verificarInatividadePopUp();
    }
}, 10000);

document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        if (dadosAtuais && dadosAtuais.length > 0) {
            console.log('🔄 Forçando atualização dos gráficos...');
            const agrupado = agruparPorOperador(dadosAtuais);
            atualizarGraficos(Object.values(agrupado));
        }
    }, 1000);
});

console.log('✅ Dashboard carregado com sucesso!');
console.log('📌 Funcionários em folga são ignorados nos alertas!');
console.log('🆔 Agrupamento por operador_id (fallback para nome)');
console.log('🏆 Ranking de produtividade com medalhas ativo!');
