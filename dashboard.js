// dashboard.js
// ===== CONFIGURAÇÕES =====
const SENHA_CORRETA = 'icdadmin2024rafachefe';
const CHAVE_SALVAR_SENHA = 'dashboard_senha_salva';
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

function validarSenha() {
    const input = document.getElementById('senhaDashboard');
    const erro = document.getElementById('erroLogin');
    const lembrar = document.getElementById('lembrarSenha');
    const senha = input.value.trim();
    
    if (senha === SENHA_CORRETA) {
        sessionStorage.setItem('dashboard_autenticado', 'true');
        
        if (lembrar.checked) {
            localStorage.setItem(CHAVE_SALVAR_SENHA, 'true');
        }
        
        document.getElementById('telaLogin').style.display = 'none';
        document.getElementById('conteudoDashboard').classList.add('visible');
        
        carregarDados();
        
        input.value = '';
        erro.classList.remove('visible');
    } else {
        erro.classList.add('visible');
        input.value = '';
        input.focus();
        input.select();
    }
}

function sair() {
    sessionStorage.removeItem('dashboard_autenticado');
    localStorage.removeItem(CHAVE_SALVAR_SENHA);
    
    document.getElementById('telaLogin').style.display = 'flex';
    document.getElementById('conteudoDashboard').classList.remove('visible');
    document.getElementById('senhaDashboard').focus();
}

function verificarAutenticacao() {
    if (sessionStorage.getItem('dashboard_autenticado') === 'true') {
        entrarNoDashboard();
        return;
    }
    
    if (localStorage.getItem(CHAVE_SALVAR_SENHA) === 'true') {
        sessionStorage.setItem('dashboard_autenticado', 'true');
        entrarNoDashboard();
        return;
    }
    
    document.getElementById('telaLogin').style.display = 'flex';
    document.getElementById('senhaDashboard').focus();
}

function entrarNoDashboard() {
    document.getElementById('telaLogin').style.display = 'none';
    document.getElementById('conteudoDashboard').classList.add('visible');
    carregarDados();
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
    const agrupado = {};
    
    dados.forEach(d => {
        // ===== PRIORIZA operador_id, FALLBACK para nome =====
        let id = d.operador_id;
        let nome = d.operador;
        
        // Se não tem operador_id, gera a partir do nome
        if (!id && nome) {
            id = gerarIdUnico(nome);
        }
        
        // Se não tem nome, usa o ID como nome
        if (!nome && id) {
            nome = id;
        }
        
        // Se não tem nada, ignora
        if (!id || !nome) return;
        
        if (!agrupado[id]) {
            agrupado[id] = {
                id: id,
                nome: nome,
                whatsapp: 0,
                email: 0,
                voucher: 0,
                ultimo: null,
                ultimoTimestamp: null,
                desativado: isOperadorDesativado(id),
                atividades: []
            };
        }
        
        // Soma as métricas (apenas se não estiver desativado)
        if (!agrupado[id].desativado) {
            if (d.tipo === 'whatsapp') agrupado[id].whatsapp++;
            else if (d.tipo === 'email') agrupado[id].email++;
            else if (d.tipo === 'voucher') agrupado[id].voucher++;
        }
        
        // Atualiza última atividade
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
// ===== DASHBOARD =====
// ================================================================

let dadosAtuais = [];
let filtroPeriodo = 'semana';
let dataInicio = null;
let dataFim = null;

async function carregarDados() {
  try {
    const response = await fetch(`${SUPABASE_URL}?select=*&order=timestamp.desc`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });
    
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const dados = await response.json();
    
    dadosAtuais = filtrarPorPeriodo(dados);
    renderizar(dadosAtuais);
    carregarAlertas();
    carregarStatusChefe();
    document.getElementById('ultimaAtualizacao').textContent =
      `Última atualização: ${new Date().toLocaleString()}`;
  } catch (error) {
    console.error('Erro ao carregar dashboard:', error);
    document.getElementById('tabelaCorpo').innerHTML =
      `<tr><td colspan="8" style="text-align:center; color:#ef4444;">Erro ao carregar dados. Verifique a conexão com o Supabase.</td></tr>`;
  }
}

function filtrarPorPeriodo(dados) {
  const agora = new Date();
  let limite = new Date();
  
  switch(filtroPeriodo) {
    case 'hoje':
      limite.setHours(0, 0, 0, 0);
      break;
    case 'semana':
      limite.setDate(agora.getDate() - 7);
      break;
    case 'mes':
      limite.setMonth(agora.getMonth() - 1);
      break;
    case 'personalizado':
      if (dataInicio && dataFim) {
        return dados.filter(d => new Date(d.timestamp) >= new Date(dataInicio) && new Date(d.timestamp) <= new Date(dataFim));
      }
      return dados;
    default:
      return dados;
  }
  
  return dados.filter(d => new Date(d.timestamp) >= limite);
}

function renderizar(dados) {
  // ===== AGRUPA POR OPERADOR_ID =====
  const agrupado = agruparPorOperador(dados);
  const operadores = Object.values(agrupado);
  
  // ===== CARDS =====
  const operadoresAtivos = operadores.filter(op => !op.desativado);
  const totalOps = operadoresAtivos.length;
  
  document.getElementById('totalOperadores').textContent = totalOps;
  document.getElementById('totalWhatsapp').textContent = operadoresAtivos.reduce((s, op) => s + op.whatsapp, 0);
  document.getElementById('totalEmails').textContent = operadoresAtivos.reduce((s, op) => s + op.email, 0);
  document.getElementById('totalVouchers').textContent = operadoresAtivos.reduce((s, op) => s + op.voucher, 0);

  // ===== TABELA =====
  const tbody = document.getElementById('tabelaCorpo');
  if (operadores.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:#64748b;">Nenhuma atividade registrada no período.</td></tr>`;
    return;
  }

  const sorted = operadores.sort((a, b) => {
    const totalA = a.whatsapp + a.email + a.voucher;
    const totalB = b.whatsapp + b.email + b.voucher;
    return totalB - totalA;
  });

  let html = '';
  sorted.forEach(op => {
    const desativado = op.desativado;
    const ultimo = op.ultimo ? new Date(op.ultimo).toLocaleString() : 'Nunca';
    const ultimoTimestamp = op.ultimoTimestamp;
    
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
    
    // ===== BOTÃO DE TOGGLE =====
    const toggleBtn = `
      <button class="btn-toggle ${desativado ? 'desativado' : 'ativado'}" 
              data-operador-id="${op.id}"
              data-operador-nome="${op.nome.replace(/"/g, '&quot;')}"
              data-acao="toggle-desativar"
              title="${desativado ? 'Reativar funcionário' : 'Desativar funcionário (folga)'}">
        ${desativado ? '✅ Reativar' : '⛔ Desativar'}
      </button>
    `;
    
    // ===== TABELA =====
    html += `<tr class="${desativado ? 'linha-desativada' : ''}">
      <td>
        <strong>${op.nome}</strong>
        <br><small style="color:#64748b; font-size:10px;">ID: ${op.id}</small>
        ${desativado ? '<br><small style="color:#94a3b8; font-size:10px;">⛔ Em folga</small>' : ''}
      </td>
      <td>${badgeInativo || '<span class="status-offline">🔴 Offline</span>'}</td>
      <td>${desativado ? '--' : op.whatsapp}</td>
      <td>${desativado ? '--' : op.email}</td>
      <td>${desativado ? '--' : op.voucher}</td>
      <td>${ultimo}</td>
      <td><span class="${tempoClass}">${tempoLabel}</span></td>
      <td>${toggleBtn}</td>
    </tr>`;
  });
  tbody.innerHTML = html;
  
  // ===== DELEGAÇÃO DE EVENTOS =====
  const newTbody = tbody.cloneNode(true);
  tbody.parentNode.replaceChild(newTbody, tbody);
  
  document.querySelector('.tabela-container table tbody').addEventListener('click', function(e) {
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

function carregarAlertas() {
    const container = document.getElementById('alertasContainer');
    if (!container) return;
    
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
                    <span class="destaque">${nomes}</span> 
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
                    <span class="destaque">${nomes}</span> 
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
    feedback.innerHTML = `<i class="fas ${icones[tipo]}"></i> ${mensagem}`;
    
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
    
    const ativos = operadores.filter(op => !op.desativado);
    
    if (ativos.length === 0) {
        containerBarras.innerHTML = '<div class="sem-dados">Sem dados para exibir</div>';
        containerPizza.innerHTML = '<div class="sem-dados">Sem dados para exibir</div>';
        return;
    }
    
    // ===== GRÁFICO DE BARRAS =====
    const dias = {};
    ativos.forEach(op => {
        op.atividades.forEach(d => {
            const data = new Date(d.timestamp).toLocaleDateString('pt-BR');
            if (!dias[data]) {
                dias[data] = { whatsapp: 0, email: 0, voucher: 0 };
            }
            if (d.tipo === 'whatsapp') dias[data].whatsapp++;
            else if (d.tipo === 'email') dias[data].email++;
            else if (d.tipo === 'voucher') dias[data].voucher++;
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
    const totalWhatsapp = ativos.reduce((s, op) => s + op.whatsapp, 0);
    const totalEmail = ativos.reduce((s, op) => s + op.email, 0);
    const totalVoucher = ativos.reduce((s, op) => s + op.voucher, 0);
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

document.getElementById('aplicarFiltro').addEventListener('click', () => {
  filtroPeriodo = document.getElementById('filtroPeriodo').value;
  if (filtroPeriodo === 'personalizado') {
    dataInicio = document.getElementById('dataInicio').value;
    dataFim = document.getElementById('dataFim').value;
    document.getElementById('dataInicio').style.display = 'inline';
    document.getElementById('dataFim').style.display = 'inline';
    if (!dataInicio || !dataFim) {
      alert('Selecione as datas de início e fim.');
      return;
    }
  } else {
    document.getElementById('dataInicio').style.display = 'none';
    document.getElementById('dataFim').style.display = 'none';
  }
  carregarDados();
});

document.getElementById('exportarCSV').addEventListener('click', () => {
  if (!dadosAtuais.length) return alert('Sem dados para exportar.');
  let csv = 'Operador,Operador_ID,Tipo,Timestamp,Detalhes\n';
  dadosAtuais.forEach(d => {
    const detalhes = d.detalhes ? JSON.stringify(d.detalhes).replace(/,/g, ';') : '';
    const id = d.operador_id || gerarIdUnico(d.operador) || 'desconhecido';
    csv += `${d.operador},${id},${d.tipo},${d.timestamp},"${detalhes}"\n`;
  });
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `relatorio_${new Date().toISOString().slice(0,10)}.csv`;
  link.click();
});

// ================================================================
// ===== INICIALIZAÇÃO =====
// ================================================================

function inicializarEventos() {
    const btnLogin = document.getElementById('btnLogin');
    if (btnLogin) {
        btnLogin.addEventListener('click', validarSenha);
    }
    
    const btnSair = document.getElementById('btnSair');
    if (btnSair) {
        btnSair.addEventListener('click', sair);
    }
    
    const btnModoChefe = document.getElementById('btnModoChefe');
    if (btnModoChefe) {
        btnModoChefe.addEventListener('click', toggleModoChefe);
    }
    
    const senhaInput = document.getElementById('senhaDashboard');
    if (senhaInput) {
        senhaInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                validarSenha();
            }
        });
    }
}

verificarAutenticacao();

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializarEventos);
} else {
    inicializarEventos();
}

setInterval(() => {
    if (sessionStorage.getItem('dashboard_autenticado') === 'true') {
        carregarDados();
        verificarInatividadePopUp();
    }
}, 30000);

setInterval(() => {
    if (sessionStorage.getItem('dashboard_autenticado') === 'true') {
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
console.log('🔑 Senha: icdadmin2024');
console.log('📌 Funcionários em folga são ignorados nos alertas!');
console.log('🆔 Agrupamento por operador_id (fallback para nome)');