// 1. Textos Padronizados
const textosPadrao = {
    apresentacao: "Olá! Bem-vindo ao nosso atendimento. Como posso ajudar?",
    valor: "Trem do Corcovado – Informações e Valores...",
    documentos: "Para realizar a sua reserva vamos precisar dos seguintes dados...",
    remarcacao: "Para remarcar seu passeio, solicitamos as seguintes informações...",
    estorno: "Para cancelamento e estorno o(a) senhor(a) precisa encaminhar um e-mail...",
    pix: "——— - Trem do Corcovado - PIX\n\nO link de pagamento expira em 30 minutos.",
    cartao: "——— - Trem do Corcovado - Cartão de Crédito\n\nO link de pagamento expira em 30 minutos.",
    autorizacao: "Para continuar com a reserva vou precisar que você preencha uma autorização de débito...",
    anexo: "Anexo seu voucher!\nTenha um ótimo passeio!",
    app: "Tente pelo nosso app!\n\nANDROID - https://play.google.com/store/apps/details?id=com.ingressoscomdescontos.TremdoCorcovado"
};

const menu = document.createElement('div');
menu.id = 'menu-automacao-hub';

// Variável para controlar a pasta ativa no WhatsApp
let pastaAtiva = null;
// Variável para controlar o índice da pasta sendo arrastada
let dragPastaSrcIndex = null;

// Função para injetar o texto na caixa do WhatsApp
function enviarTexto(txt) {
    const textarea = document.querySelector('div[contenteditable="true"][data-tab="10"]');
    if (textarea) {
        textarea.focus();
        const dt = new DataTransfer();
        dt.setData('text/plain', txt);
        const ev = new ClipboardEvent('paste', { 
            clipboardData: dt, 
            bubbles: true, 
            cancelable: true 
        });
        textarea.dispatchEvent(ev);
    }
}

// 2. Estrutura da Barra Lateral
menu.innerHTML = `
    <button type="button" id="aba-gatilho" aria-label="Abrir painel ICD Hub">◀</button> 
    
    <div id="wrapper-controles-hub" style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
        <div id="hub-brand-row">
            <div id="hub-brand">
                <img src="${chrome.runtime.getURL('icon.png')}" alt="" />
            </div>
        </div>
        <div id="hub-search-row">
            <input type="text" id="busca-botoes" placeholder="🔍 Buscar em todas as pastas..." style="width: 90%; margin-bottom: 15px; padding: 8px; border-radius: 5px; border: 1px solid #ddd; display: block; font-size: 12px;">
            <button type="button" id="btn-cotacao-hub" aria-label="Abrir calculadora de cotação" title="Calculadora de cotação">
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <rect x="5" y="3" width="14" height="18" rx="3"></rect>
                    <path d="M8 7h8M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01"></path>
                </svg>
            </button>
        </div>
    </div>

    <div id="container-botoes-hub"></div>
    
    <!-- ESTILOS INJETADOS -->
    <style>
        .btn-pasta-hub {
            display: flex; align-items: center; justify-content: space-between;
            width: 100%; box-sizing: border-box; appearance: none;
            background: rgba(109, 40, 217, 0.14);
            color: #f1f5f9; padding: 12px 14px; border-radius: 12px;
            margin-bottom: 8px; cursor: grab; font-weight: 600;
            font-size: 13px; font-family: inherit;
            border: 1px solid rgba(167, 139, 250, 0.24);
            transition: background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
        }
        .btn-pasta-hub:active { cursor: grabbing; }
        .btn-pasta-hub:hover {
            background: rgba(109, 40, 217, 0.24);
            border-color: rgba(167, 139, 250, 0.5);
            transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        }
        .btn-pasta-hub.dragging { opacity: 0.4; border: 1px dashed #c4b5fd; }
        .btn-pasta-hub.drag-over {
            border-top: 3px solid #c4b5fd;
            background: rgba(109, 40, 217, 0.3);
        }
        .btn-pasta-hub span:nth-child(2) { flex: 1; text-align: left; margin-left: 10px; }
        .btn-pasta-hub span:last-child { font-size: 10px; opacity: 0.7; }
        
        /* CABEÇALHO DA PASTA ATIVA (ALINHADO) */
        .header-pasta-ativa {
            display: flex; align-items: center;
            background: linear-gradient(135deg, #6d28d9, #4c1d95);
            color: white;
            padding: 8px 10px;
            border-radius: 8px;
            margin: 0 10px 12px 10px;
            border: 1px solid #8b5cf6;
            box-shadow: 0 2px 8px rgba(109, 40, 217, 0.3);
            gap: 10px;
        }
        .btn-voltar-pasta {
            display: flex; align-items: center; justify-content: center;
            width: 26px; height: 26px;
            background: rgba(255, 255, 255, 0.15);
            color: #fff;
            border-radius: 6px;
            cursor: pointer;
            font-size: 12px;
            border: none;
            transition: all 0.2s;
            flex-shrink: 0;
            padding: 0;
            line-height: 1;
        }
        .btn-voltar-pasta:hover {
            background: rgba(255, 255, 255, 0.3);
            transform: translateX(-2px);
        }
        .titulo-pasta-ativa {
            flex: 1;
            font-size: 13px;
            font-weight: 700;
            letter-spacing: 0.3px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            text-transform: uppercase;
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .icone-pasta-ativa {
            font-size: 14px;
            opacity: 0.9;
        }

        /* ESTILOS DO MODAL DA CALCULADORA (ARRASTÁVEL E MINIMIZÁVEL) */
        #modal-cotacao-icd {
            position: fixed;
            top: 80px;
            left: calc(100% - 400px);
            width: 350px;
            background: #111c30;
            border: 1px solid rgba(255, 255, 255, 0.12);
            border-radius: 16px;
            box-shadow: 0 18px 50px rgba(0,0,0,0.5);
            z-index: 20000;
            font-family: 'Inter', sans-serif;
            color: #e2e8f0;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            max-height: 80vh;
            backdrop-filter: blur(18px);
            -webkit-backdrop-filter: blur(18px);
        }
        #modal-cotacao-icd.minimizado {
            height: auto !important;
            width: 220px;
        }
        #modal-cotacao-icd.minimizado .corpo-modal {
            display: none;
        }
        .cabecalho-modal {
            background: linear-gradient(135deg, #5b21b6, #4c1d95);
            color: white;
            padding: 14px 16px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            cursor: move;
            user-select: none;
            border-bottom: 1px solid rgba(255, 255, 255, 0.12);
        }
        .cabecalho-modal h3 {
            margin: 0;
            font-size: 14px;
            font-weight: 700;
            display: flex;
            align-items: center;
            gap: 8px;
            letter-spacing: 0.01em;
        }
        .controles-modal {
            display: flex;
            gap: 6px;
        }
        .controles-modal button {
            width: 28px; height: 28px;
            border: 1px solid rgba(255,255,255,0.12);
            border-radius: 8px;
            background: rgba(255,255,255,0.15);
            color: white;
            cursor: pointer;
            font-size: 13px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background 0.2s, transform 0.2s;
            padding: 0;
        }
        .controles-modal button:hover {
            background: rgba(255,255,255,0.25);
            transform: translateY(-1px);
        }
        .controles-modal button.fechar:hover {
            background: #ef4444;
        }
        .corpo-modal {
            padding: 16px;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 12px;
            background: linear-gradient(180deg, #111c30, #172338);
        }
        #select-passeio-cotacao {
            width: 100%;
            padding: 11px 12px;
            margin: 0 0 2px;
            border: 1px solid rgba(148, 163, 184, 0.24);
            border-radius: 10px;
            background: #0f172a;
            color: #f1f5f9;
            font: 500 13px 'Inter', sans-serif;
            outline: none;
        }
        #select-passeio-cotacao:focus {
            border-color: #8b5cf6;
            box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.18);
        }
        #detalhes-cotacao {
            max-height: 250px;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 8px;
            padding-right: 3px;
        }
        .linha-ingresso-cotacao {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            background: rgba(255, 255, 255, 0.045);
            border: 1px solid rgba(255, 255, 255, 0.08);
            padding: 10px 11px;
            border-radius: 10px;
        }
        .info-ingresso-cotacao {
            min-width: 0;
            color: #e2e8f0;
            font-size: 12px;
            line-height: 1.35;
        }
        .info-ingresso-cotacao strong {
            display: block;
            color: #f8fafc;
            font-size: 12px;
            font-weight: 600;
        }
        .info-ingresso-cotacao span {
            display: block;
            margin-top: 3px;
            color: #94a3b8;
        }
        .qtd-cotacao {
            width: 62px;
            padding: 7px 8px;
            border: 1px solid rgba(148, 163, 184, 0.28);
            border-radius: 8px;
            background: rgba(15, 23, 42, 0.9);
            color: #f8fafc;
            font: 600 13px 'Inter', sans-serif;
            text-align: center;
            outline: none;
        }
        .qtd-cotacao:focus {
            border-color: #34d399;
            box-shadow: 0 0 0 3px rgba(52, 211, 153, 0.14);
        }
        #total-cotacao {
            margin-top: 0;
            padding: 12px 13px;
            border: 1px solid rgba(52, 211, 153, 0.2);
            border-radius: 10px;
            background: rgba(16, 185, 129, 0.08);
            color: #6ee7b7;
            font-size: 17px;
            font-weight: 700;
            text-align: right;
        }
        #btn-copiar-cotacao {
            width: 100%;
            margin-top: 0;
            padding: 11px 14px;
            border: 1px solid rgba(196, 181, 253, 0.2);
            border-radius: 10px;
            background: linear-gradient(135deg, #6d28d9, #5b21b6);
            color: #fff;
            cursor: pointer;
            font: 600 13px 'Inter', sans-serif;
            box-shadow: 0 5px 14px rgba(91, 33, 182, 0.26);
            transition: transform 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
        }
        #btn-copiar-cotacao:hover {
            background: linear-gradient(135deg, #7c3aed, #6d28d9);
            transform: translateY(-1px);
            box-shadow: 0 8px 18px rgba(91, 33, 182, 0.34);
        }
        #btn-copiar-cotacao:active {
            transform: translateY(0);
        }
        @media (max-width: 480px) {
            #modal-cotacao-icd {
                left: 12px;
                top: 12px;
                width: calc(100vw - 24px);
            }
        }
    </style>
`;

document.body.appendChild(menu);
const aba = document.getElementById('aba-gatilho');
const btnCotacao = document.getElementById('btn-cotacao-hub');
const wrapperControles = document.getElementById('wrapper-controles-hub');
const linhaMarca = document.getElementById('hub-brand-row');

// Evento para abrir a calculadora
btnCotacao.onclick = () => abrirCalculadoraCotacao();

const btnConfigHub = document.createElement('button');
btnConfigHub.type = 'button';
btnConfigHub.id = 'btn-config-hub';
btnConfigHub.textContent = 'Configurações';
btnConfigHub.onclick = async () => {
    btnConfigHub.disabled = true;
    try {
        await ICDCotacaoUI.abrirConfiguracoes();
    } catch {
        btnConfigHub.textContent = 'Recarregue a extensão e tente novamente';
    } finally {
        btnConfigHub.disabled = false;
    }
};
wrapperControles.appendChild(btnConfigHub);
menu.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { menu.classList.remove('aberto'); aba.setAttribute('aria-expanded', 'false'); aba.focus(); }
});
aba.setAttribute('aria-expanded', 'false');
aba.addEventListener('click', () => queueMicrotask(() => aba.setAttribute('aria-expanded', String(menu.classList.contains('aberto')))));

// --- Lógica de Posicionamento ---
function aplicarPosicao() {
    chrome.storage.local.get(['posicaoBarra'], (res) => {
        const posicao = res.posicaoBarra || 'direita';
        
        menu.classList.remove('pos-direita', 'pos-esquerda', 'pos-topo', 'aberto');
        menu.classList.add(`pos-${posicao}`);
        
        if (posicao === 'direita') aba.innerText = '◀';
        if (posicao === 'esquerda') aba.innerText = '▶';
        if (posicao === 'topo') aba.innerText = '▼';

        if (posicao === 'topo') {
            aba.innerText = '▼';
            wrapperControles.style.flexDirection = "column";
            wrapperControles.style.justifyContent = "center";
            wrapperControles.style.padding = "10px 20px";
            linhaMarca.style.width = "100%";
            document.getElementById('hub-search-row').style.width = "300px";
            document.getElementById('hub-search-row').style.marginTop = "8px";
            btnCotacao.style.margin = "0";
            document.getElementById('busca-botoes').style.marginBottom = "0";
            document.getElementById('busca-botoes').style.width = "0";
        } else {
            wrapperControles.style.flexDirection = "column";
            linhaMarca.style.width = "100%";
            document.getElementById('hub-search-row').style.width = "92%";
            document.getElementById('hub-search-row').style.marginTop = "8px";
            btnCotacao.style.margin = "0";
            document.getElementById('busca-botoes').style.marginBottom = "0";
            document.getElementById('busca-botoes').style.width = "100%";
        }
    });
}

// --- Lógica de Abrir/Fechar ---
aba.onclick = () => {
    const estaAberto = menu.classList.toggle('aberto');
    chrome.storage.local.get(['posicaoBarra'], (res) => {
        const p = res.posicaoBarra || 'direita';
        
        if (p === 'direita') aba.innerText = estaAberto ? '▶' : '◀';
        if (p === 'esquerda') aba.innerText = estaAberto ? '◀' : '▶';
        if (p === 'topo') aba.innerText = estaAberto ? '▲' : '▼';
    });
};

// --- Lógica de Imagem (Base64) ---
function handleImageDragBase64(e, imgElement, urlImagem) {
    try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = imgElement.naturalWidth;
        canvas.height = imgElement.naturalHeight;
        ctx.drawImage(imgElement, 0, 0);
        const dataURL = canvas.toDataURL('image/png');
        const nomeArquivo = `icd_doc_${Date.now()}.png`;
        e.dataTransfer.setData('DownloadURL', `image/png:${nomeArquivo}:${dataURL}`);
        e.dataTransfer.setData('text/uri-list', urlImagem);
    } catch (err) {
        e.dataTransfer.setData('text/plain', urlImagem);
    }
}

function fecharOpcoesIdiomas() {
    menu.querySelectorAll('.icd-idiomas-opcoes').forEach(el => { el.hidden = true; });
    menu.querySelectorAll('.btn-atalho-hub[aria-expanded]').forEach(el => el.setAttribute('aria-expanded', 'false'));
}
document.addEventListener('click', e => {
    if (!(e.target instanceof Element) || !e.target.closest('#menu-automacao-hub .icd-atalho-card')) fecharOpcoesIdiomas();
});

// --- Renderizar Botões (COM PASTAS E DRAG & DROP DE PASTAS) ---
function carregarBotoes() {
    chrome.storage.local.get(['configMaster', 'listaPastas'], (res) => {
        const container = document.getElementById('container-botoes-hub');
        const inputBusca = document.getElementById('busca-botoes');
        const botoes = res.configMaster || [];
        const pastas = res.listaPastas || [];

        function renderizar(filtro = "") {
            filtro = filtro.trim();
            container.innerHTML = "";
            
            if (!filtro && !pastaAtiva) {
                pastas.forEach((nomePasta, index) => {
                    const btnPasta = document.createElement('button');
                    btnPasta.type = 'button';
                    btnPasta.className = 'btn-pasta-hub';
                    btnPasta.draggable = true;
                    btnPasta.dataset.index = index;
                    btnPasta.dataset.nome = nomePasta;
                    btnPasta.textContent = nomePasta;
                    btnPasta.setAttribute('aria-label', `Abrir pasta ${nomePasta}`);
                    
                    btnPasta.onclick = (e) => {
                        if (e.target.closest('.dragging')) return; 
                        pastaAtiva = nomePasta;
                        renderizar(); 
                    };

                    btnPasta.addEventListener('dragstart', (e) => {
                        dragPastaSrcIndex = index;
                        btnPasta.classList.add('dragging');
                        e.dataTransfer.effectAllowed = 'move';
                        e.dataTransfer.setData('text/plain', nomePasta);
                    });

                    btnPasta.addEventListener('dragend', () => {
                        btnPasta.classList.remove('dragging');
                        document.querySelectorAll('.btn-pasta-hub').forEach(el => el.classList.remove('drag-over'));
                    });

                    btnPasta.addEventListener('dragover', (e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                        if (dragPastaSrcIndex !== index) {
                            btnPasta.classList.add('drag-over');
                        }
                    });

                    btnPasta.addEventListener('dragleave', () => {
                        btnPasta.classList.remove('drag-over');
                    });

                    btnPasta.addEventListener('drop', (e) => {
                        e.preventDefault();
                        btnPasta.classList.remove('drag-over');
                        if (dragPastaSrcIndex === null || dragPastaSrcIndex === index) return;

                        const pastasAtualizadas = [...pastas];
                        const itemMovido = pastasAtualizadas.splice(dragPastaSrcIndex, 1)[0];
                        pastasAtualizadas.splice(index, 0, itemMovido);

                        chrome.storage.local.set({ listaPastas: pastasAtualizadas }, () => {
                            carregarBotoes();
                        });
                    });

                    container.appendChild(btnPasta);
                });

                const botoesGeral = botoes.filter(b => !b.pasta || b.pasta === "Geral");
                if (botoesGeral.length > 0) {
                    const btnPastaGeral = document.createElement('button');
                    btnPastaGeral.type = 'button';
                    btnPastaGeral.className = 'btn-pasta-hub';
                    btnPastaGeral.innerHTML = `<span>📁</span> <span>Geral (Sem Pasta)</span> <span>▶</span>`;
                    btnPastaGeral.onclick = () => {
                        pastaAtiva = "Geral";
                        renderizar();
                    };
                    container.appendChild(btnPastaGeral);
                }
                return;
            }

            let botoesParaMostrar = [];
            if (pastaAtiva && !filtro) {
                const headerPasta = document.createElement('div');
                headerPasta.className = 'header-pasta-ativa';
                
                const btnVoltar = document.createElement('button');
                btnVoltar.className = 'btn-voltar-pasta';
                btnVoltar.innerHTML = '◀';
                // 🚀 REMOVIDO o title="Voltar para Pastas"
                btnVoltar.onclick = () => {
                    pastaAtiva = null;
                    renderizar(inputBusca.value); 
                };
                
                const tituloPasta = document.createElement('span');
                tituloPasta.className = 'titulo-pasta-ativa';
                tituloPasta.textContent = pastaAtiva;
                
                headerPasta.appendChild(btnVoltar);
                headerPasta.appendChild(tituloPasta);
                container.appendChild(headerPasta);
                
                botoesParaMostrar = botoes.filter(b => (b.pasta || "Geral") === pastaAtiva);
            } else {
                botoesParaMostrar = botoes;
            }

            if (filtro) {
                botoesParaMostrar = botoesParaMostrar.filter(b => ICDCotacao.busca([b.nome, b.texto, b.pasta || 'Geral', b.traducoes?.es, b.traducoes?.en].filter(Boolean).join(' ')).includes(ICDCotacao.busca(filtro)));
                const resumo = document.createElement('p');
                resumo.setAttribute('role', 'status');
                resumo.textContent = `${botoesParaMostrar.length} atalho(s) em todas as pastas`;
                resumo.style = 'font-size:12px;color:#c4b5fd;padding:0 10px';
                container.appendChild(resumo);
            }

            if (botoesParaMostrar.length === 0) {
                const msgVazio = document.createElement('p');
                msgVazio.style = 'font-size:11px; color:#666; text-align:center; padding: 10px;';
                msgVazio.innerText = "Nenhum atalho encontrado.";
                container.appendChild(msgVazio);
                return;
            }

            botoesParaMostrar.forEach((b) => {
                const btnWrapper = document.createElement('div');
                btnWrapper.className = 'icd-atalho-card';
                const linhaBotao = document.createElement('div');
                linhaBotao.className = 'icd-atalho-linha';
                if (filtro) {
                    const origem = document.createElement('small');
                    origem.textContent = `Pasta: ${b.pasta || 'Geral'}`;
                    origem.style = 'width:100%;color:#c4b5fd';
                    btnWrapper.appendChild(origem);
                }

                const btn = document.createElement('button');
                btn.className = 'btn-atalho-hub';
                btn.textContent = b.nome;
                
                const urlImagem = b.imagem || b.linkFoto;

                if (urlImagem) {
                    btn.textContent = `Imagem: ${b.nome}`;
                    const imgPreview = document.createElement('img');
                    imgPreview.src = urlImagem;
                    imgPreview.crossOrigin = "anonymous";
                    // 🚀 REMOVIDO o title="Clique e arraste para enviar esta imagem"
                    imgPreview.draggable = true;
                    imgPreview.style = "width: 35px; height: 35px; border-radius: 4px; cursor: grab; border: 2px solid #612d87; object-fit: cover; background: white;";
                    
                    imgPreview.addEventListener('dragstart', (e) => { 
                        imgPreview.style.opacity = "0.5";
                        handleImageDragBase64(e, imgPreview, urlImagem);
                    });
                    imgPreview.addEventListener('dragend', () => { imgPreview.style.opacity = "1"; });
                    linhaBotao.appendChild(imgPreview);
                }

                btn.type = 'button';
                const versoes = { pt: b.texto || textosPadrao[b.id] || '' };
                for (const idioma of ['es', 'en']) {
                    if (typeof b.traducoes?.[idioma] === 'string' && b.traducoes[idioma].trim()) versoes[idioma] = b.traducoes[idioma];
                }
                let opcoesIdiomas = null;
                if (Object.keys(versoes).length > 1) {
                    opcoesIdiomas = document.createElement('div');
                    opcoesIdiomas.className = 'icd-idiomas-opcoes';
                    opcoesIdiomas.hidden = true;
                    opcoesIdiomas.setAttribute('role', 'group');
                    opcoesIdiomas.setAttribute('aria-label', 'Escolha o idioma de ' + b.nome);
                    btn.setAttribute('aria-expanded', 'false');
                    btn.setAttribute('aria-label', b.nome + ' — escolher idioma');
                    const sinal = document.createElement('span');
                    sinal.className = 'icd-idiomas-sinal'; sinal.textContent = ' 🌐';
                    sinal.setAttribute('aria-hidden', 'true'); btn.appendChild(sinal);
                    const bandeiras = {
                        pt: '<rect width="30" height="20" fill="#16883e"/><path d="M15 2 28 10 15 18 2 10Z" fill="#ffdf00"/><circle cx="15" cy="10" r="5" fill="#123b91"/><path d="M10 8q5-1 10 4" fill="none" stroke="white" stroke-width="1"/>',
                        es: '<rect width="30" height="20" fill="#ad1519"/><path d="M0 5h30v10H0Z" fill="#fabd00"/><path d="M8 8v5h4V8Z" fill="#ad1519"/>',
                        en: '<rect width="30" height="20" fill="#012169"/><path d="m0 0 30 20m0-20L0 20" stroke="white" stroke-width="5"/><path d="m0 0 30 20m0-20L0 20" stroke="#c8102e" stroke-width="2"/><path d="M15 0v20M0 10h30" stroke="white" stroke-width="7"/><path d="M15 0v20M0 10h30" stroke="#c8102e" stroke-width="4"/>'
                    };
                    for (const [codigo, nome] of [['pt', 'Português'], ['es', 'Español'], ['en', 'English']]) {
                        if (!Object.hasOwn(versoes, codigo)) continue;
                        const opcao = document.createElement('button');
                        opcao.type = 'button'; opcao.className = 'icd-idioma-opcao'; opcao.dataset.idioma = codigo;
                        opcao.setAttribute('aria-label', 'Inserir mensagem em ' + nome);
                        const icone = document.createElement('span'); icone.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 20" width="27" height="18" aria-hidden="true">' + bandeiras[codigo] + '</svg>'; icone.setAttribute('aria-hidden', 'true');
                        const sigla = document.createElement('span'); sigla.textContent = codigo.toUpperCase();
                        opcao.append(icone, sigla);
                        opcao.onclick = () => { fecharOpcoesIdiomas(); enviarTexto(versoes[codigo]); };
                        opcoesIdiomas.appendChild(opcao);
                    }
                    btnWrapper.addEventListener('keydown', e => {
                        if (e.key === 'Escape' && !opcoesIdiomas.hidden) {
                            e.preventDefault(); e.stopPropagation(); fecharOpcoesIdiomas(); btn.focus();
                        }
                    });
                }
                btn.onclick = () => {
                    const abrir = opcoesIdiomas?.hidden;
                    fecharOpcoesIdiomas();
                    if (!opcoesIdiomas) { enviarTexto(versoes.pt); return; }
                    if (abrir) {
                        opcoesIdiomas.hidden = false; btn.setAttribute('aria-expanded', 'true');
                        opcoesIdiomas.querySelector('button').focus();
                    }
                };
                linhaBotao.appendChild(btn);
                btnWrapper.appendChild(linhaBotao);
                if (opcoesIdiomas) btnWrapper.appendChild(opcoesIdiomas);
                container.appendChild(btnWrapper);
            });
        }
        
        inputBusca.oninput = (e) => {
            renderizar(e.target.value);
        };
        
        renderizar(inputBusca.value);
    });
}

/* =========================================================
   ICD HUB - CALCULADORA DE COTAÇÃO (ARRASTÁVEL E MINIMIZÁVEL)
   ========================================================= */
function abrirCalculadoraCotacao() {
    ICDCotacaoUI.abrir();
}

// ===== INICIALIZAÇÃO =====
aplicarPosicao();
carregarBotoes();

chrome.storage.onChanged.addListener((changes) => {
    if (changes.configMaster || changes.listaPastas) carregarBotoes();
    if (changes.posicaoBarra) aplicarPosicao();
});

// ================================================================
// ===== MONITOR DE MENSAGENS ENVIADAS (CONTAGEM POR TECLA ENTER) =
// ================================================================
function registrarEnvioWhatsApp(editor, metodo) {
    const texto = (editor?.innerText || editor?.textContent || '').trim();
    if (texto) window.METRICS?.registrar('whatsapp', { tamanho: texto.length, metodo });
}

document.addEventListener('keydown', evento => {
    if (evento.key !== 'Enter' || evento.shiftKey || evento.ctrlKey || evento.altKey ||
        evento.metaKey || evento.repeat || evento.isComposing) return;
    const editor = evento.target.closest?.('footer [contenteditable="true"][role="textbox"], div[contenteditable="true"][data-tab="10"]');
    registrarEnvioWhatsApp(editor, 'enter');
}, true);

document.addEventListener('click', evento => {
    const botao = evento.target.closest?.('footer button, footer [role="button"]');
    if (!botao?.matches('[data-testid="compose-btn-send"]') && !botao?.querySelector('[data-icon="send"]')) return;
    const editor = botao.closest('footer').querySelector('[contenteditable="true"][role="textbox"], [contenteditable="true"][data-tab="10"]');
    registrarEnvioWhatsApp(editor, 'click');
}, true);
