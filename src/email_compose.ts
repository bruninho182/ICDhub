/// <reference path="operacao_review.ts" />
namespace ICDEmail {
  export interface Dados { email: string; assunto: string; corpo: string; modo?: string; contextoVoucher?: { cliente: string; reserva: string; passeio: string; data: string } }
  declare const chrome: { storage: {
    local: { get(chaves: string[]): Promise<{ dadosParaEmail?: Dados }>; remove(chave: string): Promise<void> };
    onChanged: { addListener(fn: (changes: Record<string, unknown>, area: string) => void): void };
  } };
  const pausa = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));
  const destinatario = (cco: boolean): HTMLInputElement | HTMLTextAreaElement | null => document.querySelector(cco
    ? 'textarea[name="_bcc"], input[name="_bcc"], #_bcc, .recipient-input[data-type="bcc"] input'
    : 'input[name="_to"], textarea[name="_to"], #_to, .recipient-input[data-type="to"] input');
  const assunto = (): HTMLInputElement | null => document.querySelector('input[name="_subject"], #compose-subject');
  export function validar(dados: Dados): void {
    if (!dados || typeof dados.email !== 'string' || typeof dados.assunto !== 'string' || typeof dados.corpo !== 'string') throw new Error('Dados de e-mail incompletos.');
    const emails = dados.email.split(/[,;]/).map(e => e.trim()).filter(Boolean);
    if (!emails.length || emails.some(e => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))) throw new Error('Confira os endereços de e-mail.');
    if (!dados.assunto.trim() || !dados.corpo.trim()) throw new Error('Preencha assunto e mensagem antes de continuar.');
  }
  function editor(): HTMLTextAreaElement | HTMLElement | null {
    const iframe = document.querySelector<HTMLIFrameElement>('.cke_wysiwyg_frame, #composebody_ifr');
    if (iframe) { try { return iframe.contentDocument?.body || null; } catch { return null; } }
    const simples = document.getElementById('composebody');
    return simples instanceof HTMLTextAreaElement || simples?.isContentEditable ? simples : null;
  }
  function escrever(campo: HTMLInputElement | HTMLTextAreaElement, valor: string): void {
    campo.value = valor;
    campo.dispatchEvent(new Event('input', { bubbles: true }));
    campo.dispatchEvent(new Event('change', { bubbles: true }));
  }
  export async function aplicar(dados: Dados): Promise<void> {
    validar(dados);
    const cco = dados.modo === 'CCO';
    if (cco && !destinatario(true)) document.querySelector<HTMLElement>('.add-bcc, #compose-add-bcc, [data-event="add-bcc"]')?.click();
    let para = destinatario(cco);
    for (let i = 0; !para && i < 30; i++) { await pausa(100); para = destinatario(cco); }
    const subject = assunto(); const corpo = editor();
    if (!para || !subject || !corpo) throw new Error('Aguarde o editor carregar e tente novamente. Os dados foram preservados.');
    if ((para.value.trim() && para.value.trim() !== dados.email.trim()) || (subject.value.trim() && subject.value !== dados.assunto))
      throw new Error('Este rascunho já contém outro destinatário ou assunto. Abra uma nova mensagem para preencher.');
    escrever(para, dados.email); escrever(subject, dados.assunto);
    if (corpo instanceof HTMLTextAreaElement) {
      if (!corpo.value.startsWith(dados.corpo)) escrever(corpo, `${dados.corpo}\n\n${corpo.value}`);
    } else if (!Array.from(corpo.querySelectorAll('[data-icd-email]')).some(el => el.textContent === dados.corpo)) {
      const bloco = corpo.ownerDocument.createElement('div'); bloco.dataset.icdEmail = 'true';
      bloco.style.whiteSpace = 'pre-wrap'; bloco.textContent = dados.corpo;
      corpo.prepend(bloco, corpo.ownerDocument.createElement('br'));
      corpo.dispatchEvent(new Event('input', { bubbles: true }));
    }
    const mensagemInserida = corpo instanceof HTMLTextAreaElement ? corpo.value.startsWith(dados.corpo)
      : Array.from(corpo.querySelectorAll('[data-icd-email]')).some(el => el.textContent === dados.corpo);
    if (para.value !== dados.email || subject.value !== dados.assunto || !mensagemInserida) throw new Error('O webmail não confirmou o preenchimento. Revise os campos.');
    const atual = await chrome.storage.local.get(['dadosParaEmail']);
    if (JSON.stringify(atual.dadosParaEmail) === JSON.stringify(dados)) await chrome.storage.local.remove('dadosParaEmail');
  }
  let iniciado = false;
  export function iniciar(): void {
    if (iniciado) return; iniciado = true;
    let ocupado = false;
    function montar(): void {
      if (document.getElementById('icd-revisar-email') || !assunto()) return;
      const painel = document.createElement('aside'); painel.id = 'icd-revisar-email';
      painel.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:100000;background:#fff;color:#172033;padding:12px;border:1px solid #b9c5d7;border-radius:10px;max-width:340px;font:14px system-ui;box-shadow:0 4px 20px #0003';
      const botao = document.createElement('button'); botao.type = 'button'; botao.textContent = 'REVISAR E PREENCHER E-MAIL';
      botao.style.cssText = 'font:600 13px system-ui;background:#6036b5;color:#fff;padding:10px 14px;border:0;border-radius:7px;cursor:pointer';
      const status = document.createElement('p'); status.textContent = 'Revise o destinatário e confira o anexo antes de enviar.';
      botao.onclick = async () => {
        if (ocupado) return; ocupado = true; botao.disabled = true;
        try {
          const { dadosParaEmail: dados } = await chrome.storage.local.get(['dadosParaEmail']);
          if (!dados) throw new Error('Nenhum e-mail pendente. Prepare o voucher ou relatório no ICD.');
          validar(dados);
          if (!await ICDOperacao.confirmar({ titulo: 'Conferir e-mail', descricao: 'Após preencher, confira a assinatura e anexe o documento correto no webmail. O envio permanece manual.',
            campos: [...(dados.contextoVoucher ? [['Cliente', dados.contextoVoucher.cliente], ['Reserva', dados.contextoVoucher.reserva], ['Passeio', dados.contextoVoucher.passeio], ['Data da visita', dados.contextoVoucher.data ? dados.contextoVoucher.data.split('-').reverse().join('/') : '']] as [string,string][] : []), [dados.modo === 'CCO' ? 'Destinatários em CCO' : 'Destinatário', dados.email], ['Assunto', dados.assunto], ['Mensagem', dados.corpo]], acao: 'Preencher rascunho' })) return;
          await aplicar(dados); status.textContent = 'Rascunho preenchido. Confira destinatário, assinatura e anexos antes de enviar.';
        } catch (erro) { status.textContent = (erro as Error).message; }
        finally { ocupado = false; botao.disabled = false; }
      };
      painel.append(botao, status); document.body.append(painel);
    }
    let agendado = false;
    new MutationObserver(() => { if (agendado) return; agendado = true; setTimeout(() => { agendado = false; montar(); }, 200); }).observe(document.body, { childList: true, subtree: true });
    montar();
  }
}
if (typeof document !== 'undefined') {
  if (typeof ICDFuncionalidades !== 'undefined') ICDFuncionalidades.quandoAtiva('email', () => ICDEmail.iniciar());
  else ICDEmail.iniciar();
}
