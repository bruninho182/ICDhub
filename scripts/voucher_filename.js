const ICDVoucherFilename = {
  limpar(nome) {
    if (typeof nome !== 'string' || !nome.trim()) return null;
    const base = nome.trim().replace(/^voucher-/i, '').replace(/\.pdf$/i, '')
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, ' ').replace(/\s+/g, ' ').replace(/[. ]+$/g, '').trim().slice(0, 170).replace(/[. ]+$/g, '');
    if (!base) return null;
    return (/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(base) ? 'voucher-' : '') + base + '.pdf';
  },
  origemICD(url) {
    try {
      const parsed = new URL(String(url || '').replace(/^blob:/, ''));
      return parsed.hostname === 'app.icdgrupo.com.br' || parsed.hostname === 'ingressocomdesconto.com.br' || parsed.hostname.endsWith('.ingressocomdesconto.com.br');
    } catch { return false; }
  },
};
if (typeof module !== 'undefined') module.exports = ICDVoucherFilename;
