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
            <input type="text" id="busca-botoes" placeholder="🔍 Buscar atalho..." style="width: 90%; margin-bottom: 15px; padding: 8px; border-radius: 5px; border: 1px solid #ddd; display: block; font-size: 12px;">
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

// --- Renderizar Botões (COM PASTAS E DRAG & DROP DE PASTAS) ---
function carregarBotoes() {
    chrome.storage.local.get(['configMaster', 'listaPastas'], (res) => {
        const container = document.getElementById('container-botoes-hub');
        const inputBusca = document.getElementById('busca-botoes');
        const botoes = res.configMaster || [];
        const pastas = res.listaPastas || [];

        function renderizar(filtro = "") {
            container.innerHTML = "";
            
            if (!filtro && !pastaAtiva) {
                pastas.forEach((nomePasta, index) => {
                    const btnPasta = document.createElement('button');
                    btnPasta.type = 'button';
                    btnPasta.className = 'btn-pasta-hub';
                    btnPasta.draggable = true;
                    btnPasta.dataset.index = index;
                    btnPasta.dataset.nome = nomePasta;
                    btnPasta.innerHTML = `<span>📁</span> <span>${nomePasta}</span> <span>▶</span>`;
                    
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
            if (pastaAtiva) {
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
                tituloPasta.innerHTML = `<span class="icone-pasta-ativa">📁</span> ${pastaAtiva}`;
                
                headerPasta.appendChild(btnVoltar);
                headerPasta.appendChild(tituloPasta);
                container.appendChild(headerPasta);
                
                botoesParaMostrar = botoes.filter(b => (b.pasta || "Geral") === pastaAtiva);
            } else {
                botoesParaMostrar = botoes;
            }

            if (filtro) {
                botoesParaMostrar = botoesParaMostrar.filter(b => b.nome.toLowerCase().includes(filtro.toLowerCase()));
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
                btnWrapper.style = "display: flex; align-items: center; gap: 5px; margin-bottom: 8px; padding: 0 10px;";

                const btn = document.createElement('button');
                btn.className = 'btn-atalho-hub';
                btn.style = "flex: 1; display: flex; align-items: center; justify-content: center;";
                btn.innerText = b.nome;
                
                const urlImagem = b.imagem || b.linkFoto;

                if (urlImagem) {
                    btn.innerHTML = `<span>🖼️</span> <span style="margin-left:5px">${b.nome}</span>`;
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
                    btnWrapper.appendChild(imgPreview);
                }

                btn.onclick = () => enviarTexto(b.texto || textosPadrao[b.id] || "");
                btnWrapper.appendChild(btn);
                container.appendChild(btnWrapper);
            });
        }
        
        inputBusca.oninput = (e) => {
            if (e.target.value.length > 0) {
                pastaAtiva = null;
            }
            renderizar(e.target.value);
        };
        
        renderizar();
    });
}

/* =========================================================
   ICD HUB - CALCULADORA DE COTAÇÃO (ARRASTÁVEL E MINIMIZÁVEL)
   ========================================================= */
function abrirCalculadoraCotacao() {
    chrome.storage.local.get(['listaPasseios'], (res) => {
        const passeios = res.listaPasseios || [];
        
        // Se já existir, apenas traz para frente
        const modalExistente = document.getElementById('modal-cotacao-icd');
        if (modalExistente) {
            modalExistente.style.zIndex = 20000 + Date.now() % 1000;
            return;
        }

        const modal = document.createElement('div');
        modal.id = 'modal-cotacao-icd';
        
        modal.innerHTML = `
            <div class="cabecalho-modal" id="cabecalho-modal-cotacao">
                <h3>Calculadora de Cotação</h3>
                <div class="controles-modal">
                    <button id="btn-minimizar-cotacao">—</button>
                    <button id="btn-fechar-cotacao" class="fechar">✕</button>
                </div>
            </div>
            
            <div class="corpo-modal">
                <select id="select-passeio-cotacao">
                    <option value="">Selecione um Passeio...</option>
                    ${passeios.map((p, i) => `<option value="${i}">${p.nome}</option>`).join('')}
                </select>
                <div id="detalhes-cotacao"></div>
                <div id="total-cotacao">Total: R$ 0,00</div>
                <button id="btn-copiar-cotacao">Copiar Cotação</button>
            </div>
        `;
        
        document.body.appendChild(modal);

        // ============================================================
        // LÓGICA DE ARRASTAR (DRAG)
        // ============================================================
        const cabecalho = modal.querySelector('#cabecalho-modal-cotacao');
        let isDragging = false;
        let offsetX = 0;
        let offsetY = 0;

        cabecalho.addEventListener('mousedown', (e) => {
            if (e.target.closest('button')) return;
            
            isDragging = true;
            const rect = modal.getBoundingClientRect();
            offsetX = e.clientX - rect.left;
            offsetY = e.clientY - rect.top;
            
            modal.style.transition = 'none';
            document.body.style.userSelect = 'none';
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            
            let newLeft = e.clientX - offsetX;
            let newTop = e.clientY - offsetY;
            
            const maxLeft = window.innerWidth - modal.offsetWidth;
            const maxTop = window.innerHeight - modal.offsetHeight;
            
            newLeft = Math.max(0, Math.min(newLeft, maxLeft));
            newTop = Math.max(0, Math.min(newTop, maxTop));
            
            modal.style.left = newLeft + 'px';
            modal.style.top = newTop + 'px';
            modal.style.right = 'auto';
        });

        document.addEventListener('mouseup', () => {
            isDragging = false;
            document.body.style.userSelect = '';
        });

        // ============================================================
        // LÓGICA DE MINIMIZAR (SEM TITLE)
        // ============================================================
        const btnMinimizar = modal.querySelector('#btn-minimizar-cotacao');
        btnMinimizar.addEventListener('click', (e) => {
            e.stopPropagation();
            modal.classList.toggle('minimizado');
            btnMinimizar.innerText = modal.classList.contains('minimizado') ? '▢' : '—';
        });

        // ============================================================
        // LÓGICA DE FECHAR (SEM TITLE)
        // ============================================================
        const btnFechar = modal.querySelector('#btn-fechar-cotacao');
        btnFechar.addEventListener('click', (e) => {
            e.stopPropagation();
            modal.remove();
        });

        // ============================================================
        // LÓGICA DE COTAÇÃO
        // ============================================================
        const select = modal.querySelector('#select-passeio-cotacao');
        const detalhes = modal.querySelector('#detalhes-cotacao');
        const totalTxt = modal.querySelector('#total-cotacao');

        select.onchange = () => {
            const p = passeios[select.value];
            if (!p) { detalhes.innerHTML = ""; return; }
            
            detalhes.innerHTML = p.ingressos.map((ing) => `
                <div class="linha-ingresso-cotacao">
                    <div class="info-ingresso-cotacao">
                        <strong>${ing.tipo}</strong>
                        <span>R$ ${ing.valor}</span>
                    </div>
                    <input type="number" class="qtd-cotacao" data-valor="${ing.valor}" data-tipo="${ing.tipo}" value="0" min="0" aria-label="Quantidade: ${ing.tipo}">
                </div>
            `).join('');

            modal.querySelectorAll('.qtd-cotacao').forEach(input => {
                input.oninput = () => {
                    let total = 0;
                    modal.querySelectorAll('.qtd-cotacao').forEach(i => {
                        total += (Number(i.value) * Number(i.dataset.valor));
                    });
                    totalTxt.innerText = `Total: R$ ${total.toLocaleString('pt-br', {minimumFractionDigits: 2})}`;
                };
            });
        };

        modal.querySelector('#btn-copiar-cotacao').onclick = () => {
            const p = passeios[select.value];
            if(!p) return alert("Selecione um passeio primeiro!");

            let texto = `*✅ COTAÇÃO: ${p.nome.toUpperCase()}*\n\n`;
            let total = 0;
            let temItens = false;

            modal.querySelectorAll('.qtd-cotacao').forEach(input => {
                const qtd = Number(input.value);
                if (qtd > 0) {
                    temItens = true;
                    const subtotal = qtd * Number(input.dataset.valor);
                    texto += `▪️ ${qtd}x ${input.dataset.tipo}: R$ ${subtotal.toFixed(2)}\n`;
                    total += subtotal;
                }
            });

            if(!temItens) return alert("Adicione pelo menos 1 ingresso!");

            texto += `\n*💰 TOTAL: R$ ${total.toLocaleString('pt-br', {minimumFractionDigits: 2})}*`;
            
            navigator.clipboard.writeText(texto);
            
            const btn = modal.querySelector('#btn-copiar-cotacao');
            const textoOriginal = btn.innerText;
            btn.innerText = '✅ Copiado!';
            btn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
            setTimeout(() => {
                btn.innerText = textoOriginal;
                btn.style.background = '';
            }, 1500);
        };
    });
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
function iniciarMonitorWhatsApp() {
    console.log("📊 Monitor de WhatsApp iniciado...");
    
    function capturarEnter(event) {
        if (event.key === 'Enter' && !event.shiftKey) {
            const target = event.target;
            if (target && target.getAttribute('contenteditable') === 'true' && 
                target.getAttribute('data-tab') === '10') {
                
                const texto = target.innerText || '';
                
                if (window.METRICS) {
                    let contato = 'desconhecido';
                    const header = document.querySelector('[data-testid="conversation-info-header"]');
                    if (header) {
                        const span = header.querySelector('span');
                        if (span) contato = span.innerText;
                    }
                    
                    window.METRICS.registrar('whatsapp', {
                        destinatario: contato,
                        tamanho: texto.length,
                        metodo: 'enter'
                    });
                    
                    console.log(`📊 Mensagem registrada: ${texto.substring(0, 30)}... (${texto.length} caracteres)`);
                }
            }
        }
    }
    
    document.removeEventListener('keydown', capturarEnter);
    document.addEventListener('keydown', capturarEnter, true);
    console.log("✅ Monitor de ENTER ativado!");
}

if (document.readyState === 'complete') {
    iniciarMonitorWhatsApp();
} else {
    window.addEventListener('load', iniciarMonitorWhatsApp);
}

setTimeout(iniciarMonitorWhatsApp, 3000);
setTimeout(iniciarMonitorWhatsApp, 5000);

const observer = new MutationObserver(() => {
    const textarea = document.querySelector('div[contenteditable="true"][data-tab="10"]');
    if (textarea && !window._enterMonitorActive) {
        window._enterMonitorActive = true;
        iniciarMonitorWhatsApp();
    }
});

observer.observe(document.body, { childList: true, subtree: true });
