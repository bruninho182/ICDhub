// ================================================================
// ICD Hub: Automação de Remarcação de Vouchers (v4 - Corrigida)
// ================================================================
console.log("✅ ICD Hub: Módulo de Remarcação v4 carregado");

const REMARCACAO_KEY = 'remarcacaoDados';
const CHAVE_OPERADOR = 'nomeOperador';

// ================================================================
// DETECÇÃO DE PÁGINA
// ================================================================
function isVoucherPage() {
    const path = window.location.pathname;
    return /\/apps\/sales\/bookings\/[a-f0-9-]{20,}$/i.test(path) && !path.endsWith('/new');
}

function isNewBookingPage() {
    return window.location.pathname.endsWith('/apps/sales/bookings/new');
}

// ================================================================
// UTILITÁRIOS
// ================================================================
function setReactValue(element, value) {
    if (!element) return false;
    try {
        const proto = element.tagName === 'TEXTAREA'
            ? window.HTMLTextAreaElement.prototype
            : window.HTMLInputElement.prototype;
        const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value').set;
        nativeSetter.call(element, value);
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
        element.dispatchEvent(new Event('blur', { bubbles: true }));
        return true;
    } catch (e) {
        console.warn('⚠️ setReactValue falhou:', e);
        return false;
    }
}

function limparRefExterna(ref) {
    if (!ref) return '';
    // 1. Normaliza: garante " - " após "PAGO NO COD" (aceita com/sem acento, maiúsc/minúsc)
    let normalizado = ref.replace(/^(pago\s+no\s+c[óo]d)\s*-?\s*/i, '$1 - ');
    // 2. Divide por " - " e remove o último segmento (nome do operador)
    const partes = normalizado.split(/\s+-\s+/);
    if (partes.length > 1) {
        partes.pop();
        return partes.join(' - ').trim();
    }
    return normalizado.trim();
}

// Helper: monta "PAGO NO COD - voucher - operador"
function montarRefPadrao(voucher, operador) {
    let ref = `PAGO NO COD - ${voucher}`;
    if (operador) ref += ` - ${operador}`;
    return ref;
}

// ================================================================
// EXTRAÇÃO: VOUCHER (múltiplas estratégias)
// ================================================================
function extrairVoucher() {
    const candidatos = [];

    // 1. Chips pequenos (padrão)
    document.querySelectorAll('span.MuiChip-label.MuiChip-labelSmall').forEach(el => {
        candidatos.push({ fonte: 'chip-small', texto: el.textContent });
    });
    // 2. Qualquer chip-label
    document.querySelectorAll('.MuiChip-label').forEach(el => {
        candidatos.push({ fonte: 'chip-label', texto: el.textContent });
    });
    // 3. Chip ROOT inteiro (caso texto esteja fragmentado em filhos)
    document.querySelectorAll('.MuiChip-root').forEach(el => {
        candidatos.push({ fonte: 'chip-root', texto: el.textContent });
    });

    console.log('🎫 Candidatos a voucher:', candidatos);

    for (const c of candidatos) {
        const t = (c.texto || '').replace(/\s+/g, '').trim();
        if (t.length >= 4 && /[A-Z]/i.test(t) && /\d/.test(t)) {
            console.log(`✅ Voucher encontrado via ${c.fonte}: "${t}"`);
            return t;
        }
    }

    // 4. Último recurso: heading com padrão de voucher
    const headings = document.querySelectorAll('h1, h2, h3, h4, [role="heading"]');
    for (const h of headings) {
        const t = h.textContent.replace(/\s+/g, '').trim();
        const m = t.match(/[A-Z0-9]{4,}-[A-Z0-9]+/i);
        if (m) {
            console.log('✅ Voucher via heading:', m[0]);
            return m[0];
        }
    }

    console.warn('⚠️ Voucher NÃO encontrado');
    return '';
}

// ================================================================
// EXTRAÇÃO: EMAIL (via botão "Copiar" — mais confiável)
// ================================================================
function extrairEmail() {
    const botoesCopiar = document.querySelectorAll('button[aria-label="Copiar"], button[aria-label="Copiar e-mail"], button[aria-label="Copy"]');
    console.log(`📧 Botões "Copiar" encontrados: ${botoesCopiar.length}`);

    for (const btn of botoesCopiar) {
        const parent = btn.parentElement;
        if (!parent) continue;
        const candidatos = parent.querySelectorAll('p, span, div');
        for (const el of candidatos) {
            const t = el.textContent.trim();
            if (/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(t)) {
                console.log('✅ Email via botão copiar:', t);
                return t;
            }
        }
    }

    const todosP = document.querySelectorAll('p');
    for (const p of todosP) {
        const t = p.textContent.trim();
        if (/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(t)) {
            console.log('✅ Email via <p>:', t);
            return t;
        }
    }

    const m = document.body.innerText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    if (m) {
        console.log('✅ Email via regex no body:', m[0]);
        return m[0];
    }

    console.warn('⚠️ Email NÃO encontrado');
    return '';
}

// ================================================================
// EXTRAÇÃO: UNIDADE, REF EXTERNA, MÉTODO PAGAMENTO
// ================================================================
function extrairUnidade() {
    const todosP = Array.from(document.querySelectorAll('p.MuiTypography-root.MuiTypography-body1'));
    for (const p of todosP) {
        const t = p.textContent.trim();
        if (/^(000\s*Call\s*Center|eCOMERCE\s*-\s*TREM\s*DO\s*CORCOVADO)/i.test(t)) {
            console.log('✅ Unidade:', t);
            return t;
        }
    }
    const body = document.body.innerText;
    const m1 = body.match(/000\s*Call\s*Center/i);
    if (m1) return '000 Call Center';
    const m2 = body.match(/eCOMERCE\s*-\s*TREM\s*DO\s*CORCOVADO/i);
    if (m2) return 'eCOMERCE - TREM DO CORCOVADO';
    console.warn('⚠️ Unidade não encontrada');
    return '';
}

function extrairRefExterna() {
    const todosP = Array.from(document.querySelectorAll('p.MuiTypography-root.MuiTypography-body1'));
    for (const p of todosP) {
        const t = p.textContent.trim();
        if (/^pago\s+no\s+c[óo]d/i.test(t)) {
            console.log('✅ Ref Externa:', t);
            return t;
        }
    }
    const m = document.body.innerText.match(/pago\s+no\s+c[óo]d[\s\S]{0,80}?(?=\n|$)/i);
    if (m) {
        const t = m[0].trim();
        console.log('✅ Ref Externa via regex:', t);
        return t;
    }
    console.warn('⚠️ Ref Externa não encontrada');
    return '';
}

function extrairMetodoPagamento() {
    const labels = document.querySelectorAll('label, .MuiFormLabel-root, p, span');
    for (const el of labels) {
        const txt = el.textContent.toLowerCase();
        if (txt.includes('método de pagamento') || txt.includes('forma de pagamento')) {
            const container = el.closest('.MuiFormControl-root, div');
            if (container) {
                const valor = container.querySelector('.MuiSelect-select, [role="button"]');
                if (valor) {
                    const v = valor.textContent.trim().toLowerCase();
                    if (v.includes('faturado')) { console.log('✅ Pagamento: faturado'); return 'faturado'; }
                    if (v.includes('pix'))      { console.log('✅ Pagamento: pix'); return 'pix'; }
                    if (v.includes('link'))     { console.log('✅ Pagamento: link'); return 'link'; }
                }
            }
        }
    }
    const body = document.body.innerText.toLowerCase();
    if (/\bfaturado\b/.test(body)) { console.log('✅ Pagamento (fallback): faturado'); return 'faturado'; }
    if (/\bpix\b/.test(body))      { console.log('✅ Pagamento (fallback): pix'); return 'pix'; }
    if (/link\s+de\s+pagamento/.test(body)) { console.log('✅ Pagamento (fallback): link'); return 'link'; }
    return '';
}

// ================================================================
// PÁGINA VOUCHER — PROCESSAMENTO
// ================================================================
async function processarRemarcacao() {
    console.log('🔄 Iniciando processamento de remarcação...');

    const voucher = extrairVoucher();
    const email = extrairEmail();
    const unidade = extrairUnidade();
    const refExterna = extrairRefExterna();
    const metodoPagamento = extrairMetodoPagamento();

    console.log('📊 Dados extraídos:', { voucher, email, unidade, refExterna, metodoPagamento });

    if (!voucher || !email) {
        alert(
            `⚠️ Não foi possível encontrar os dados obrigatórios:\n\n` +
            `🎫 Voucher: ${voucher || '❌ NÃO ENCONTRADO'}\n` +
            `📧 E-mail: ${email || '❌ NÃO ENCONTRADO'}\n\n` +
            `Verifique se a página carregou completamente.`
        );
        return;
    }

    const storage = await chrome.storage.local.get([CHAVE_OPERADOR]);
    const operador = (storage[CHAVE_OPERADOR] || '').toUpperCase().trim();

    const dadosCopia = {
        voucher,
        email,
        usarRefExterna: false,
        refExterna: ''
    };

    const unidadeLower = unidade.toLowerCase();
    const isEcommerce = unidadeLower.includes('ecommerce');
    const isCallCenter = unidadeLower.includes('call center');

    let modo = '';

    if (isEcommerce) {
        // eCommerce: apenas voucher + email (campo Ref recebe o voucher puro)
        modo = 'eCommerce — apenas Voucher + E-mail';

    } else if (isCallCenter) {
        if (metodoPagamento === 'faturado' && refExterna) {
            // Call Center + Faturado → ref limpa (do site) + operador
            let refLimpa = limparRefExterna(refExterna);
            if (operador) refLimpa = `${refLimpa} - ${operador}`;
            dadosCopia.usarRefExterna = true;
            dadosCopia.refExterna = refLimpa;
            modo = 'Call Center + Faturado — Voucher + E-mail + Ref. Externa';

        } else {
            // ⭐ Call Center + Pix/Link → monta "PAGO NO COD - voucher - operador"
            dadosCopia.usarRefExterna = true;
            dadosCopia.refExterna = montarRefPadrao(voucher, operador);
            modo = `Call Center + ${metodoPagamento || 'não identificado'} — Ref. montada como "PAGO NO COD - voucher - operador"`;
        }

    } else {
        // ⭐ Unidade não identificada → monta "PAGO NO COD - voucher - operador"
        dadosCopia.usarRefExterna = true;
        dadosCopia.refExterna = montarRefPadrao(voucher, operador);
        modo = 'Unidade não identificada — Ref. montada como "PAGO NO COD - voucher - operador"';
    }

    await chrome.storage.local.set({ [REMARCACAO_KEY]: dadosCopia });

    alert(
        `✅ Dados copiados com sucesso!\n\n` +
        `📌 Modo: ${modo}\n\n` +
        `🎫 Voucher: ${voucher}\n` +
        `📧 E-mail: ${email}` +
        (dadosCopia.usarRefExterna ? `\n📎 Ref. Externa: ${dadosCopia.refExterna}` : '') +
        `\n\n➡️ Agora abra a página "Nova Reserva" e clique em "Colar dados da Rema".`
    );
    console.log('💾 Salvo em storage:', dadosCopia);
}

// ================================================================
// BOTÃO FLUTUANTE — PÁGINA VOUCHER
// ================================================================
function criarBotaoRemarcacao() {
    if (document.getElementById('btn-remarcacao-icd')) return;
    if (!isVoucherPage()) return;

    const btn = document.createElement('button');
    btn.id = 'btn-remarcacao-icd';
    btn.innerText = '🔄 Remarcação';
    btn.style.cssText = `
        position: fixed; bottom: 30px; right: 30px; z-index: 999999;
        padding: 14px 24px; background: linear-gradient(135deg, #612d87, #8b5cf6);
        color: white; border: none; border-radius: 50px; cursor: pointer;
        font-weight: bold; font-size: 14px; font-family: 'Inter', sans-serif;
        box-shadow: 0 6px 20px rgba(97, 45, 135, 0.4); transition: all 0.25s ease;
    `;
    btn.onmouseover = () => btn.style.transform = 'scale(1.06)';
    btn.onmouseout = () => btn.style.transform = 'scale(1)';
    btn.onclick = processarRemarcacao;

    document.body.appendChild(btn);
    console.log('✅ Botão "Remarcação" injetado');
}

// ================================================================
// PÁGINA NOVA RESERVA — BUSCA DE CAMPOS (SELETORES EXATOS)
// ================================================================
function encontrarRefField() {
    // 1. Placeholder EXATO conforme HTML fornecido
    let el = document.querySelector('input[placeholder="Ex: GYG-123456"]');
    if (el) { console.log('✅ Campo Ref encontrado via placeholder exato'); return el; }

    // 2. Placeholder parcial
    el = document.querySelector('input[placeholder*="GYG"], input[placeholder*="Referência"], input[placeholder*="referência"]');
    if (el) { console.log('✅ Campo Ref via placeholder parcial'); return el; }

    // 3. Por label
    const labels = document.querySelectorAll('label');
    for (const l of labels) {
        if (l.textContent.toLowerCase().includes('referência externa')) {
            const c = l.closest('.MuiFormControl-root');
            if (c) {
                const i = c.querySelector('input');
                if (i) { console.log('✅ Campo Ref via label'); return i; }
            }
        }
    }
    console.warn('⚠️ Campo Referência Externa NÃO encontrado');
    return null;
}

function encontrarEmailField() {
    const inputs = document.querySelectorAll('input[type="text"]');

    // 1. maxlength=150 E container tem "e-mail"
    for (const i of inputs) {
        if (i.maxLength === 150) {
            const c = i.closest('.MuiFormControl-root');
            if (c && /e-?mail/i.test(c.textContent)) {
                console.log('✅ Campo Email via maxlength+label');
                return i;
            }
        }
    }
    // 2. Só maxlength=150
    for (const i of inputs) {
        if (i.maxLength === 150) {
            console.log('✅ Campo Email via maxlength=150');
            return i;
        }
    }
    // 3. Por label E-mail
    const labels = document.querySelectorAll('label');
    for (const l of labels) {
        if (/e-?mail/i.test(l.textContent)) {
            const c = l.closest('.MuiFormControl-root');
            if (c) {
                const i = c.querySelector('input');
                if (i) { console.log('✅ Campo Email via label'); return i; }
            }
        }
    }
    console.warn('⚠️ Campo E-mail NÃO encontrado');
    return null;
}

// ================================================================
// SELECIONAR "FATURADO" (v3 - com mousedown correto p/ MUI)
// ================================================================
async function selecionarFaturado(tentativa = 0) {
    const MAX_TENTATIVAS = 8;
    const DELAY_RETRY = 600;

    console.log(`💳 [Faturado] Tentativa ${tentativa + 1}/${MAX_TENTATIVAS}...`);

    // ------------------------------------------------------------
    // 1. LOCALIZAR O SELECT
    // ------------------------------------------------------------
    let selectEl = null;
    let origem = '';

    // Estratégia A: pelo native input com o UUID exato (mais seguro!)
    const nativeInput = document.querySelector(
        'input.MuiSelect-nativeInput[value="7ff54cf4-7f96-4e79-84ab-7f9dd46e5390"]'
    );
    if (nativeInput) {
        const parentRoot = nativeInput.closest('.MuiInputBase-root');
        if (parentRoot) {
            selectEl = parentRoot.querySelector('.MuiSelect-select[role="button"]');
            if (selectEl) origem = 'native-input-UUID';
        }
    }

    // Estratégia B: pela label "Selecione o Método de Pagamento"
    if (!selectEl) {
        const labels = document.querySelectorAll('label, legend');
        for (const l of labels) {
            const t = l.textContent.toLowerCase().trim();
            if (t.includes('método de pagamento') || t.includes('metodo de pagamento') || t.includes('forma de pagamento')) {
                const container = l.closest('.MuiFormControl-root, .MuiInputBase-root, .MuiOutlinedInput-root');
                if (container) {
                    const cand = container.querySelector('.MuiSelect-select[role="button"], [role="button"][aria-haspopup="listbox"]');
                    if (cand) { selectEl = cand; origem = 'label'; break; }
                }
            }
        }
    }

    // Estratégia C: pelo <fieldset><legend> com o texto
    if (!selectEl) {
        const legends = document.querySelectorAll('legend span, legend');
        for (const lg of legends) {
            if (lg.textContent.toLowerCase().includes('método de pagamento')) {
                const container = lg.closest('.MuiInputBase-root');
                if (container) {
                    const cand = container.querySelector('.MuiSelect-select[role="button"]');
                    if (cand) { selectEl = cand; origem = 'legend'; break; }
                }
            }
        }
    }

    // Estratégia D: primeiro .MuiSelect-select[aria-haspopup="listbox"]
    if (!selectEl) {
        selectEl = document.querySelector('.MuiSelect-select[role="button"][aria-haspopup="listbox"]');
        if (selectEl) origem = 'fallback-primeiro';
    }

    // Se ainda não achou → retry
    if (!selectEl) {
        if (tentativa < MAX_TENTATIVAS) {
            console.warn(`⏳ Select não disponível ainda. Retry em ${DELAY_RETRY}ms...`);
            await new Promise(r => setTimeout(r, DELAY_RETRY));
            return selecionarFaturado(tentativa + 1);
        }
        console.error('❌ [Faturado] Select NÃO encontrado após todas as tentativas.');
        return false;
    }

    console.log(`✅ [Faturado] Select encontrado via "${origem}"`);

    // ------------------------------------------------------------
    // 2. VERIFICAR SE JÁ ESTÁ EM "FATURADO"
    // ------------------------------------------------------------
    const textoAtual = selectEl.textContent.trim();
    console.log(`📌 [Faturado] Valor atual do select: "${textoAtual}"`);
    if (textoAtual.toLowerCase() === 'faturado') {
        console.log('✅ [Faturado] Já está em Faturado. Nada a fazer.');
        return true;
    }

    // ------------------------------------------------------------
    // 3. ABRIR O DROPDOWN COM EVENTOS REALISTAS (mousedown + mouseup + click)
    // ------------------------------------------------------------
    selectEl.scrollIntoView({ block: 'center', behavior: 'auto' });
    await new Promise(r => setTimeout(r, 200));

    selectEl.focus();
    await new Promise(r => setTimeout(r, 80));

    // MUI Select reage ao MOUSEDOWN — esse é o segredo!
    const dispatchMouse = (el, type) => {
        const ev = new MouseEvent(type, {
            bubbles: true,
            cancelable: true,
            view: window,
            button: 0,
            buttons: 1
        });
        el.dispatchEvent(ev);
    };

    dispatchMouse(selectEl, 'mousedown');
    await new Promise(r => setTimeout(r, 50));
    dispatchMouse(selectEl, 'mouseup');
    await new Promise(r => setTimeout(r, 50));
    selectEl.click();
    console.log('🖱️ [Faturado] Eventos mousedown/mouseup/click disparados');

    // ------------------------------------------------------------
    // 4. AGUARDAR O MENU DO MUI (ele renderiza num Portal fora do DOM principal)
    // ------------------------------------------------------------
    let opcaoFaturado = null;
    const MAX_ESPERA_MENU = 15; // até ~3s
    for (let i = 0; i < MAX_ESPERA_MENU; i++) {
        await new Promise(r => setTimeout(r, 200));

        const opcoes = document.querySelectorAll(
            'li[role="option"], .MuiMenuItem-root, [role="option"], .MuiMenu-list li'
        );

        if (opcoes.length > 0) {
            console.log(`📋 [Faturado] ${opcoes.length} opções visíveis:`, Array.from(opcoes).map(o => `"${o.textContent.trim()}"`).join(', '));
            for (const op of opcoes) {
                if (op.textContent.trim().toLowerCase() === 'faturado') {
                    opcaoFaturado = op;
                    break;
                }
            }
            if (opcaoFaturado) break;
        }
    }

    // ------------------------------------------------------------
    // 5. CLICAR NA OPÇÃO "FATURADO"
    // ------------------------------------------------------------
    if (opcaoFaturado) {
        opcaoFaturado.scrollIntoView({ block: 'center' });
        await new Promise(r => setTimeout(r, 80));
        opcaoFaturado.click();
        await new Promise(r => setTimeout(r, 400));

        // Confirma se mudou
        if (selectEl.textContent.trim().toLowerCase() === 'faturado') {
            console.log('✅ [Faturado] SUCESSO! Faturado selecionado.');
            return true;
        }
        console.warn('⚠️ [Faturado] Clicou mas valor não mudou. Retry geral...');
    } else {
        console.warn('⚠️ [Faturado] Menu abriu mas opção "Faturado" não foi encontrada.');
    }

    // ------------------------------------------------------------
    // 6. FALLBACK: FECHAR MENU E RETENTAR (reabre do zero)
    // ------------------------------------------------------------
    if (tentativa < MAX_TENTATIVAS - 1) {
        // Fecha o menu se estiver aberto
        document.body.click();
        await new Promise(r => setTimeout(r, 300));
        return selecionarFaturado(tentativa + 1);
    }

    console.error('❌ [Faturado] Falhou após todas as tentativas.');
    return false;
}

// ================================================================
// PÁGINA NOVA RESERVA — COLAR DADOS
// ================================================================
async function colarDadosRemarcacao() {
    console.log('📋 Iniciando colagem de dados...');

    const storage = await chrome.storage.local.get([REMARCACAO_KEY]);
    const dados = storage[REMARCACAO_KEY];

    if (!dados) {
        alert('⚠️ Nenhum dado de remarcação encontrado.\n\nPrimeiro clique no botão "🔄 Remarcação" na página do voucher.');
        return;
    }

    console.log('💾 Dados lidos do storage:', dados);

    const resultados = { faturado: false, referencia: false, email: false };

    // 1. Método de Pagamento = Faturado
    resultados.faturado = await selecionarFaturado();
    await new Promise(r => setTimeout(r, 400));

    // 2. Referência Externa (usa refExterna SE existir, senão usa voucher)
    const refInput = encontrarRefField();
    const valorRef = dados.usarRefExterna ? dados.refExterna : dados.voucher;

    if (refInput) {
        setReactValue(refInput, valorRef);
        resultados.referencia = true;
        console.log('✅ Ref preenchida:', valorRef);
    }

    await new Promise(r => setTimeout(r, 250));

    // 3. E-mail
    const emailInput = encontrarEmailField();
    if (emailInput) {
        setReactValue(emailInput, dados.email);
        resultados.email = true;
        console.log('✅ Email preenchido:', dados.email);
    }

    alert(
        `📋 Relatório de Colagem\n\n` +
        `💳 Método Faturado: ${resultados.faturado ? '✅' : '❌'}\n` +
        `📎 Referência: ${resultados.referencia ? '✅' : '❌'}\n   → ${valorRef}\n` +
        `📧 E-mail: ${resultados.email ? '✅' : '❌'}\n   → ${dados.email}\n\n` +
        `Verifique os campos antes de finalizar.`
    );
}

// ================================================================
// BOTÃO FLUTUANTE — PÁGINA NOVA RESERVA
// ================================================================
function criarBotaoColar() {
    if (document.getElementById('btn-colar-rema-icd')) return;
    if (!isNewBookingPage()) return;

    const btn = document.createElement('button');
    btn.id = 'btn-colar-rema-icd';
    btn.innerText = '📋 Colar dados da Rema';
    btn.style.cssText = `
        position: fixed; bottom: 30px; right: 30px; z-index: 999999;
        padding: 14px 24px; background: linear-gradient(135deg, #25D366, #128C7E);
        color: white; border: none; border-radius: 50px; cursor: pointer;
        font-weight: bold; font-size: 14px; font-family: 'Inter', sans-serif;
        box-shadow: 0 6px 20px rgba(37, 211, 102, 0.4); transition: all 0.25s ease;
    `;
    btn.onmouseover = () => btn.style.transform = 'scale(1.06)';
    btn.onmouseout = () => btn.style.transform = 'scale(1)';
    btn.onclick = colarDadosRemarcacao;

    document.body.appendChild(btn);
    console.log('✅ Botão "Colar dados da Rema" injetado');
}

// ================================================================
// INICIALIZAÇÃO
// ================================================================
function inicializar() {
    if (isVoucherPage()) criarBotaoRemarcacao();
    else if (isNewBookingPage()) criarBotaoColar();
}

let tentativas = 0;
const tentar = () => {
    tentativas++;
    inicializar();
    if (tentativas < 20) setTimeout(tentar, 800);
};
tentar();

let ultimaUrl = location.href;
const obsUrl = new MutationObserver(() => {
    if (location.href !== ultimaUrl) {
        ultimaUrl = location.href;
        setTimeout(() => { tentativas = 0; tentar(); }, 1200);
    }
});
obsUrl.observe(document.body, { childList: true, subtree: true });

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializar);
}