/// <reference path="reserva_date.ts" />
/// <reference path="fornecedor_map.ts" />
namespace ICDOTAPrepare {
  interface Dados {
    origem?: string;
    gyg?: string;
    bookingId?: string;
    fornecedor?: string;
    passeio?: string;
    modalidade?: string;
    dataVisita?: string;
  }
  declare const chrome: { storage: { local: { get(chaves: string[]): Promise<Record<string, Dados>> } } };
  const pausa = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));
  const normalizar = (valor: string): string => ICDReservaDate.limpar(valor).replace(/[’']/g, "'").replace(/\s+/g, ' ');

  async function esperar<T>(buscar: () => T | null | false, mensagem: string): Promise<T> {
    for (let i = 0; i < 40; i++) {
      const resultado = buscar();
      if (resultado) return resultado;
      await pausa(100);
    }
    throw new Error(mensagem);
  }

  function campo(rotulo: string): HTMLInputElement | null {
    const label = Array.from(document.querySelectorAll('label')).find(el => normalizar(el.textContent || '') === normalizar(rotulo));
    const id = label?.getAttribute('for');
    const input = id ? document.getElementById(id) : label?.closest('.MuiFormControl-root')?.querySelector('input');
    return input instanceof HTMLInputElement ? input : null;
  }

  function escrever(input: HTMLInputElement, texto: string): void {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter?.call(input, texto);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  export async function selecionar(rotulo: string, alvo: string): Promise<void> {
    let input = await esperar(() => campo(rotulo), `Campo ${rotulo} não encontrado.`);
    if (input.disabled) throw new Error(`${rotulo} está desabilitado.`);
    if (normalizar(input.value) === normalizar(alvo)) return;
    const anterior = input.value;
    input.focus();
    input.click();
    escrever(input, alvo);
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', code: 'ArrowDown', bubbles: true }));
    try {
      const opcao = await esperar(() => {
        input = campo(rotulo) || input;
        const combo = input.closest('[role="combobox"]');
        const listaId = input.getAttribute('aria-controls') || input.getAttribute('aria-owns') || combo?.getAttribute('aria-owns');
        const lista = listaId ? document.getElementById(listaId) : null;
        // MUI renderiza o menu em um portal; não selecionar opções de outro campo.
        const listas = lista ? [lista] : Array.from(document.querySelectorAll('[role="listbox"]'))
          .filter(el => !el.hasAttribute('hidden') && el.getAttribute('aria-hidden') !== 'true');
        if (listas.length !== 1) return null;
        const opcoes = Array.from(listas[0].querySelectorAll<HTMLElement>('[role="option"]'))
          .filter(el => normalizar(el.textContent || '') === normalizar(alvo) && el.getAttribute('aria-disabled') !== 'true');
        return opcoes.length === 1 ? opcoes[0] : null;
      }, `Opção “${alvo}” não encontrada em ${rotulo}. Confira o nome no ICD.`);
      opcao.click();
      await esperar(() => {
        const atual = campo(rotulo);
        const combo = atual?.closest('[role="combobox"]');
        return atual && normalizar(atual.value) === normalizar(alvo) &&
          combo?.getAttribute('aria-expanded') !== 'true' && atual.getAttribute('aria-expanded') !== 'true';
      }, `Não foi possível confirmar a seleção em ${rotulo}.`);
      input.blur();
      await pausa(150);
    } catch (erro) {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }));
      escrever(input, anterior);
      input.blur();
      throw erro;
    }
  }

  function calendario(): Element | null {
    const titulo = Array.from(document.querySelectorAll('h6')).find(el => /data da visita/i.test(el.textContent || ''));
    return titulo?.closest('.MuiGrid-item')?.querySelector('.MuiPickersStaticWrapper-staticWrapperRoot') || null;
  }

  async function prepararPasseio(fornecedor: string, modalidade: string, titulo: string): Promise<void> {
    if (normalizar(fornecedor) === normalizar('Bondinho Pão de Açúcar')) {
      await esperar(() => campo('Selecione o passeio'), 'Campo Selecione o passeio do Bondinho não encontrado.');
      await selecionar('Selecione o passeio', ICDFornecedorMap.modalidadeBondinho(modalidade));
      return;
    }
    if (normalizar(fornecedor) === normalizar('Tour Maracanã')) {
      const alvo = ICDFornecedorMap.modalidadeMaracana(titulo, modalidade);
      if (alvo) {
        await esperar(() => campo('Selecione o passeio'), 'Campo Selecione o passeio do Maracanã não encontrado.');
        await selecionar('Selecione o passeio', alvo);
        return;
      }
    }
    // A configuração da atração pode chegar depois da seleção do fornecedor.
    const etapa = await esperar(() => {
      const passeio = campo('Selecione o passeio');
      return passeio ? { passeio } : calendario() ? { passeio: null } : null;
    }, 'Aguardando os campos da atração. Tente preparar novamente após o carregamento.');
    if (!etapa.passeio) return;
    if (!etapa.passeio.value.trim()) throw new Error('Este fornecedor exige selecionar o passeio antes da data. Escolha o passeio e clique em PREPARAR RESERVA OTA novamente.');
  }
  const mesExibido = (): number | null => ICDReservaDate.mesCalendario(
    calendario()?.querySelector('.MuiPickersCalendarHeader-switchHeader p')?.textContent || '');

  export async function selecionarData(iso: string): Promise<void> {
    if (!iso || ICDReservaDate.normalizar(iso) !== iso) throw new Error('Data de visita inválida.');
    const [ano, mes, dia] = iso.split('-').map(Number);
    const alvo = ano * 12 + mes - 1;
    await esperar(() => calendario(), 'Calendário da visita não encontrado.');
    const inicial = mesExibido();
    if (inicial === null) throw new Error('Mês do calendário não reconhecido.');
    if (Math.abs(alvo - inicial) > 24) throw new Error('Data distante mais de 24 meses. Selecione manualmente.');
    for (let passos = 0; passos <= 24; passos++) {
      const atual = mesExibido();
      if (atual === null) throw new Error('Mês do calendário não reconhecido.');
      if (atual === alvo) break;
      const setas = calendario()?.querySelectorAll<HTMLButtonElement>('.MuiPickersCalendarHeader-switchHeader button');
      const seta = setas?.[alvo > atual ? 1 : 0];
      if (!seta || seta.disabled) throw new Error('Não foi possível navegar até a data da visita.');
      seta.click();
      await esperar(() => mesExibido() === atual + (alvo > atual ? 1 : -1), 'O calendário não confirmou a troca de mês.');
      await pausa(200); // Aguardar a animação de substituição dos dias.
    }
    if (mesExibido() !== alvo) throw new Error('Mês da visita não confirmado.');
    const botao = await esperar(() => {
      const dias = Array.from(calendario()?.querySelectorAll<HTMLButtonElement>('.MuiPickersDay-day') || [])
        .filter(el => !el.classList.contains('MuiPickersDay-hidden') &&
          !el.closest('[aria-hidden="true"], .MuiPickersSlideTransition-exit, .MuiPickersSlideTransition-exitActive') &&
          el.textContent?.trim() === String(dia));
      const diaAlvo = dias.length === 1 ? dias[0] : null;
      return diaAlvo && !diaAlvo.disabled && !diaAlvo.classList.contains('MuiPickersDay-dayDisabled') &&
        diaAlvo.getAttribute('aria-disabled') !== 'true' ? diaAlvo : null;
    }, 'Dia da visita indisponível ou não encontrado após carregar o calendário.');
    if (botao.disabled || botao.classList.contains('MuiPickersDay-dayDisabled') || botao.getAttribute('aria-disabled') === 'true')
      throw new Error('Dia da visita indisponível. Selecione uma data manualmente.');
    botao.click();
    await esperar(() => mesExibido() === alvo && Array.from(calendario()?.querySelectorAll('.MuiPickersDay-daySelected') || [])
      .some(el => !el.classList.contains('MuiPickersDay-hidden') && el.textContent?.trim() === String(dia)), 'O calendário não confirmou o dia selecionado.');
  }

  export async function preparar(dados: Dados, informar: (mensagem: string) => void): Promise<void> {
    // Piloto GYG: outras plataformas serão habilitadas após validar suas correspondências.
    if (dados.origem !== 'GETYOURGUIDE') throw new Error('Esta preparação está disponível para reservas GetYourGuide.');
    informar('Selecionando canal OTA’s…');
    await selecionar('Canal de venda', "OTA's");
    informar('Selecionando 000 GetYourGuide…');
    await selecionar('Unidade Distribuidora', '000 GetYourGuide');
    // Resolver também aqui para reservas confirmadas antes da atualização do mapa.
    const fornecedor = dados.fornecedor?.trim() || ICDFornecedorMap.resolver(dados.origem, dados.passeio || '');
    if (!fornecedor) throw new Error('Canal e distribuidora preparados. Passeio sem associação cadastrada. Selecione o fornecedor manualmente ou informe seu nome exato na conferência da GetYourGuide.');
    informar('Selecionando fornecedor…');
    await selecionar('Selecione o fornecedor', fornecedor);
    informar('Verificando a modalidade do passeio…');
    await prepararPasseio(fornecedor, dados.modalidade || '', dados.passeio || '');
    if (!dados.dataVisita) throw new Error('Canal, distribuidora e fornecedor preparados. Selecione a data manualmente.');
    informar('Selecionando data da visita…');
    await selecionarData(dados.dataVisita);
    informar('Preparação concluída. Confira os campos; escolha o horário manualmente.');
  }

  export function iniciar(): void {
    if (window.top !== window.self) return;
    let ocupado = false;
    function injetar(): void {
      const ativa = location.hostname === 'app.icdgrupo.com.br' && location.pathname.replace(/\/$/, '') === '/apps/sales/bookings/new';
      const existente = document.getElementById('icd-preparar-ota');
      if (!ativa) { existente?.remove(); return; }
      if (existente || !campo('Canal de venda')) return;
      const painel = document.createElement('aside');
      painel.id = 'icd-preparar-ota';
      painel.style.cssText = 'position:fixed;bottom:65px;right:20px;z-index:10000;max-width:min(380px,90vw);padding:12px;border-radius:10px;background:#fff;color:#172033;box-shadow:0 4px 20px #0004;font:14px system-ui';
      const botao = document.createElement('button');
      botao.type = 'button'; botao.textContent = 'PREPARAR RESERVA OTA';
      botao.style.cssText = 'background:#6036b5;color:white;border:0;padding:10px 16px;border-radius:7px;cursor:pointer;font:600 14px system-ui';
      const status = document.createElement('p');
      status.setAttribute('role', 'status'); status.style.cssText = 'margin:8px 0 0;line-height:1.4';
      status.textContent = 'GetYourGuide · canal, distribuidora, fornecedor e data. Horário manual.';
      botao.onclick = async () => {
        if (ocupado) return;
        ocupado = true; botao.disabled = true;
        try {
          const { dadosPedido } = await chrome.storage.local.get(['dadosPedido']);
          if (!dadosPedido) throw new Error('Confirme uma reserva na GetYourGuide antes de preparar os campos.');
          await preparar(dadosPedido, mensagem => { status.textContent = mensagem; });
        } catch (erro) { status.textContent = erro instanceof Error ? erro.message : 'Não foi possível preparar os campos.'; }
        finally { ocupado = false; botao.disabled = false; }
      };
      painel.append(botao, status);
      document.body.appendChild(painel);
    }
    let agendado = false;
    new MutationObserver(() => {
      if (agendado) return;
      agendado = true;
      setTimeout(() => { agendado = false; injetar(); }, 200);
    }).observe(document.body, { childList: true, subtree: true });
    injetar();
  }
}
if (typeof document !== 'undefined') {
  if (typeof ICDFuncionalidades !== 'undefined') ICDFuncionalidades.quandoAtiva('plataformas', () => ICDOTAPrepare.iniciar());
  else ICDOTAPrepare.iniciar();
}
