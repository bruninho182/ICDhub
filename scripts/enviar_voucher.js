function montarBotaoConferenciaVoucher() {
    const paginaVoucher = /\/voucher\.asp$/i.test(location.pathname) || /\/apps\/sales\/bookings\/[a-f0-9-]{20,}$/i.test(location.pathname);
    const existente = document.getElementById('btn-abrir-mail');
    if (!paginaVoucher) { existente?.remove(); return; }
    if (existente) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'btn-abrir-mail';
    btn.textContent = '📧 Conferir voucher e preparar e-mail';
    btn.style = 'position:fixed;bottom:90px;right:30px;max-width:calc(100vw - 60px);z-index:9999;padding:15px;background:#612d87;color:white;border:none;border-radius:8px;cursor:pointer;font-weight:bold;box-shadow:0 4px 10px rgba(0,0,0,0.3);';
    btn.onclick = () => ICDVoucherReview.abrir();
    document.body.appendChild(btn);
}
montarBotaoConferenciaVoucher();
let ultimaPaginaVoucher = location.href;
new MutationObserver(() => {
    if (location.href !== ultimaPaginaVoucher) { ultimaPaginaVoucher = location.href; montarBotaoConferenciaVoucher(); }
}).observe(document.body, { childList:true, subtree:true });
