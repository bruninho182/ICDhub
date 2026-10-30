namespace ICDVoucherReview {
  declare const chrome: { storage: { local: { get(keys: string[]): Promise<{ dadosParaEmail?: Record<string, unknown> }>; set(value: Record<string, unknown>): Promise<void> } } };
  const limpar = (s: string): string => s.replace(/\s+/g, ' ').trim();
  const normalizar = (s: string): string => limpar(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/:$/, '');
  export function capturar(doc: Document): Record<string, string> {
    const campos: Record<string, string[]> = { cliente: ['nome', 'name', 'nome completo', 'cliente'], reserva: ['voucher', 'codigo da compra', 'codigo da reserva', 'reserva'], email: ['e-mail', 'email'], passeio: ['passeio', 'atracao', 'produto'], data: ['data da visita', 'data prevista', 'visit date'] };
    const resultado: Record<string, string> = {};
    for (const [chave, rotulos] of Object.entries(campos)) {
      const valores = new Set<string>();
      for (const el of doc.querySelectorAll('label,p,td,dt,span')) {
        if (!rotulos.includes(normalizar(el.textContent || ''))) continue;
        let valor = '';
        if (el instanceof HTMLLabelElement && el.htmlFor) valor = (doc.getElementById(el.htmlFor) as HTMLInputElement | null)?.value || '';
        if (!valor) valor = el.nextElementSibling?.textContent || '';
        valor = limpar(valor);
        if (valor && valor.length < 200 && !rotulos.includes(normalizar(valor))) valores.add(valor);
      }
      resultado[chave] = valores.size === 1 ? [...valores][0] : '';
    }
    if (resultado.data) {
      const m = resultado.data.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      resultado.data = m ? `${m[3]}-${m[2]}-${m[1]}` : /^\d{4}-\d{2}-\d{2}$/.test(resultado.data) ? resultado.data : '';
    }
    return resultado;
  }
  export function validar(dados: Record<string, string>): void {
    const faltantes = ['cliente', 'reserva', 'email'].filter(c => !dados[c]?.trim());
    if (faltantes.length) throw new Error('Preencha: ' + faltantes.join(', ') + '.');
    if (!/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(dados.email)) throw new Error('Confira o e-mail do cliente.');
  }
  export function abrir(): void {
    if (document.getElementById('icd-voucher-conferencia')) return;
    const host = document.createElement('div'); host.id = 'icd-voucher-conferencia'; const root = host.attachShadow({mode:'open'});
    root.innerHTML = `<style>dialog{font:14px/1.5 system-ui;width:min(560px,94vw);max-height:88vh;overflow:auto;box-sizing:border-box;padding:24px;border:0;border-radius:14px;color:#172033;background:#fff}dialog::backdrop{background:#14203899}label{display:block;margin-top:10px}input{box-sizing:border-box;width:100%;padding:9px;border:1px solid #94a3b8;border-radius:6px;font:inherit}button{margin:14px 8px 0 0;padding:10px;border-radius:7px;border:1px solid #94a3b8;background:#fff;font:inherit}#continuar{background:#6036b5;color:white}#status{color:#9c2639}p{color:#526077}:focus-visible{outline:3px solid #a78bfa}</style><dialog aria-labelledby="titulo"><h2 id="titulo">Conferir voucher</h2><p>Confira os dados com o documento que será anexado. Campos não reconhecidos ficam vazios para você preencher.</p><form><label>Cliente<input name="cliente" required></label><label>E-mail do destinatário<input name="email" type="email" required></label><label>Código da reserva<input name="reserva" required></label><label>Passeio (opcional)<input name="passeio"></label><label>Data da visita (opcional)<input name="data" type="date"></label><p id="status" role="status"></p><button type="button" id="cancelar">Cancelar</button><button id="continuar" type="submit">Revisar e preparar e-mail</button></form></dialog>`;
    const dialog = root.querySelector('dialog')!; const form = root.querySelector('form')!;
    const dadosPagina = capturar(document);
    for (const [chave, valor] of Object.entries(dadosPagina)) (form.elements.namedItem(chave) as HTMLInputElement).value = valor;
    const fechar = (): void => { dialog.close(); host.remove(); };
    root.getElementById('cancelar')!.onclick = fechar; dialog.oncancel = e => { e.preventDefault(); fechar(); };
    let ocupado = false;
    form.onsubmit = async e => {
      e.preventDefault(); if (ocupado) return; ocupado = true;
      const btn = root.getElementById('continuar') as HTMLButtonElement; btn.disabled = true;
      try {
        const dados = Object.fromEntries(['cliente','email','reserva','passeio','data'].map(k => [k, (form.elements.namedItem(k) as HTMLInputElement).value.trim()]));
        validar(dados);
        const anterior = (await chrome.storage.local.get(['dadosParaEmail'])).dadosParaEmail;
        const contexto = { cliente:dados.cliente, reserva:dados.reserva, passeio:dados.passeio, data:dados.data };
        const mensagem = { email:dados.email, assunto:`${dados.reserva} - ${dados.cliente}`, corpo:`Olá, ${dados.cliente}!\n\nSegue em anexo o voucher da sua reserva${dados.passeio ? ' para ' + dados.passeio : ''}.\n\nTenha um ótimo passeio!`, contextoVoucher:contexto };
        if (anterior?.email === mensagem.email && anterior.assunto === mensagem.assunto && typeof anterior.corpo === 'string' && anterior.corpo.trim()) mensagem.corpo = anterior.corpo;
        if (!await ICDOperacao.confirmar({titulo:'Revisar envio do voucher', descricao:'Confira cliente e documento. O anexo e o envio serão feitos manualmente no webmail.' + (anterior ? ' Existe um e-mail pendente; continuar substituirá essa preparação.' : ''), campos:[['Cliente',dados.cliente],['Destinatário',dados.email],['Reserva',dados.reserva],['Passeio',dados.passeio],['Data da visita',dados.data ? dados.data.split('-').reverse().join('/') : ''],['Assunto',mensagem.assunto],['Mensagem',mensagem.corpo], ...(anterior ? [['E-mail pendente anterior',String(anterior.email || '')] as [string,string]] : [])], acao:'Preparar e abrir webmail'})) return;
        const atual = (await chrome.storage.local.get(['dadosParaEmail'])).dadosParaEmail;
        if (JSON.stringify(anterior) !== JSON.stringify(atual)) throw new Error('Outro atendimento preparou um e-mail durante a revisão. Confira novamente.');
        const aba = window.open('about:blank','_blank');
        if (!aba) throw new Error('Permita abrir uma nova aba e tente novamente.');
        try { await chrome.storage.local.set({dadosParaEmail:mensagem}); aba.location.href='https://webmail-seguro.com.br/?_task=mail&_action=compose'; }
        catch (erro) { aba.close(); throw erro; }
        fechar();
      } catch(erro) { root.getElementById('status')!.textContent=(erro as Error).message; }
      finally { ocupado=false; btn.disabled=false; }
    };
    document.body.append(host); dialog.showModal();
  }
}
