// ========== options.js - Versão com Anotações e PDF Funcional ==========

// Inicialização principal
document.addEventListener("DOMContentLoaded", () => {
  inicializarTabs();
  renderizarListaAtalhos();
  carregarNotas();          // carrega anotações salvas
  inicializarEventos();
  renderizarListaPasseios(); // carrega passeios da calculadora
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

// ==================== ANOTAÇÕES (múltiplas notas) ====================
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

// ==================== ATALHOS (Drag & Drop) ====================
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
    configBotoes.forEach((botao, idx) => {
      const item = document.createElement("div");
      item.className = "item-lista";
      item.draggable = true;
      item.dataset.index = idx;
      item.innerHTML = `
        <span class="posicao-badge">${idx+1}</span>
        <span class="drag-handle"></span>
        <div class="info"><strong>${escapeHtml(botao.nome || "Sem nome")}</strong><p>${escapeHtml((botao.texto || "").substring(0,60))}...</p></div>
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
  document.getElementById("editIndex").value = index;
  document.getElementById("tituloForm").innerText = "📝 Editando Atalho";
  document.getElementById("btnCancelarEdicao").style.display = "block";
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function limparFormularioAtalho() {
  document.getElementById("novoNomeBotao").value = "";
  document.getElementById("novoTextoBotao").value = "";
  document.getElementById("novaImagemBotao").value = "";
  document.getElementById("editIndex").value = "-1";
  document.getElementById("tituloForm").innerText = "➕ Adicionar Novo Atalho";
  document.getElementById("btnCancelarEdicao").style.display = "none";
}
function salvarShortcuts() {
  chrome.storage.local.set({ configMaster: configBotoes }, () => {
    renderizarListaAtalhos();
  });
}

// ==================== RECIBO PDF (CORRIGIDO - LOGO À DIREITA) ====================
function gerarReciboPDF() {
  // Verifica se a biblioteca existe
  if (typeof window.jspdf === 'undefined') {
    console.error('jsPDF não encontrado!');
    alert('❌ Erro: Biblioteca jsPDF não carregada. Verifique se o arquivo jspdf.umd.min.js existe na pasta scripts.');
    return;
  }

  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Cores
    const roxoICD = [97, 45, 135];
    const cinzaClaro = [150, 150, 150];
    
    // ==================== LOGO (AGORA À DIREITA) ====================
    // Logo posicionada no canto superior DIREITO (x=165, y=15)
    const logoUrl = 'icons/logo-icd-recibo.png';
    
    try {
      doc.addImage(logoUrl, 'PNG', 165, 15, 25, 25);
    } catch(e) {
      console.log('Logo não encontrada, continuando sem logo');
    }
    
    // ==================== TÍTULO ====================
    doc.setTextColor(roxoICD[0], roxoICD[1], roxoICD[2]);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(24);
    doc.text("Recibo", 105, 35, { align: "center" });
    
    // ==================== DADOS DO FORMS ====================
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    
    // Buscar valores dos inputs
    const pagamento = document.getElementById("reciboPagamento")?.value || "PIX";
    const nomeCliente = document.getElementById("reciboNome")?.value || "NÃO INFORMADO";
    const documento = document.getElementById("reciboDocumento")?.value || "NÃO INFORMADO";
    const passeio = document.getElementById("reciboPasseio")?.value || "NÃO INFORMADO";
    const descricao = document.getElementById("reciboDescricaoIngressos")?.value || "";
    const voucher = document.getElementById("reciboVoucher")?.value || "NÃO INFORMADO";
    const valorTotal = document.getElementById("reciboTotal")?.value || "0,00";
    const dataCompra = document.getElementById("reciboDataCompra")?.value;
    const dataVisita = document.getElementById("reciboDataVisita")?.value;
    
    // Formatar datas
    const dataCompraFormatada = dataCompra ? dataCompra.split('-').reverse().join('/') : "___/___/____";
    const dataVisitaFormatada = dataVisita ? dataVisita.split('-').reverse().join('/') : "___/___/____";
    
    // ==================== TEXTO DA DECLARAÇÃO ====================
    const textoDeclaracao = `O GRUPO ICD, inscrito no CNPJ 10.335.415/0001-70, declara ter recebido os valores descritos abaixo,\nreferente ao pagamento via ${pagamento} pago por ${nomeCliente.toUpperCase()}, inscrito no ${documento.includes('CNPJ') ? 'CNPJ' : 'CPF'}: ${documento}.`;
    const splitTexto = doc.splitTextToSize(textoDeclaracao, 170);
    doc.text(splitTexto, 20, 55);
    
    // ==================== DADOS DA COMPRA (título) ====================
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Dados da Compra:", 20, 85);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    
    // Nome do passeio
    doc.setFont("helvetica", "bold");
    doc.text(passeio, 25, 98);
    doc.setFont("helvetica", "normal");
    
    // Descrição dos ingressos (quebrar linhas se necessário)
    let yDescricao = 108;
    if (descricao) {
      const linhasDescricao = doc.splitTextToSize(descricao, 160);
      doc.text(linhasDescricao, 25, yDescricao);
      yDescricao += (linhasDescricao.length * 5);
    } else {
      yDescricao = 108;
    }
    
    // Espaço antes da tabela
    const yTabela = Math.max(yDescricao + 10, 125);
    
    // ==================== TABELA ====================
    // Cabeçalho da tabela
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
    
    // Linha da tabela
    doc.setFont("helvetica", "normal");
    doc.text(dataCompraFormatada, 25, yTabela + 20);
    doc.text(voucher, 85, yTabela + 20);
    doc.text(dataVisitaFormatada, 125, yTabela + 20);
    doc.text(`R$ ${valorTotal}`, 170, yTabela + 20, { align: "right" });
    
    doc.line(20, yTabela + 23, 190, yTabela + 23);
    
    // ==================== TOTAL (CORRIGIDO - SEM SOBREPOSIÇÃO) ====================
    doc.setFont("helvetica", "bold");
    // Posiciona o texto "Total" mais à esquerda para dar espaço
    doc.text("Total", 140, yTabela + 38);
    // Coloca o valor mais à direita com espaço suficiente
    doc.text(`R$ ${valorTotal}`, 185, yTabela + 38, { align: "right" });
    doc.setFont("helvetica", "normal");
    
    // ==================== DATA POR EXTENSO ====================
    const dataAtual = new Date();
    const meses = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
    const dataExtenso = `Itatiba, ${dataAtual.getDate()} de ${meses[dataAtual.getMonth()]} de ${dataAtual.getFullYear()}.`;
    doc.text(dataExtenso, 190, yTabela + 58, { align: "right" });
    
    // ==================== ASSINATURA ====================
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Grupo ICD", 105, yTabela + 75, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(cinzaClaro[0], cinzaClaro[1], cinzaClaro[2]);
    
    // ==================== RODAPÉ (ENDEREÇO) ====================
    const endereco = "Av. Pref. José Maurício de Camargo, 320, Jardim Nossa Sra. Da Graças – Office Mall Sala J52\nItatiba – SP CEP 13257-900\nTel. (11) 4412-5454";
    const linhasEndereco = doc.splitTextToSize(endereco, 170);
    doc.text(linhasEndereco, 105, 270, { align: "center" });
    
    // ==================== SALVAR PDF ====================
    const nomeArquivo = `RECIBO - ${voucher}.pdf`;
    doc.save(nomeArquivo);
    
    console.log('PDF gerado com sucesso!');
    mostrarNotificacao('✅ Recibo gerado com sucesso!', 'success');
    
  } catch (error) {
    console.error('Erro ao gerar PDF:', error);
    alert('❌ Erro ao gerar o recibo. Verifique o console para mais detalhes.');
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
  // Botão Salvar Atalho
  const btnSalvarAtalho = document.getElementById("btnAdicionarBotao");
  if (btnSalvarAtalho) {
    btnSalvarAtalho.addEventListener("click", () => {
      const nome = document.getElementById("novoNomeBotao").value.trim();
      const texto = document.getElementById("novoTextoBotao").value.trim();
      const imagem = document.getElementById("novaImagemBotao").value.trim();
      const idx = parseInt(document.getElementById("editIndex").value);
      if (nome && texto) {
        const dadosBotao = {
          id: idx === -1 ? "custom_" + Date.now() : configBotoes[idx].id,
          nome,
          texto,
          imagem: imagem || null,
          isExtra: true,
        };
        if (idx === -1) configBotoes.push(dadosBotao);
        else configBotoes[idx] = dadosBotao;
        salvarShortcuts();
        limparFormularioAtalho();
      } else {
        alert("Por favor, preencha nome e mensagem.");
      }
    });
  }
  
  // Cancelar edição
  const btnCancelar = document.getElementById("btnCancelarEdicao");
  if (btnCancelar) btnCancelar.addEventListener("click", limparFormularioAtalho);
  
  // Botão Adicionar Nota
  const btnAddNota = document.getElementById("btnAdicionarNota");
  if (btnAddNota) btnAddNota.addEventListener("click", adicionarNota);
  
  // Backup & Restauração
  const btnExportar = document.getElementById("btnExportar");
  const inputArquivo = document.getElementById("inputArquivo");
  if (btnExportar) {
    btnExportar.addEventListener("click", () => {
      chrome.storage.local.get(null, (todosOsDados) => {
        if (Object.keys(todosOsDados).length === 0) return alert("Não há dados para exportar.");
        const blob = new Blob([JSON.stringify(todosOsDados, null, 2)], { type: "application/json" });
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
  
  // Preferência de posição da barra
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
  
  // Configurações de e-mail
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
  
  // Gerador de Recibo (PDF)
  const btnGerarPDF = document.getElementById("btnGerarPDF");
  if (btnGerarPDF) btnGerarPDF.addEventListener("click", gerarReciboPDF);
}

// Botão salvar passeio
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