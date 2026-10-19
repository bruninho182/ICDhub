// ========== options.js - Versão com Pastas, Anotações, CPF/CNPJ/Passaporte, Organização e E-mail ==========

// Inicialização principal
document.addEventListener("DOMContentLoaded", () => {
  inicializarTabs();
  carregarPastasNoSelect();
  renderizarListaAtalhos();
  carregarNotas();
  inicializarEventos();
  renderizarListaPasseios();
  configurarMascaraDocumento();
  carregarPastasParaOrganizar();
});

// ==================== Sistema de Tabs ====================
function inicializarTabs() {
  const tabButtons = document.querySelectorAll(".tab-btn");
  const tabContents = document.querySelectorAll(".aba-conteudo");
  tabButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      tabButtons.forEach(b => b.classList.remove("active"));
      tabContents.forEach(c => c.classList.remove("active"));
      btn.classList.add("active");
      const target = document.getElementById(btn.getAttribute("data-target"));
      if (target) target.classList.add("active");
    });
  });
}

// ==================== 🚀 ORGANIZAR BOTÕES POR PASTA (COM NÚMERO DE ORDEM) ====================
function carregarPastasParaOrganizar() {
    const select = document.getElementById("selectOrganizarPasta");
    if (!select) return;

    chrome.storage.local.get(["listaPastas"], (res) => {
        const pastas = res.listaPastas || [];
        select.innerHTML = '<option value="">Selecione...</option>';
        pastas.forEach(pasta => {
            const option = document.createElement("option");
            option.value = pasta;
            option.textContent = pasta;
            select.appendChild(option);
        });

        const optionGeral = document.createElement("option");
        optionGeral.value = "Geral";
        optionGeral.textContent = "Geral (Sem Pasta)";
        select.appendChild(optionGeral);
    });

    select.onchange = () => {
        renderizarBotoesDaPastaParaOrganizar(select.value);
    };
}

function renderizarBotoesDaPastaParaOrganizar(nomePasta) {
    const container = document.getElementById("listaOrganizarBotoes");
    if (!container) return;

    if (!nomePasta) {
        container.innerHTML = '<div class="lista-vazia"><i class="fas fa-hand-pointer"></i><p>Selecione uma pasta acima para ver os botões.</p></div>';
        return;
    }

    chrome.storage.local.get(["configMaster"], (res) => {
        const botoes = res.configMaster || [];
        const botoesDaPasta = botoes.filter(b => (b.pasta || "Geral") === nomePasta);

        if (botoesDaPasta.length === 0) {
            container.innerHTML = '<div class="lista-vazia"><i class="fas fa-inbox"></i><p>Nenhum botão nesta pasta ainda.</p></div>';
            return;
        }

        container.innerHTML = "";
        botoesDaPasta.forEach((botao, index) => {
            const item = document.createElement("div");
            item.style = "display: flex; align-items: center; gap: 10px; background: rgba(15, 23, 42, 0.6); padding: 10px 15px; border-radius: 10px; border: 1px solid rgba(139, 92, 246, 0.2);";
            
            item.innerHTML = `
                <input type="number" class="input-ordem-painel" data-id="${botao.id}" value="${index + 1}" min="1" style="width: 50px; padding: 8px; text-align: center; font-weight: bold; color: #a78bfa; background: rgba(139, 92, 246, 0.1); border: 1px solid rgba(139, 92, 246, 0.3); border-radius: 6px; font-size: 14px; outline: none; font-family: 'Inter', sans-serif;">
                <span style="flex: 1; color: #f1f5f9; font-size: 13px;">${escapeHtml(botao.nome)}</span>
            `;
            container.appendChild(item);
        });

        container.querySelectorAll('.input-ordem-painel').forEach(input => {
            const idBotao = input.dataset.id;

            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    moverBotaoParaPosicao(idBotao, input.value, nomePasta);
                }
            });

            input.addEventListener('blur', () => {
                moverBotaoParaPosicao(idBotao, input.value, nomePasta);
            });

            input.addEventListener('focus', () => {
                input.select();
            });
        });
    });
}

function moverBotaoParaPosicao(idBotao, novaPosicao, nomePasta) {
    const pos = parseInt(novaPosicao);
    if (isNaN(pos) || pos < 1) {
        renderizarBotoesDaPastaParaOrganizar(nomePasta);
        return;
    }

    chrome.storage.local.get(["configMaster"], (res) => {
        let botoes = res.configMaster || [];
        
        const botoesDaPasta = botoes.filter(b => (b.pasta || "Geral") === nomePasta);
        const outrosBotoes = botoes.filter(b => (b.pasta || "Geral") !== nomePasta);

        const idxAtual = botoesDaPasta.findIndex(b => b.id === idBotao);
        if (idxAtual === -1) return;

        let novoIdx = pos - 1;
        if (novoIdx < 0) novoIdx = 0;
        if (novoIdx >= botoesDaPasta.length) novoIdx = botoesDaPasta.length - 1;

        if (novoIdx === idxAtual) {
            renderizarBotoesDaPastaParaOrganizar(nomePasta);
            return;
        }

        const [botaoMovido] = botoesDaPasta.splice(idxAtual, 1);
        botoesDaPasta.splice(novoIdx, 0, botaoMovido);

        const listaFinal = [...outrosBotoes, ...botoesDaPasta];
        chrome.storage.local.set({ configMaster: listaFinal }, () => {
            renderizarBotoesDaPastaParaOrganizar(nomePasta);
            renderizarListaAtalhos();
            mostrarNotificacao(`✅ Botão movido para a posição ${novoIdx + 1}`, 'success');
        });
    });
}

// ==================== 🚀 MÁSCARA DINÂMICA CPF/CNPJ/PASSAPORTE ====================
function configurarMascaraDocumento() {
  const selectTipoDoc = document.getElementById("reciboTipoDocumento");
  const inputDoc = document.getElementById("reciboDocumento");

  if (!selectTipoDoc || !inputDoc) return;

  function aplicarMascara() {
    const tipo = selectTipoDoc.value;

    if (tipo === 'PASSAPORTE') {
      inputDoc.value = inputDoc.value.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 20);
      inputDoc.placeholder = "Ex: AB123456";
      inputDoc.maxLength = 20;
      return;
    }

    let valor = inputDoc.value.replace(/\D/g, '');

    if (tipo === 'CPF') {
      valor = valor.substring(0, 11);
      valor = valor.replace(/(\d{3})(\d)/, '$1.$2');
      valor = valor.replace(/(\d{3})(\d)/, '$1.$2');
      valor = valor.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
      inputDoc.placeholder = "000.000.000-00";
      inputDoc.maxLength = 14;
    } else if (tipo === 'CNPJ') {
      valor = valor.substring(0, 14);
      valor = valor.replace(/^(\d{2})(\d)/, '$1.$2');
      valor = valor.replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3');
      valor = valor.replace(/\.(\d{3})(\d)/, '.$1/$2');
      valor = valor.replace(/(\d{4})(\d)/, '$1-$2');
      inputDoc.placeholder = "00.000.000/0000-00";
      inputDoc.maxLength = 18;
    }
    inputDoc.value = valor;
  }

  inputDoc.addEventListener('input', aplicarMascara);
  selectTipoDoc.addEventListener('change', () => {
    inputDoc.value = '';
    aplicarMascara();
  });
}

// ==================== GERENCIAMENTO DE PASTAS ====================
function carregarPastasNoSelect() {
    const select = document.getElementById("selectPastaBotao");
    if (!select) return;

    chrome.storage.local.get(["listaPastas"], (res) => {
        const pastas = res.listaPastas || [];
        select.innerHTML = '<option value="Geral">Geral (Sem Pasta)</option>';
        pastas.forEach(pasta => {
            const option = document.createElement("option");
            option.value = pasta;
            option.textContent = pasta;
            select.appendChild(option);
        });
    });
}

document.getElementById("btnNovaPasta")?.addEventListener("click", () => {
    const nomePasta = prompt("Digite o nome da nova pasta:");
    if (nomePasta && nomePasta.trim()) {
        chrome.storage.local.get(["listaPastas"], (res) => {
            const pastas = res.listaPastas || [];
            const nomeLimpo = nomePasta.trim();
            
            if (!pastas.includes(nomeLimpo)) {
                pastas.push(nomeLimpo);
                chrome.storage.local.set({ listaPastas: pastas }, () => {
                    carregarPastasNoSelect();
                    carregarPastasParaOrganizar();
                    document.getElementById("selectPastaBotao").value = nomeLimpo;
                    mostrarNotificacao(`📁 Pasta "${nomeLimpo}" criada!`, 'success');
                });
            } else {
                alert("Essa pasta já existe!");
            }
        });
    }
});

// ==================== ANOTAÇÕES ====================
let notas = [];

async function salvarNotasStorage() {
  await chrome.storage.local.set({ icd_notas_array: notas });
  renderizarListaNotas();
}

async function carregarNotas() {
  const result = await chrome.storage.local.get(['icd_notas_array']);
  notas = (result.icd_notas_array && Array.isArray(result.icd_notas_array)) ? result.icd_notas_array : [];
  renderizarListaNotas();
}

async function adicionarNota() {
  const textarea = document.getElementById('novaNotaTexto');
  const texto = textarea.value.trim();
  if (!texto) {
    mostrarNotificacao('✏️ Digite o conteúdo da anotação!', 'info');
    return;
  }
  const novaNota = {
    id: Date.now(),
    texto: texto,
    dataCriacao: new Date().toISOString()
  };
  notas.unshift(novaNota);
  textarea.value = '';
  await salvarNotasStorage();
  mostrarNotificacao('✅ Nota adicionada!', 'success');
}

async function editarNota(id) {
  const nota = notas.find(n => n.id == id);
  if (!nota) return;
  const novoTexto = prompt('Editar anotação:', nota.texto);
  if (novoTexto && novoTexto.trim()) {
    nota.texto = novoTexto.trim();
    await salvarNotasStorage();
    mostrarNotificacao('✏️ Nota atualizada!', 'success');
  }
}

async function excluirNota(id) {
  if (!confirm('Excluir esta anotação?')) return;
  notas = notas.filter(n => n.id != id);
  await salvarNotasStorage();
  mostrarNotificacao('🗑️ Nota excluída!', 'info');
}

function renderizarListaNotas() {
  const container = document.getElementById('listaNotasContainer');
  if (!container) return;
  if (notas.length === 0) {
    container.innerHTML = '<div class="lista-vazia"><i class="fas fa-inbox"></i><p>Nenhuma anotação ainda. Crie uma acima!</p></div>';
    return;
  }
  let html = '';
  for (const nota of notas) {
    const data = new Date(nota.dataCriacao).toLocaleString();
    html += `
      <div class="nota-item" data-id="${nota.id}">
        <div class="nota-header">
          <div class="nota-titulo">📝 ${data.split(',')[0]}</div>
          <div style="display: flex; gap: 6px;">
            <button class="btn-editar-nota" data-id="${nota.id}"><i class="fas fa-edit"></i></button>
            <button class="btn-excluir-nota" data-id="${nota.id}"><i class="fas fa-trash-alt"></i></button>
          </div>
        </div>
        <div class="nota-conteudo">${escapeHtml(nota.texto)}</div>
        <div class="nota-footer"><small><i class="far fa-calendar-alt"></i> Criado em: ${data}</small></div>
      </div>
    `;
  }
  container.innerHTML = html;
  document.querySelectorAll('.btn-editar-nota').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      editarNota(btn.getAttribute('data-id'));
    });
  });
  document.querySelectorAll('.btn-excluir-nota').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      excluirNota(btn.getAttribute('data-id'));
    });
  });
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>]/g, function(m) {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    return m;
  });
}

// ==================== ATALHOS (Drag & Drop com Pastas) ====================
let configBotoes = [];
let dragSrcIndex = null;

function renderizarListaAtalhos() {
  const container = document.getElementById("listaBotoes");
  if (!container) return;
  chrome.storage.local.get(["configMaster"], (res) => {
    configBotoes = res.configMaster || [];
    if (configBotoes.length === 0) {
      container.innerHTML = `<div class="lista-vazia"><i class="fas fa-inbox"></i><p>Nenhum atalho configurado</p><p style="font-size: 11px;">Adicione seu primeiro atalho ao lado ➔</p></div>`;
      return;
    }
    
    container.innerHTML = "";

    const grupos = {};
    configBotoes.forEach((botao, index) => {
        botao._originalIndex = index; 
        const pasta = botao.pasta || "Geral";
        if (!grupos[pasta]) grupos[pasta] = [];
        grupos[pasta].push(botao);
    });

    for (const [nomePasta, botoes] of Object.entries(grupos)) {
        const headerPasta = document.createElement("div");
        headerPasta.className = "pasta-header-painel";
        headerPasta.innerHTML = `<i class="fas fa-folder-open"></i> ${nomePasta}`;
        headerPasta.style = "margin-top: 15px; margin-bottom: 10px; color: #8b5cf6; font-weight: bold; font-size: 14px; border-bottom: 1px solid #334155; padding-bottom: 5px;";
        container.appendChild(headerPasta);

        botoes.forEach((botao) => {
            const idx = botao._originalIndex;
            const item = document.createElement("div");
            item.className = "item-lista";
            item.draggable = true;
            item.dataset.index = idx;
            item.innerHTML = `
                <span class="posicao-badge">${idx+1}</span>
                <span class="drag-handle"></span>
                <div class="info"><strong>${escapeHtml(botao.nome || "Sem nome")}</strong><p>${escapeHtml((botao.texto || "").substring(0,40))}...</p></div>
                <div class="acoes">
                <button class="btn-edit" data-index="${idx}"><i class="fas fa-edit"></i> Editar</button>
                <button class="btn-del" data-index="${idx}"><i class="fas fa-trash"></i> Excluir</button>
                </div>
            `;
            item.addEventListener("dragstart", handleDragStart);
            item.addEventListener("dragover", handleDragOver);
            item.addEventListener("drop", handleDrop);
            item.addEventListener("dragend", handleDragEnd);
            container.appendChild(item);
        });
    }

    document.querySelectorAll(".btn-edit").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.getAttribute("data-index"));
        preencherParaEditar(idx);
      });
    });
    document.querySelectorAll(".btn-del").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.getAttribute("data-index"));
        if (confirm("Deseja realmente excluir este atalho?")) {
          configBotoes.splice(idx, 1);
          salvarShortcuts();
        }
      });
    });
  });
}

function handleDragStart(e) {
  dragSrcIndex = this.dataset.index;
  this.style.opacity = "0.4";
  e.dataTransfer.effectAllowed = "move";
}
function handleDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = "move";
  return false;
}
function handleDrop(e) {
  e.stopPropagation();
  const targetIndex = this.dataset.index;
  if (dragSrcIndex !== targetIndex) {
    const movedItem = configBotoes.splice(dragSrcIndex, 1)[0];
    configBotoes.splice(targetIndex, 0, movedItem);
    salvarShortcuts();
  }
  return false;
}
function handleDragEnd(e) {
  this.style.opacity = "1";
}
function preencherParaEditar(index) {
  const btn = configBotoes[index];
  document.getElementById("novoNomeBotao").value = btn.nome;
  document.getElementById("novoTextoBotao").value = btn.texto;
  document.getElementById("novaImagemBotao").value = btn.imagem || "";
  
  const selectPasta = document.getElementById("selectPastaBotao");
  if(selectPasta) {
      selectPasta.value = btn.pasta || "Geral";
  }

  document.getElementById("editIndex").value = index;
  document.getElementById("tituloForm").innerText = "📝 Editando Atalho";
  document.getElementById("btnCancelarEdicao").style.display = "block";
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function limparFormularioAtalho() {
  document.getElementById("novoNomeBotao").value = "";
  document.getElementById("novoTextoBotao").value = "";
  document.getElementById("novaImagemBotao").value = "";
  document.getElementById("selectPastaBotao").value = "Geral"; 
  document.getElementById("editIndex").value = "-1";
  document.getElementById("tituloForm").innerText = "➕ Adicionar Novo Atalho";
  document.getElementById("btnCancelarEdicao").style.display = "none";
}
function salvarShortcuts() {
  chrome.storage.local.set({ configMaster: configBotoes }, () => {
    renderizarListaAtalhos();
  });
}

// ==================== RECIBO PDF ====================
function gerarReciboPDF() {
  if (typeof window.jspdf === 'undefined') {
    console.error('jsPDF não encontrado!');
    alert('❌ Erro: Biblioteca jsPDF não carregada.');
    return;
  }

  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const roxoICD = [97, 45, 135];
    const cinzaClaro = [150, 150, 150];
    
    const logoUrl = 'icons/logo-icd-recibo.png';
    try { doc.addImage(logoUrl, 'PNG', 165, 15, 25, 25); } catch(e) {}
    
    doc.setTextColor(roxoICD[0], roxoICD[1], roxoICD[2]);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(24);
    doc.text("Recibo", 105, 35, { align: "center" });
    
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    
    const pagamento = document.getElementById("reciboPagamento")?.value || "PIX";
    const nomeCliente = document.getElementById("reciboNome")?.value || "NÃO INFORMADO";
    const passeio = document.getElementById("reciboPasseio")?.value || "NÃO INFORMADO";
    const descricao = document.getElementById("reciboDescricaoIngressos")?.value || "";
    const voucher = document.getElementById("reciboVoucher")?.value || "NÃO INFORMADO";
    const valorTotal = document.getElementById("reciboTotal")?.value || "0,00";
    const dataCompra = document.getElementById("reciboDataCompra")?.value;
    const dataVisita = document.getElementById("reciboDataVisita")?.value;
    
    const tipoDocumento = document.getElementById("reciboTipoDocumento")?.value || "CPF";
    const numeroDocumento = document.getElementById("reciboDocumento")?.value || "NÃO INFORMADO";
    
    const dataCompraFormatada = dataCompra ? dataCompra.split('-').reverse().join('/') : "___/___/____";
    const dataVisitaFormatada = dataVisita ? dataVisita.split('-').reverse().join('/') : "___/___/____";
    
    const textoDeclaracao = `O GRUPO ICD, inscrito no CNPJ 10.335.415/0001-70, declara ter recebido os valores descritos abaixo,\nreferente ao pagamento via ${pagamento} pago por ${nomeCliente.toUpperCase()}, inscrito no ${tipoDocumento}: ${numeroDocumento}.`;
    const splitTexto = doc.splitTextToSize(textoDeclaracao, 170);
    doc.text(splitTexto, 20, 55);
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Dados da Compra:", 20, 85);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(passeio, 25, 98);
    doc.setFont("helvetica", "normal");
    
    let yDescricao = 108;
    if (descricao) {
      const linhasDescricao = doc.splitTextToSize(descricao, 160);
      doc.text(linhasDescricao, 25, yDescricao);
      yDescricao += (linhasDescricao.length * 5);
    } else { yDescricao = 108; }
    
    const yTabela = Math.max(yDescricao + 10, 125);
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.5);
    doc.line(20, yTabela, 190, yTabela);
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("Data da Compra", 25, yTabela + 7);
    doc.text("Voucher", 85, yTabela + 7);
    doc.text("Data da Visita", 125, yTabela + 7);
    doc.text("Valor", 170, yTabela + 7, { align: "right" });
    doc.line(20, yTabela + 10, 190, yTabela + 10);
    
    doc.setFont("helvetica", "normal");
    doc.text(dataCompraFormatada, 25, yTabela + 20);
    doc.text(voucher, 85, yTabela + 20);
    doc.text(dataVisitaFormatada, 125, yTabela + 20);
    doc.text(`R$ ${valorTotal}`, 170, yTabela + 20, { align: "right" });
    doc.line(20, yTabela + 23, 190, yTabela + 23);
    
    doc.setFont("helvetica", "bold");
    doc.text("Total", 140, yTabela + 38);
    doc.text(`R$ ${valorTotal}`, 185, yTabela + 38, { align: "right" });
    doc.setFont("helvetica", "normal");
    
    const dataAtual = new Date();
    const meses = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
    const dataExtenso = `Itatiba, ${dataAtual.getDate()} de ${meses[dataAtual.getMonth()]} de ${dataAtual.getFullYear()}.`;
    doc.text(dataExtenso, 190, yTabela + 58, { align: "right" });
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Grupo ICD", 105, yTabela + 75, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(cinzaClaro[0], cinzaClaro[1], cinzaClaro[2]);
    
    const endereco = "Av. Pref. José Maurício de Camargo, 320, Jardim Nossa Sra. Da Graças – Office Mall Sala J52\nItatiba – SP CEP 13257-900\nTel. (11) 4412-5454";
    const linhasEndereco = doc.splitTextToSize(endereco, 170);
    doc.text(linhasEndereco, 105, 270, { align: "center" });
    
    doc.save(`RECIBO - ${voucher}.pdf`);
    mostrarNotificacao('✅ Recibo gerado com sucesso!', 'success');
    
  } catch (error) {
    console.error('Erro ao gerar PDF:', error);
    alert('❌ Erro ao gerar o recibo.');
  }
}

// ==================== CALCULADORA DE PASSEIOS ====================
let editPasseioIndex = -1;

function adicionarLinhaPreco(tipo = "", valor = "") {
  const container = document.getElementById("container-precos");
  const novaLinha = document.createElement("div");
  novaLinha.className = "linha-preco";
  novaLinha.style = "display: flex; gap: 5px; margin-bottom: 5px;";
  novaLinha.innerHTML = `
    <input type="text" placeholder="Tipo (Ex: Infantil)" class="tipo-ingresso" value="${escapeHtml(tipo)}" style="flex: 2; padding: 5px;">
    <input type="number" placeholder="Valor" class="valor-ingresso" value="${valor}" style="flex: 1; padding: 5px;">
    <button class="btn-remover-preco" style="background:none; border:none; cursor:pointer;">❌</button>
  `;
  container.appendChild(novaLinha);
  novaLinha.querySelector(".btn-remover-preco").addEventListener("click", () => novaLinha.remove());
}

function limparFormularioPasseio() {
  document.getElementById("nomePasseio").value = "";
  document.getElementById("container-precos").innerHTML = `
    <div class="linha-preco" style="display: flex; gap: 5px; margin-bottom: 5px;">
      <input type="text" placeholder="Tipo (Ex: Adulto)" class="tipo-ingresso" style="flex: 2; padding: 5px;">
      <input type="number" placeholder="Valor" class="valor-ingresso" style="flex: 1; padding: 5px;">
    </div>
  `;
}

function renderizarListaPasseios() {
  chrome.storage.local.get(["listaPasseios"], (res) => {
    const container = document.getElementById("lista-passeios-config");
    const lista = res.listaPasseios || [];
    container.innerHTML = "";
    lista.forEach((p, index) => {
      const item = document.createElement("div");
      item.style = "background: rgba(15, 23, 42, 0.6); padding: 16px; margin-bottom: 10px; border-radius: 12px; display: flex; justify-content: space-between; align-items: center; border: 1px solid rgba(255, 255, 255, 0.08); border-left: 4px solid #8b5cf6; transition: all 0.3s ease;";
      item.innerHTML = `
        <div style="font-size: 13px; flex: 1; min-width: 0;">
          <strong style="color: #f1f5f9; display: block; margin-bottom: 4px;">${escapeHtml(p.nome)}</strong>
          <small style="color: #94a3b8;"><i class="fas fa-ticket-alt" style="color: #8b5cf6; font-size: 10px; margin-right: 5px;"></i>${p.ingressos.length} categorias cadastradas</small>
        </div>
        <div style="display: flex; gap: 8px; flex-shrink: 0; margin-left: 15px;">
          <button class="btn-editar-p" data-index="${index}" style="background: rgba(59, 130, 246, 0.2); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.3); border-radius: 8px; cursor:pointer; padding: 8px 14px; font-size:11px; font-weight: 600;">Editar</button>
          <button class="btn-excluir-p" data-index="${index}" style="background: transparent; color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 8px; cursor:pointer; padding: 8px 14px; font-size:11px; font-weight: 600;">Excluir</button>
        </div>
      `;
      container.appendChild(item);
    });
    document.querySelectorAll(".btn-excluir-p").forEach(btn => {
      btn.addEventListener("click", (e) => {
        if (confirm("Tem certeza que deseja excluir este passeio?")) {
          const idx = e.target.getAttribute("data-index");
          lista.splice(idx, 1);
          chrome.storage.local.set({ listaPasseios: lista }, () => renderizarListaPasseios());
        }
      });
    });
    document.querySelectorAll(".btn-editar-p").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const idx = e.target.getAttribute("data-index");
        const p = lista[idx];
        document.getElementById("nomePasseio").value = p.nome;
        const containerPrecos = document.getElementById("container-precos");
        containerPrecos.innerHTML = "";
        p.ingressos.forEach(ing => adicionarLinhaPreco(ing.tipo, ing.valor));
        editPasseioIndex = idx;
        const btnSalvar = document.getElementById("btn-salvar-passeio");
        btnSalvar.innerText = "Confirmar Alteração";
        btnSalvar.style.background = "#ffa500";
        document.getElementById("nomePasseio").scrollIntoView({ behavior: "smooth" });
      });
    });
  });
}

// ==================== INICIALIZAÇÃO DE EVENTOS ====================
function inicializarEventos() {
  const btnSalvarAtalho = document.getElementById("btnAdicionarBotao");
  if (btnSalvarAtalho) {
    btnSalvarAtalho.addEventListener("click", () => {
      const nome = document.getElementById("novoNomeBotao").value.trim();
      const texto = document.getElementById("novoTextoBotao").value.trim();
      const imagem = document.getElementById("novaImagemBotao").value.trim();
      const pasta = document.getElementById("selectPastaBotao").value;
      const idx = parseInt(document.getElementById("editIndex").value);
      
      if (nome && texto) {
        const dadosBotao = {
          id: idx === -1 ? "custom_" + Date.now() : configBotoes[idx].id,
          nome,
          texto,
          imagem: imagem || null,
          pasta: pasta,
          isExtra: true,
        };
        if (idx === -1) configBotoes.push(dadosBotao);
        else configBotoes[idx] = dadosBotao;
        salvarShortcuts();
        limparFormularioAtalho();
        mostrarNotificacao('✅ Atalho salvo!', 'success');
      } else {
        alert("Por favor, preencha nome e mensagem.");
      }
    });
  }
  
  const btnCancelar = document.getElementById("btnCancelarEdicao");
  if (btnCancelar) btnCancelar.addEventListener("click", limparFormularioAtalho);
  
  const btnAddNota = document.getElementById("btnAdicionarNota");
  if (btnAddNota) btnAddNota.addEventListener("click", adicionarNota);
  
  const btnExportar = document.getElementById("btnExportar");
  const inputArquivo = document.getElementById("inputArquivo");
  if (btnExportar) {
    btnExportar.addEventListener("click", () => {
      chrome.storage.local.get(null, (todosOsDados) => {
        if (Object.keys(todosOsDados).length === 0) return alert("Não há dados para exportar.");
        const dadosParaExportar = { ...todosOsDados };
        delete dadosParaExportar.icdAppsScriptToken;
        const blob = new Blob([JSON.stringify(dadosParaExportar, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        const dataHora = new Date().toLocaleDateString().replace(/\//g, "-");
        a.href = url;
        a.download = `backup_completo_icd_hub_${dataHora}.json`;
        a.click();
        URL.revokeObjectURL(url);
      });
    });
  }
  if (inputArquivo) {
    document.getElementById("btnImportar")?.addEventListener("click", () => inputArquivo.click());
    inputArquivo.addEventListener("change", (e) => {
      const arquivo = e.target.files[0];
      if (!arquivo) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const dadosRestaurados = JSON.parse(ev.target.result);
          chrome.storage.local.set(dadosRestaurados, () => {
            alert("✅ Todas as configurações e tarifários foram restaurados!");
            location.reload();
          });
        } catch (err) {
          alert("❌ Erro ao ler o arquivo.");
        }
      };
      reader.readAsText(arquivo);
    });
  }
  
  const seletorPosicao = document.getElementById("posicaoBarra");
  const btnSalvarPref = document.getElementById("btnSalvarPref");
  if (seletorPosicao && btnSalvarPref) {
    chrome.storage.local.get(["posicaoBarra"], (res) => {
      if (res.posicaoBarra) seletorPosicao.value = res.posicaoBarra;
    });
    btnSalvarPref.addEventListener("click", () => {
      chrome.storage.local.set({ posicaoBarra: seletorPosicao.value }, () => {
        alert("✅ Preferência de posição salva! Atualize o WhatsApp para aplicar.");
      });
    });
  }

  const campoUrlPlanilha = document.getElementById("icdAppsScriptUrl");
  const campoTokenPlanilha = document.getElementById("icdAppsScriptToken");
  const btnSalvarPlanilha = document.getElementById("btnSalvarPlanilhaEstornos");
  if (campoUrlPlanilha && campoTokenPlanilha && btnSalvarPlanilha) {
    chrome.storage.local.get(["icdAppsScriptUrl", "icdAppsScriptToken"], (res) => {
      campoUrlPlanilha.value = res.icdAppsScriptUrl || "";
      campoTokenPlanilha.value = res.icdAppsScriptToken || "";
    });

    btnSalvarPlanilha.addEventListener("click", () => {
      const url = campoUrlPlanilha.value.trim();
      const token = campoTokenPlanilha.value.trim();
      if (!url || !token) {
        alert("Informe a URL e o token da planilha.");
        return;
      }
      chrome.storage.local.set({
        icdAppsScriptUrl: url,
        icdAppsScriptToken: token,
      }, () => alert("✅ Configuração da planilha salva neste navegador."));
    });
  }

  const CHAVE_BOTOES_ESTORNO = "icdRefundButtonsEnabled";
  const btnToggleBotoesEstorno = document.getElementById("btnToggleBotoesEstorno");
  const statusBotoesEstorno = document.getElementById("statusBotoesEstorno");
  if (btnToggleBotoesEstorno && statusBotoesEstorno) {
    const atualizarStatusBotoesEstorno = (ativo) => {
      statusBotoesEstorno.textContent = ativo
        ? "Ocultar botões de estorno"
        : "Exibir botões de estorno";
      btnToggleBotoesEstorno.classList.toggle("btn-principal", ativo);
      btnToggleBotoesEstorno.classList.toggle("btn-secundario", !ativo);
    };

    chrome.storage.local.get([CHAVE_BOTOES_ESTORNO], (res) => {
      atualizarStatusBotoesEstorno(res[CHAVE_BOTOES_ESTORNO] === true);
    });

    btnToggleBotoesEstorno.addEventListener("click", () => {
      chrome.storage.local.get([CHAVE_BOTOES_ESTORNO], (res) => {
        const novoStatus = res[CHAVE_BOTOES_ESTORNO] !== true;
        chrome.storage.local.set({ [CHAVE_BOTOES_ESTORNO]: novoStatus }, () => {
          atualizarStatusBotoesEstorno(novoStatus);
          alert(novoStatus
            ? "✅ Botões de estorno exibidos neste navegador."
            : "🙈 Botões de estorno ocultados neste navegador.");
        });
      });
    });
  }
  
  // 🚀 E-mail continua funcionando normalmente
  const btnSalvarEmail = document.getElementById("btnSalvarEmailConfig");
  if (btnSalvarEmail) {
    chrome.storage.local.get(["emailAssunto", "emailCorpo"], (res) => {
      if (res.emailAssunto) document.getElementById("emailAssuntoPadrao").value = res.emailAssunto;
      if (res.emailCorpo) document.getElementById("emailCorpoPadrao").value = res.emailCorpo;
    });
    btnSalvarEmail.addEventListener("click", () => {
      const assunto = document.getElementById("emailAssuntoPadrao").value;
      const corpo = document.getElementById("emailCorpoPadrao").value;
      chrome.storage.local.set({ emailAssunto: assunto, emailCorpo: corpo }, () => {
        alert("✅ Configurações de e-mail salvas!");
      });
    });
  }
  
  const btnGerarPDF = document.getElementById("btnGerarPDF");
  if (btnGerarPDF) btnGerarPDF.addEventListener("click", gerarReciboPDF);
}

document.getElementById("btn-salvar-passeio")?.addEventListener("click", () => {
  const nome = document.getElementById("nomePasseio").value;
  const tipos = document.querySelectorAll(".tipo-ingresso");
  const valores = document.querySelectorAll(".valor-ingresso");
  if (!nome) return alert("Digite o nome do passeio!");
  let ingressos = [];
  tipos.forEach((t, i) => {
    if (t.value && valores[i].value) {
      ingressos.push({ tipo: t.value, valor: parseFloat(valores[i].value) });
    }
  });
  if (ingressos.length === 0) return alert("Adicione pelo menos um tipo de ingresso!");
  chrome.storage.local.get(["listaPasseios"], (res) => {
    let lista = res.listaPasseios || [];
    if (editPasseioIndex === -1) lista.push({ nome, ingressos });
    else lista[editPasseioIndex] = { nome, ingressos };
    chrome.storage.local.set({ listaPasseios: lista }, () => {
      alert("✅ Passeio salvo com sucesso!");
      limparFormularioPasseio();
      renderizarListaPasseios();
      editPasseioIndex = -1;
      const btnSalvar = document.getElementById("btn-salvar-passeio");
      btnSalvar.innerText = "Salvar Passeio";
      btnSalvar.style.background = "";
    });
  });
});

document.getElementById("btn-add-tipo")?.addEventListener("click", () => adicionarLinhaPreco("", ""));

// ==================== FUNÇÃO AUXILIAR DE NOTIFICAÇÃO ====================
function mostrarNotificacao(mensagem, tipo = 'info') {
  const notificacao = document.createElement('div');
  notificacao.style.cssText = `
    position: fixed; top: 20px; right: 20px;
    background: ${tipo === 'success' ? 'linear-gradient(135deg, #10b981, #059669)' : 'linear-gradient(135deg, #3b82f6, #2563eb)'};
    color: white; padding: 14px 24px; border-radius: 12px; z-index: 10000;
    font-family: 'Inter', sans-serif; font-size: 14px; font-weight: 500;
    box-shadow: 0 8px 25px rgba(0,0,0,0.3); animation: slideIn 0.3s ease;
  `;
  notificacao.textContent = mensagem;
  document.body.appendChild(notificacao);
  setTimeout(() => {
    notificacao.style.opacity = '0';
    notificacao.style.transform = 'translateX(100px)';
    setTimeout(() => notificacao.remove(), 300);
  }, 3000);
}
