document.addEventListener('DOMContentLoaded', () => {
    const listaBotoesDiv = document.getElementById('listaBotoes');
    const inputArquivo = document.getElementById('inputArquivo');
    
    let configBotoes = [];

    chrome.storage.local.get(['nomeOperador', 'configMaster'], (res) => {
        if (res.nomeOperador) document.getElementById('nomeOperador').value = res.nomeOperador;
        if (res.configMaster) {
            configBotoes = res.configMaster;
            renderizarLista();
        }
    });

    document.getElementById('btnSalvarNome').addEventListener('click', () => {
        const nome = document.getElementById('nomeOperador').value.trim().toUpperCase();
        chrome.storage.local.set({ nomeOperador: nome, usuarioConfigurado: nome }, () => {
            alert("✅ Nome do operador atualizado!");
        });
    });

    const btnAbrirConfig = document.getElementById('btnAbrirConfig');
    if (btnAbrirConfig) {
        btnAbrirConfig.onclick = () => {
            if (chrome.runtime.openOptionsPage) {
                chrome.runtime.openOptionsPage();
            } else {
                window.open(chrome.runtime.getURL('options.html'));
            }
        };
    }

    document.getElementById('btnAdicionarBotao').addEventListener('click', () => {
        const nome = document.getElementById('novoNomeBotao').value.trim();
        const texto = document.getElementById('novoTextoBotao').value.trim();

        if (nome && texto) {
            const novoBotao = {
                id: "custom_" + Date.now(),
                nome: nome,
                texto: texto,
                isExtra: true
            };
            configBotoes.push(novoBotao);
            salvarEAtualizar();
            document.getElementById('novoNomeBotao').value = "";
            document.getElementById('novoTextoBotao').value = "";
        } else {
            alert("⚠️ Preencha o nome e o texto do botão!");
        }
    });

    function renderizarLista() {
        if (!listaBotoesDiv) return;
        listaBotoesDiv.innerHTML = "";
        configBotoes.forEach((btn, index) => {
            const item = document.createElement('div');
            item.className = 'item-botao';
            item.style = "display:flex; justify-content:space-between; align-items:center; padding:5px; border-bottom:1px solid #eee;";
            item.innerHTML = `
                <span>${btn.nome}</span>
                <button class="btn-del" data-index="${index}" style="color:red; border:none; background:none; cursor:pointer; font-weight:bold;">✖</button>
            `;
            listaBotoesDiv.appendChild(item);
        });

        document.querySelectorAll('.btn-del').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = e.target.getAttribute('data-index');
                configBotoes.splice(idx, 1);
                salvarEAtualizar();
            });
        });
    }

    function salvarEAtualizar() {
        chrome.storage.local.set({ configMaster: configBotoes }, () => {
            renderizarLista();
        });
    }

    const btnExportar = document.getElementById('btnExportar');
    if (btnExportar) {
        btnExportar.onclick = () => {
            if (configBotoes.length === 0) {
                alert("Não há botões para salvar.");
                return;
            }
            const blob = new Blob([JSON.stringify(configBotoes, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'backup_botoes_icd.json';
            a.click();
            URL.revokeObjectURL(url);
        };
    }

    const btnImportar = document.getElementById('btnImportar');
    if (btnImportar && inputArquivo) {
        btnImportar.onclick = () => {
            inputArquivo.click(); 
        };

        inputArquivo.onchange = (e) => {
            const arquivo = e.target.files[0];
            if (!arquivo) return;

            const leitor = new FileReader();
            leitor.onload = (event) => {
                try {
                    const json = JSON.parse(event.target.result);
                    if (Array.isArray(json)) {
                        configBotoes = json;
                        salvarEAtualizar();
                        alert("✅ Botões carregados com sucesso!");
                    }
                } catch (err) {
                    alert("❌ Erro ao ler o arquivo.");
                }
            };
            leitor.readAsText(arquivo);
            inputArquivo.value = ""; 
        };
    }
});

//Nova função para o botão funpass

document.getElementById('btnFunpass').addEventListener('click', async () => {
    const hoje = new Date();
    const dia = String(hoje.getDate()).padStart(2, '0');
    const mes = String(hoje.getMonth() + 1).padStart(2, '0');
    const ano = hoje.getFullYear();
    const dataPadrao = `${dia}/${mes}/${ano}`;

    const dataEscolhida = prompt("Qual data você quer buscar? (DD/MM/YYYY)", dataPadrao);
    if (!dataEscolhida) return;

    // Pega o token da aba logada atual
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        let keyword = "";
        try {
            const urlAtiva = new URL(tabs[0].url);
            keyword = urlAtiva.searchParams.get('keyword') || "";
        } catch (e) {}

        // Salva as INSTRUÇÕES para a nova aba e abre ela na mesma hora!
        chrome.storage.local.set({ 
            funpassParams: { data: dataEscolhida, keyword: keyword } 
        }, () => {
            chrome.tabs.create({ url: chrome.runtime.getURL("funpass_result.html") });
            // Não precisamos fazer mais nada aqui. O popup já pode fechar!
        });
    });
});