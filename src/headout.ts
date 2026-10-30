// Fonte do piloto. Gerar scripts/generated/headout.js com npm run build.
namespace ICDHeadout {
  export interface Reserva {
    versao: 1;
    origem: 'HEADOUT';
    bookingId: string;
    nome: string;
    email: string;
  }

  const texto = (valor: unknown): string => typeof valor === 'string' ? valor.trim() : '';

  export function normalizar(dados: Record<string, unknown>): Reserva {
    return { versao: 1, origem: 'HEADOUT', bookingId: texto(dados.bookingId),
      nome: texto(dados.nome).replace(/\s+/g, ' ').toUpperCase(), email: texto(dados.email) };
  }

  export function validar(reserva: Reserva): string[] {
    const erros: string[] = [];
    if (!reserva.bookingId) erros.push('Informe o código da reserva.');
    if (reserva.nome.length < 2) erros.push('Informe o nome do cliente.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(reserva.email)) erros.push('Informe um e-mail válido.');
    return erros;
  }

  interface StorageExtensao {
    local: { set(dados: { bridgeData: Reserva }): Promise<void> };
  }
  declare const chrome: { storage: StorageExtensao };
  const pausa = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

  export async function extrair(linha: HTMLTableRowElement): Promise<Reserva> {
    const tabela = linha.closest('table');
    if (!tabela) throw new Error('Tabela de reservas não encontrada.');
    const cabecalhos = Array.from(tabela.querySelectorAll('thead th'));
    const headers = (cabecalhos.length ? cabecalhos : Array.from(tabela.querySelectorAll('th')))
      .map(th => (th.textContent || '').trim().toUpperCase());
    const indices = ['BOOKING ID', 'GUEST NAME', 'ADDITIONAL DETAILS'].map(nome => headers.indexOf(nome));
    if (indices.some(indice => indice < 0)) throw new Error('As colunas do Headout mudaram. Não foi possível identificar a reserva.');
    const [id, nome, detalhes] = indices;
    const celula = linha.cells[detalhes];
    const acharEmail = (): string => (celula?.innerText || '').match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)?.[0] || '';
    let email = acharEmail();
    if (!email && celula) {
      const abrir = Array.from(celula.querySelectorAll<HTMLElement>('a, button, span'))
        .find(el => /\bview\b/i.test(el.innerText));
      abrir?.click();
      for (let i = 0; abrir && i < 10 && !email; i++) { await pausa(500); email = acharEmail(); }
    }
    // O botão injetado fica na primeira célula: removê-lo da cópia evita contaminar o ID.
    const lerCelula = (indice: number): string => {
      const copia = linha.cells[indice]?.cloneNode(true) as HTMLElement | undefined;
      copia?.querySelectorAll('.btn-bridge-hub').forEach(el => el.remove());
      return copia?.textContent || '';
    };
    return normalizar({ bookingId: lerCelula(id), nome: lerCelula(nome), email });
  }

  export function conferir(reserva: Reserva): Promise<Reserva | null> {
    return new Promise(resolve => {
      const host = document.createElement('div');
      host.style.cssText = 'position:fixed;inset:0;z-index:2147483647';
      const raiz = host.attachShadow({ mode: 'closed' });
      raiz.innerHTML = `<style>
        :host{font:15px system-ui;color:#172033} *{box-sizing:border-box}
        dialog{width:min(480px,calc(100vw - 32px));max-height:90vh;overflow:auto;border:0;border-radius:16px;padding:28px;color:#172033;box-shadow:0 20px 80px #0004}
        dialog::backdrop{background:#14213d88} h2{margin:0 0 8px;font-size:22px}
        p{line-height:1.5;color:#526077} label{display:block;font-weight:600;margin-top:16px}
        input{display:block;width:100%;margin-top:6px;padding:11px;border:1px solid #a8b3c4;border-radius:7px;font:inherit}
        input:focus-visible,button:focus-visible{outline:3px solid #a78bfa;outline-offset:2px}
        .acoes{display:flex;gap:10px;justify-content:flex-end;margin-top:24px}
        button{padding:11px 16px;border:1px solid #cbd5e1;border-radius:8px;background:white;font:inherit;cursor:pointer}
        button[type=submit]{background:#6036b5;color:white;border-color:#6036b5}
        #erros{color:#a51c30;white-space:pre-line}
      </style><dialog aria-labelledby="titulo"><form>
        <h2 id="titulo">Conferir reserva Headout</h2>
        <p>Revise os dados antes de disponibilizá-los para preenchimento no ICD.</p>
        <label>Código da reserva<input name="bookingId" required autocomplete="off"></label>
        <label>Nome do cliente<input name="nome" required minlength="2" autocomplete="off"></label>
        <label>E-mail<input name="email" type="email" required autocomplete="off"></label>
        <p>Produto, data e valores não são capturados neste fluxo. Confira essas informações no sistema de origem.</p>
        <p id="erros" role="alert"></p>
        <div class="acoes"><button type="button">Cancelar</button><button type="submit">Confirmar dados</button></div>
      </form></dialog>`;
      const dialog = raiz.querySelector('dialog')!;
      const form = raiz.querySelector('form')!;
      const campos = ['bookingId', 'nome', 'email'] as const;
      const entrada = (nome: string): HTMLInputElement => form.elements.namedItem(nome) as HTMLInputElement;
      campos.forEach(campo => { entrada(campo).value = reserva[campo]; });
      const encerrar = (valor: Reserva | null): void => { dialog.close(); host.remove(); resolve(valor); };
      dialog.addEventListener('cancel', e => { e.preventDefault(); encerrar(null); });
      form.querySelector('button[type=button]')!.addEventListener('click', () => encerrar(null));
      form.addEventListener('submit', e => {
        e.preventDefault();
        const revisada = normalizar(Object.fromEntries(campos.map(campo => [campo, entrada(campo).value])));
        const erros = validar(revisada);
        raiz.querySelector('#erros')!.textContent = erros.join('\n');
        if (!erros.length) encerrar(revisada);
      });
      document.body.appendChild(host);
      dialog.showModal();
    });
  }

  export function iniciar(): void {
    let ocupado = false;
    function injetar(): void {
      document.querySelectorAll<HTMLTableRowElement>('table tr').forEach(linha => {
        if (!linha.querySelector('td') || linha.querySelector('.btn-bridge-hub')) return;
        const botao = document.createElement('button');
        botao.type = 'button';
        botao.className = 'btn-bridge-hub';
        botao.textContent = 'CONFERIR';
        botao.style.cssText = 'background:#6036b5;color:white;border:0;padding:6px 10px;border-radius:6px;cursor:pointer;margin-right:10px';
        botao.onclick = async e => {
          e.preventDefault(); e.stopPropagation();
          if (ocupado) return;
          ocupado = true; botao.disabled = true; botao.textContent = 'Lendo…';
          try {
            const reserva = await conferir(await extrair(linha));
            if (reserva) {
              await chrome.storage.local.set({ bridgeData: reserva });
              botao.textContent = '✓ Confirmado';
            }
          } catch (erro) {
            alert(erro instanceof Error ? erro.message : 'Não foi possível capturar a reserva.');
          } finally {
            ocupado = false; botao.disabled = false;
            setTimeout(() => { botao.textContent = 'CONFERIR'; }, 2000);
          }
        };
        linha.cells[0]?.prepend(botao);
      });
    }
    let agendado = false;
    const observador = new MutationObserver(() => {
      if (agendado) return;
      agendado = true;
      setTimeout(() => { agendado = false; injetar(); }, 200);
    });
    injetar();
    observador.observe(document.body, { childList: true, subtree: true });
  }
}

if (typeof document !== 'undefined') ICDHeadout.iniciar();
