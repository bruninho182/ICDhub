/* =========================================================
   TOOL: WHATSAPP SIDEBAR HUB (ULTIMATE VERSION + CALCULATOR)
   ========================================================= */

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
    <div id="aba-gatilho">◀</div> 
    
    <div id="wrapper-controles-hub" style="display: flex; flex-direction: column; align-items: center; gap: 5px;">
        <div id="btn-cotacao-hub" title="Calculadora de Cotação" style="cursor: pointer; font-size: 24px; text-align: center; background: #612d87; padding: 10px; border-radius: 8px; color: white; margin-bottom: 5px; transition: transform 0.2s;">💲</div>
        <input type="text" id="busca-botoes" placeholder="🔍 Buscar atalho..." style="width: 90%; margin-bottom: 15px; padding: 8px; border-radius: 5px; border: 1px solid #ddd; display: block; font-size: 12px;">
    </div>

    <div id="container-botoes-hub"></div>
`;

document.body.appendChild(menu);
const aba = document.getElementById('aba-gatilho');
const btnCotacao = document.getElementById('btn-cotacao-hub');
const wrapperControles = document.getElementById('wrapper-controles-hub');

// Evento para abrir a calculadora
btnCotacao.onclick = () => abrirCalculadoraCotacao();

// --- Lógica de Posicionamento (REVISADA PARA CORREÇÃO DO TOPO) ---
function aplicarPosicao() {
    chrome.storage.local.get(['posicaoBarra'], (res) => {
        const posicao = res.posicaoBarra || 'direita';
        
        // Remove estado aberto e posições anteriores ao trocar
        menu.classList.remove('pos-direita', 'pos-esquerda', 'pos-topo', 'aberto');
        menu.classList.add(`pos-${posicao}`);
        
        // Reset dos ícones iniciais (Sempre começa fechado)
        if (posicao === 'direita') aba.innerText = '◀';
        if (posicao === 'esquerda') aba.innerText = '▶';
        if (posicao === 'topo') aba.innerText = '▼';

        if (posicao === 'topo') {
    aba.innerText = '▼';
    wrapperControles.style.flexDirection = "row";
    wrapperControles.style.justifyContent = "center";
    wrapperControles.style.padding = "10px 20px";
    btnCotacao.style.margin = "0 15px 0 0";
    document.getElementById('busca-botoes').style.marginBottom = "0";
    document.getElementById('busca-botoes').style.width = "250px";
        } else {
            // Volta ao vertical para as laterais
            wrapperControles.style.flexDirection = "column";
            btnCotacao.style.margin = "0 0 5px 0";
            document.getElementById('busca-botoes').style.marginBottom = "15px";
            document.getElementById('busca-botoes').style.width = "90%";
        }
    });
}

// --- Lógica de Abrir/Fechar (REVISADA) ---
aba.onclick = () => {
    const estaAberto = menu.classList.toggle('aberto');
    chrome.storage.local.get(['posicaoBarra'], (res) => {
        const p = res.posicaoBarra || 'direita';
        
        // Lógica de setas dinâmica
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

// --- Renderizar Botões ---
function carregarBotoes() {
    chrome.storage.local.get(['configMaster'], (res) => {
        const container = document.getElementById('container-botoes-hub');
        const inputBusca = document.getElementById('busca-botoes');
        const botoes = res.configMaster || [];

        function renderizar(filtro = "") {
            container.innerHTML = "";
            const filtrados = botoes.filter(b => b.nome.toLowerCase().includes(filtro.toLowerCase()));

            if (filtrados.length === 0) {
                container.innerHTML = '<p style="font-size:11px; color:#666; text-align:center; padding: 10px;">Nenhum atalho encontrado.</p>';
                return;
            }

            filtrados.forEach(b => {
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
                    imgPreview.title = "Clique e arraste para enviar esta imagem";
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
                btnWrapper.prepend(btn); 
                container.appendChild(btnWrapper);
            });
        }
        inputBusca.oninput = (e) => renderizar(e.target.value);
        renderizar();
    });
}

/* =========================================================
   ICD HUB - CALCULADORA DE COTAÇÃO (LÓGICA)
   ========================================================= */
function abrirCalculadoraCotacao() {
    chrome.storage.local.get(['listaPasseios'], (res) => {
        const passeios = res.listaPasseios || [];
        
        if (document.getElementById('modal-cotacao-icd')) return;

        const modal = document.createElement('div');
        modal.id = 'modal-cotacao-icd';
        modal.style = "position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 350px; background: white; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); z-index: 20000; padding: 20px; font-family: sans-serif; color: #333;";
        
        modal.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; border-bottom: 1px solid #eee; padding-bottom: 10px;">
                <h3 style="margin:0; color:#612d87;">🧮 Calculadora de Cotação</h3>
                <span id="fechar-cotacao" style="cursor:pointer; font-weight:bold; font-size: 18px;">&times;</span>
            </div>
            <select id="select-passeio-cotacao" style="width:100%; padding:10px; border-radius:5px; margin-bottom:15px; border: 1px solid #ddd;">
                <option value="">Selecione um Passeio...</option>
                ${passeios.map((p, i) => `<option value="${i}">${p.nome}</option>`).join('')}
            </select>
            <div id="detalhes-cotacao" style="max-height: 250px; overflow-y: auto;"></div>
            <div id="total-cotacao" style="margin-top:15px; font-weight:bold; font-size:18px; color:#25D366; text-align:right; border-top: 1px solid #eee; padding-top: 10px;">Total: R$ 0,00</div>
            <button id="btn-copiar-cotacao" style="width:100%; margin-top:15px; padding:12px; background:#612d87; color:white; border:none; border-radius:5px; cursor:pointer; font-weight:bold;">📋 Copiar para o WhatsApp</button>
        `;
        
        document.body.appendChild(modal);

        const select = modal.querySelector('#select-passeio-cotacao');
        const detalhes = modal.querySelector('#detalhes-cotacao');
        const totalTxt = modal.querySelector('#total-cotacao');

        select.onchange = () => {
            const p = passeios[select.value];
            if (!p) { detalhes.innerHTML = ""; return; }
            
            detalhes.innerHTML = p.ingressos.map((ing) => `
                <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; background: #f9f9f9; padding: 8px; border-radius: 5px;">
                    <div style="font-size: 13px;">
                        <span style="display:block; font-weight:bold;">${ing.tipo}</span>
                        <span style="color: #666;">R$ ${ing.valor}</span>
                    </div>
                    <input type="number" class="qtd-cotacao" data-valor="${ing.valor}" data-tipo="${ing.tipo}" value="0" min="0" style="width:55px; padding:5px; border:1px solid #ccc; border-radius: 4px;">
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
            texto += `\n\n_Valores sujeitos a alteração de disponibilidade._`;
            
            navigator.clipboard.writeText(texto);
            alert("Orçamento copiado! Agora é só colar (Ctrl+V) no WhatsApp.");
        };

        modal.querySelector('#fechar-cotacao').onclick = () => modal.remove();
    });
}

// Inicializar
aplicarPosicao();
carregarBotoes();

chrome.storage.onChanged.addListener((changes) => {
    if (changes.configMaster) carregarBotoes();
    if (changes.posicaoBarra) aplicarPosicao();
});