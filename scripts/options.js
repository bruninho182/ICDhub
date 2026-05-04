
document.addEventListener('DOMContentLoaded', () => {

    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.aba-conteudo');

    tabButtons.forEach(btn => {
        btn.onclick = () => {
            const target = btn.dataset.target;

            // Alterna classes nos botões e nas seções
            tabButtons.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
 
            btn.classList.add('active');
            const targetElement = document.getElementById(target);
            if (targetElement) targetElement.classList.add('active');
        };
    });

    const listaBotoesDiv = document.getElementById('listaBotoes');
    const inputArquivo = document.getElementById('inputArquivo');
    const editIndexField = document.getElementById('editIndex');
    const tituloForm = document.getElementById('tituloForm');
    const btnCancelar = document.getElementById('btnCancelarEdicao');
    const seletorPosicao = document.getElementById('posicaoBarra');
    const btnSalvarPref = document.getElementById('btnSalvarPref');
    
    let configBotoes = [];
    let dragSrcIndex = null; 

    chrome.storage.local.get(['configMaster', 'posicaoBarra', 'emailAssunto', 'emailCorpo'], (res) => {
        if (res.configMaster) {
            configBotoes = res.configMaster;
            renderizarLista();
        }
        if (res.posicaoBarra) {
            seletorPosicao.value = res.posicaoBarra;
        }
        if (res.emailAssunto) document.getElementById('emailAssuntoPadrao').value = res.emailAssunto;
        if (res.emailCorpo) document.getElementById('emailCorpoPadrao').value = res.emailCorpo;
    });

    btnSalvarPref.onclick = () => {
        const posicao = seletorPosicao.value;
        chrome.storage.local.set({ posicaoBarra: posicao }, () => {
            alert("✅ Preferência de posição salva! Atualize o WhatsApp para aplicar a mudança.");
        });
    };

  
    document.getElementById('btnAdicionarBotao').onclick = () => {
        const nome = document.getElementById('novoNomeBotao').value.trim();
        const texto = document.getElementById('novoTextoBotao').value.trim();
        const imagem = document.getElementById('novaImagemBotao').value.trim();
        const idx = parseInt(editIndexField.value);

        if (nome && texto) {
            const dadosBotao = { 
                id: idx === -1 ? "custom_" + Date.now() : configBotoes[idx].id, 
                nome, 
                texto, 
                imagem: imagem || null,
                isExtra: true 
            };

            if (idx === -1) {
                configBotoes.push(dadosBotao);
            } else {
                configBotoes[idx] = dadosBotao;
            }

            salvarShortcuts();
            limparFormulario();
        } else {
            alert("Por favor, preencha pelo menos o nome e o texto da mensagem.");
        }
    };

    function renderizarLista() {
        if (!listaBotoesDiv) return;
        listaBotoesDiv.innerHTML = "";

        configBotoes.forEach((btn, index) => {
            const item = document.createElement('div');
            item.className = 'item-lista';
            item.draggable = true; 
            item.dataset.index = index;

            item.innerHTML = `
                <div class="drag-handle" title="Arraste para reordenar">☰</div>
                <div class="info">
                    <strong>${btn.nome} ${btn.imagem ? '🖼️' : ''}</strong>
                    <p>${btn.texto.substring(0, 50)}...</p>
                </div>
                <div class="acoes">
                    <button class="btn-edit" data-index="${index}">Editar</button>
                    <button class="btn-del" data-index="${index}">Excluir</button>
                </div>
            `;
            
            item.addEventListener('dragstart', handleDragStart);
            item.addEventListener('dragover', handleDragOver);
            item.addEventListener('drop', handleDrop);
            item.addEventListener('dragend', handleDragEnd);

            listaBotoesDiv.appendChild(item);
        });

        document.querySelectorAll('.btn-edit').forEach(b => {
            b.onclick = (e) => preencherParaEditar(e.target.dataset.index);
        });

        document.querySelectorAll('.btn-del').forEach(b => {
            b.onclick = (e) => {
                if(confirm("Deseja realmente excluir este atalho?")) {
                    configBotoes.splice(e.target.dataset.index, 1);
                    salvarShortcuts();
                }
            };
        });
    }

    function handleDragStart(e) {
        dragSrcIndex = this.dataset.index;
        this.style.opacity = '0.4';
        e.dataTransfer.effectAllowed = 'move';
    }
    function handleDragOver(e) {
        if (e.preventDefault) e.preventDefault();
        return false;
    }
    function handleDrop(e) {
        if (e.stopPropagation) e.stopPropagation();
        const targetIndex = this.dataset.index;
        if (dragSrcIndex !== targetIndex) {
            const movedItem = configBotoes.splice(dragSrcIndex, 1)[0];
            configBotoes.splice(targetIndex, 0, movedItem);
            salvarShortcuts();
        }
        return false;
    }
    function handleDragEnd() { this.style.opacity = '1'; }

    function preencherParaEditar(index) {
        const btn = configBotoes[index];
        document.getElementById('novoNomeBotao').value = btn.nome;
        document.getElementById('novoTextoBotao').value = btn.texto;
        document.getElementById('novaImagemBotao').value = btn.imagem || "";
        editIndexField.value = index;
        tituloForm.innerText = "📝 Editando Atalho";
        btnCancelar.style.display = "block";
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function limparFormulario() {
        document.getElementById('novoNomeBotao').value = "";
        document.getElementById('novoTextoBotao').value = "";
        document.getElementById('novaImagemBotao').value = "";
        editIndexField.value = "-1";
        tituloForm.innerText = "➕ Adicionar Novo Atalho";
        btnCancelar.style.display = "none";
    }

    btnCancelar.onclick = limparFormulario;

    function salvarShortcuts() {
        chrome.storage.local.set({ configMaster: configBotoes }, () => {
            renderizarLista();
        });
    }

    document.getElementById('btnExportar').onclick = () => {
        chrome.storage.local.get(null, (todosOsDados) => {
            if (Object.keys(todosOsDados).length === 0) return alert("Não há dados para exportar.");
            const blob = new Blob([JSON.stringify(todosOsDados, null, 2)], {type: "application/json"});
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            const dataHora = new Date().toLocaleDateString().replace(/\//g, '-');
            a.href = url; 
            a.download = `backup_completo_icd_hub_${dataHora}.json`; 
            a.click();
            URL.revokeObjectURL(url);
        });
    };

    document.getElementById('btnImportar').onclick = () => inputArquivo.click();
    
    inputArquivo.onchange = (e) => {
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
            } catch (err) { alert("❌ Erro ao ler o arquivo."); }
        };
        reader.readAsText(arquivo);
    };

    document.getElementById('btnSalvarEmailConfig').onclick = () => {
        const assunto = document.getElementById('emailAssuntoPadrao').value;
        const corpo = document.getElementById('emailCorpoPadrao').value;
        chrome.storage.local.set({ emailAssunto: assunto, emailCorpo: corpo }, () => {
            alert("✅ Configurações de e-mail salvas!");
        });
    };

    document.getElementById('btnGerarPDF').onclick = function() {
        if (!window.jspdf) return alert("❌ Erro: Biblioteca jspdf não encontrada!");
        
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        const roxoICD = [97, 45, 135];

        // 1. Título e Dados do Form
        doc.setTextColor(roxoICD[0], roxoICD[1], roxoICD[2]);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(22);
        doc.text("Recibo", 105, 45, { align: "center" });

        doc.setTextColor(0, 0, 0);
        doc.setFontSize(11);
        doc.setFont("helvetica", "normal");
        
        const pagamento = document.getElementById('reciboPagamento').value;
        const nome = document.getElementById('reciboNome').value.toUpperCase();
        const docCliente = document.getElementById('reciboDocumento').value;
        const textoDeclaracao = `O GRUPO ICD, inscrito no CNPJ 10.335.415/0001-70, declara ter recebido os valores descritos abaixo, referente ao pagamento via ${pagamento} pago por ${nome}, inscrito no documento: ${docCliente}.`;
        
        const splitTexto = doc.splitTextToSize(textoDeclaracao, 175);
        doc.text(splitTexto, 20, 65);

        doc.setDrawColor(roxoICD[0], roxoICD[1], roxoICD[2]);
        doc.line(20, 115, 190, 115);
        doc.setFont("helvetica", "bold");
        doc.text("Data da Compra", 20, 122);
        doc.text("Voucher", 75, 122);
        doc.text("Data da Visita", 125, 122);
        doc.text("Valor", 170, 122);

        doc.setFont("helvetica", "normal");
        const dCompra = formatarDataBR(document.getElementById('reciboDataCompra').value);
        const dVisita = formatarDataBR(document.getElementById('reciboDataVisita').value);
        const vTotal = document.getElementById('reciboTotal').value;

        doc.text(dCompra, 20, 131);
        doc.text(document.getElementById('reciboVoucher').value, 75, 131);
        doc.text(dVisita, 125, 131);
        doc.text(`R$ ${vTotal}`, 170, 131);
        doc.line(20, 138, 190, 138);

        // 3. Data por Extenso
        const dataAtual = new Date();
        const meses = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
        const dataExtenso = `Itatiba, ${dataAtual.getDate()} de ${meses[dataAtual.getMonth()]} de ${dataAtual.getFullYear()}.`;
        doc.text(dataExtenso, 190, 168, { align: "right" });

        doc.save(`RECIBO_${document.getElementById('reciboVoucher').value}.pdf`);
    };

    function formatarDataBR(dataISO) {
        if (!dataISO) return "";
        const [ano, mes, dia] = dataISO.split("-");
        return `${dia}/${mes}/${ano}`;
    }
});

let editPasseioIndex = -1; 

document.getElementById('btn-add-tipo').onclick = () => {
    adicionarLinhaPreco("", "");
};

function adicionarLinhaPreco(tipo = "", valor = "") {
    const container = document.getElementById('container-precos');
    const novaLinha = document.createElement('div');
    novaLinha.className = 'linha-preco';
    novaLinha.style = "display: flex; gap: 5px; margin-bottom: 5px;";
    novaLinha.innerHTML = `
        <input type="text" placeholder="Tipo (Ex: Infantil)" class="tipo-ingresso" value="${tipo}" style="flex: 2; padding: 5px;">
        <input type="number" placeholder="Valor" class="valor-ingresso" value="${valor}" style="flex: 1; padding: 5px;">
        <button class="btn-remover-preco" style="background:none; border:none; cursor:pointer;">❌</button>
    `;
    container.appendChild(novaLinha);
    novaLinha.querySelector('.btn-remover-preco').onclick = () => novaLinha.remove();
}

document.getElementById('btn-salvar-passeio').onclick = () => {
    const nome = document.getElementById('nomePasseio').value;
    const tipos = document.querySelectorAll('.tipo-ingresso');
    const valores = document.querySelectorAll('.valor-ingresso');
    const btnSalvar = document.getElementById('btn-salvar-passeio');
    
    if (!nome) return alert("Digite o nome do passeio!");

    let ingressos = [];
    tipos.forEach((t, i) => {
        if (t.value && valores[i].value) {
            ingressos.push({
                tipo: t.value,
                valor: parseFloat(valores[i].value)
            });
        }
    });

    if (ingressos.length === 0) return alert("Adicione pelo menos um tipo de ingresso!");

    chrome.storage.local.get(['listaPasseios'], (res) => {
        let lista = res.listaPasseios || [];

        if (editPasseioIndex === -1) {
            lista.push({ nome, ingressos });
        } else {
            lista[editPasseioIndex] = { nome, ingressos };
            editPasseioIndex = -1;
            btnSalvar.innerText = "Salvar Passeio";
            btnSalvar.style.background = "#25D366";
        }
        
        chrome.storage.local.set({ listaPasseios: lista }, () => {
            alert("✅ Passeio salvo com sucesso!");
            limparFormularioPasseio();
            renderizarListaPasseios();
        });
    });
};

function limparFormularioPasseio() {
    document.getElementById('nomePasseio').value = "";
    document.getElementById('container-precos').innerHTML = `
        <div class="linha-preco" style="display: flex; gap: 5px; margin-bottom: 5px;">
            <input type="text" placeholder="Tipo (Ex: Adulto)" class="tipo-ingresso" style="flex: 2; padding: 5px;">
            <input type="number" placeholder="Valor" class="valor-ingresso" style="flex: 1; padding: 5px;">
        </div>
    `;
}

function renderizarListaPasseios() {
    chrome.storage.local.get(['listaPasseios'], (res) => {
        const container = document.getElementById('lista-passeios-config');
        const lista = res.listaPasseios || [];
        container.innerHTML = "";

        lista.forEach((p, index) => {
            const item = document.createElement('div');
            item.style = "background: #f4f4f4; padding: 10px; margin-bottom: 8px; border-radius: 5px; display: flex; justify-content: space-between; align-items: center; border-left: 4px solid #612d87;";
            item.innerHTML = `
                <div style="font-size: 12px;">
                    <strong>${p.nome}</strong><br>
                    <small>${p.ingressos.length} categorias cadastradas</small>
                </div>
                <div style="display: flex; gap: 5px;">
                    <button class="btn-editar-p" data-index="${index}" style="background:#34B7F1; color:white; border:none; border-radius:3px; cursor:pointer; padding: 4px 8px; font-size:10px;">Editar</button>
                    <button class="btn-excluir-p" data-index="${index}" style="background:#ff4d4d; color:white; border:none; border-radius:3px; cursor:pointer; padding: 4px 8px; font-size:10px;">Excluir</button>
                </div>
            `;
            container.appendChild(item);
        });

        container.querySelectorAll('.btn-excluir-p').forEach(btn => {
            btn.onclick = (e) => {
                if(confirm("Tem certeza que deseja excluir este passeio?")) {
                    const idx = e.target.dataset.index;
                    lista.splice(idx, 1);
                    chrome.storage.local.set({ listaPasseios: lista }, renderizarListaPasseios);
                }
            };
        });

        container.querySelectorAll('.btn-editar-p').forEach(btn => {
            btn.onclick = (e) => {
                const idx = e.target.dataset.index;
                const p = lista[idx];
                document.getElementById('nomePasseio').value = p.nome;
                const containerPrecos = document.getElementById('container-precos');
                containerPrecos.innerHTML = ""; 
                p.ingressos.forEach(ing => {
                    adicionarLinhaPreco(ing.tipo, ing.valor);
                });
                editPasseioIndex = idx;
                const btnSalvar = document.getElementById('btn-salvar-passeio');
                btnSalvar.innerText = "Confirmar Alteração";
                btnSalvar.style.background = "#ffa500";
                document.getElementById('nomePasseio').scrollIntoView({ behavior: 'smooth' });
            };
        });
    });
}

renderizarListaPasseios();