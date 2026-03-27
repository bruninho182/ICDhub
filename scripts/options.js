document.addEventListener('DOMContentLoaded', () => {
    const listaBotoesDiv = document.getElementById('listaBotoes');
    const inputArquivo = document.getElementById('inputArquivo');
    const editIndexField = document.getElementById('editIndex');
    const tituloForm = document.getElementById('tituloForm');
    const btnCancelar = document.getElementById('btnCancelarEdicao');
    const seletorPosicao = document.getElementById('posicaoBarra');
    const btnSalvarPref = document.getElementById('btnSalvarPref');
    
    let configBotoes = [];
    let dragSrcIndex = null; // Controle de arrasto

    chrome.storage.local.get(['configMaster', 'posicaoBarra'], (res) => {
        if (res.configMaster) {
            configBotoes = res.configMaster;
            renderizarLista();
        }
        if (res.posicaoBarra) {
            seletorPosicao.value = res.posicaoBarra;
        }
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

            salvar();
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
                    salvar();
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
            salvar();
        }
        return false;
    }

    function handleDragEnd() {
        this.style.opacity = '1';
    }

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

    function salvar() {
        chrome.storage.local.set({ configMaster: configBotoes }, () => {
            renderizarLista();
        });
    }

    document.getElementById('btnExportar').onclick = () => {
        if (configBotoes.length === 0) return alert("Não há dados para exportar.");
        const blob = new Blob([JSON.stringify(configBotoes, null, 2)], {type: "application/json"});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; 
        a.download = 'backup_botoes_icd.json'; 
        a.click();
        URL.revokeObjectURL(url);
    };

    document.getElementById('btnImportar').onclick = () => inputArquivo.click();
    
    inputArquivo.onchange = (e) => {
        const arquivo = e.target.files[0];
        if (!arquivo) return;

        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const dados = JSON.parse(ev.target.result);
                if (Array.isArray(dados)) {
                    configBotoes = dados;
                    salvar();
                    alert("✅ Importação concluída com sucesso!");
                }
            } catch (err) {
                alert("Erro ao ler o arquivo.");
            }
        };
        reader.readAsText(arquivo);
        inputArquivo.value = "";
    };
});

chrome.storage.local.get(['emailAssunto', 'emailCorpo'], (res) => {
    if (res.emailAssunto) document.getElementById('emailAssuntoPadrao').value = res.emailAssunto;
    if (res.emailCorpo) document.getElementById('emailCorpoPadrao').value = res.emailCorpo;
});


document.getElementById('btnSalvarEmailConfig').onclick = () => {
    const assunto = document.getElementById('emailAssuntoPadrao').value;
    const corpo = document.getElementById('emailCorpoPadrao').value;
    chrome.storage.local.set({ emailAssunto: assunto, emailCorpo: corpo }, () => {
        alert("Configurações de e-mail salvas!");
    });
};

/* =========================================================
   LÓGICA DA CALCULADORA DE COTAÇÃO (OPÇÕES COM EDIÇÃO)
   ========================================================= */

let editPasseioIndex = -1; // -1 significa que estamos criando um novo

// 1. Adicionar nova linha de Categoria de Preço
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

// 2. Salvar ou Atualizar o Passeio
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
            // NOVO PASSEIO
            lista.push({ nome, ingressos });
        } else {
            // EDITANDO EXISTENTE
            lista[editPasseioIndex] = { nome, ingressos };
            editPasseioIndex = -1;
            btnSalvar.innerText = "Salvar Passeio";
            btnSalvar.style.background = "#25D366";
        }
        
        chrome.storage.local.set({ listaPasseios: lista }, () => {
            alert("Passeio salvo com sucesso!");
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

// 3. Renderizar a lista com botões de Editar e Excluir
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

        // Evento EXCLUIR
        container.querySelectorAll('.btn-excluir-p').forEach(btn => {
            btn.onclick = (e) => {
                if(confirm("Tem certeza que deseja excluir este passeio?")) {
                    const idx = e.target.dataset.index;
                    lista.splice(idx, 1);
                    chrome.storage.local.set({ listaPasseios: lista }, renderizarListaPasseios);
                }
            };
        });

        // Evento EDITAR
        container.querySelectorAll('.btn-editar-p').forEach(btn => {
            btn.onclick = (e) => {
                const idx = e.target.dataset.index;
                const p = lista[idx];
                
                // Preenche o formulário
                document.getElementById('nomePasseio').value = p.nome;
                const containerPrecos = document.getElementById('container-precos');
                containerPrecos.innerHTML = ""; // Limpa atuais
                
                p.ingressos.forEach(ing => {
                    adicionarLinhaPreco(ing.tipo, ing.valor);
                });

                // Muda o estado para edição
                editPasseioIndex = idx;
                const btnSalvar = document.getElementById('btn-salvar-passeio');
                btnSalvar.innerText = "Confirmar Alteração";
                btnSalvar.style.background = "#ffa500";
                
                // Scroll para o topo do formulário
                document.getElementById('nomePasseio').scrollIntoView({ behavior: 'smooth' });
            };
        });
    });
}

// Inicializa a lista
renderizarListaPasseios();