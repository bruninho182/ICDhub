/// <reference path="reserva_review.ts" />
/// <reference path="reserva_date.ts" />
/// <reference path="fornecedor_map.ts" />
namespace ICDGetYourGuide {
  export interface Reserva {
    versao: 1;
    origem: 'GETYOURGUIDE';
    gyg: string;
    nome: string;
    email: string;
    telefone: string;
    passeio: string;
    modalidade: string;
    fornecedor: string;
    dataVisita: string;
  }
  declare const chrome: {
    storage: { local: { set(dados: { dadosPedido: Reserva }): Promise<void> } };
  };
  const texto = (valor: unknown): string => typeof valor === 'string' ? valor.trim() : '';

  export function normalizar(dados: Record<string, unknown>): Reserva {
    return { versao: 1, origem: 'GETYOURGUIDE', gyg: texto(dados.gyg).toUpperCase(),
      nome: texto(dados.nome).replace(/\s+/g, ' '), email: texto(dados.email),
      telefone: texto(dados.telefone), passeio: texto(dados.passeio), modalidade: texto(dados.modalidade),
      fornecedor: texto(dados.fornecedor) || ICDFornecedorMap.resolver('GETYOURGUIDE', texto(dados.passeio)),
      dataVisita: texto(dados.dataVisita) };
  }

  export function validar(reserva: Reserva): string[] {
    const erros: string[] = [];
    if (!/^GYG[A-Z0-9]+$/.test(reserva.gyg)) erros.push('Informe um código de reserva iniciado por GYG.');
    if (reserva.nome.length < 2) erros.push('Informe o nome completo do cliente.');
    // E-mail e telefone podem não estar disponíveis no portal. Não inventar substitutos.
    if (reserva.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(reserva.email)) erros.push('Corrija o e-mail ou deixe o campo vazio se indisponível.');
    if (reserva.telefone && !/^\+?[\d\s().-]{7,}$/.test(reserva.telefone)) erros.push('Corrija o telefone ou deixe o campo vazio se indisponível.');
    if (reserva.dataVisita && ICDReservaDate.normalizar(reserva.dataVisita) !== reserva.dataVisita)
      erros.push('Informe uma data de visita válida ou deixe vazia para selecionar no ICD.');
    return erros;
  }

  export interface Captura { reserva: Reserva; avisos: string[] }

  export function extrair(pagina: Document): Captura {
    // Excluir a interface ICD da captura e preservar quebras de linha renderizadas.
    const corpo = pagina.body;
    const textoPagina = corpo.innerText || corpo.textContent || '';
    const codigos = [...new Set(textoPagina.match(/\bGYG[A-Z0-9]+\b/gi)?.map(c => c.toUpperCase()) || [])];
    const avisos: string[] = [];
    if (codigos.length > 1) avisos.push('Há mais de uma reserva na página. Informe o código correto para continuar.');
    if (!codigos.length) avisos.push('Código da reserva não encontrado. Confira se abriu os detalhes da reserva.');

    // Usar somente rótulos reconhecidos; evitar adivinhar nomes no texto da página.
    const nome = pagina.querySelector('[data-testid="lead-traveler-name"]')?.textContent?.trim() || textoPagina.match(/(?:Lead traveler|Viajante principal|Dados do Cliente\s*\n?\s*Nome)\s*:?\s*([^\n\r]+)/i)?.[1]
      ?.replace(/\s*\([^)]*\)\s*$/, '').trim() || '';
    if (!nome) avisos.push('Nome não identificado por um rótulo conhecido. Preencha na conferência.');

    const emails = [...new Set(textoPagina.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [])];
    const relay = emails.filter(email => /^customer-/i.test(email));
    // Priorizar o endereço intermediário GYG já usado no fluxo legado.
    const candidatos = relay.length ? relay : emails;
    const email = (pagina.querySelector('[data-testid="lead-traveler-email"]')?.getAttribute('href') || '').replace(/^mailto:/i, '').split('?')[0] || (candidatos.length === 1 ? candidatos[0] : '');
    if (!email) avisos.push('E-mail ausente ou ambíguo; confira no portal. Pode ficar vazio.');
    const telefones = [...new Set(Array.from(pagina.querySelectorAll<HTMLAnchorElement>('a[href^="tel:"]'))
      .map(a => (a.getAttribute('href') || '').slice(4).trim()).filter(Boolean))];
    const telefone = (pagina.querySelector('[data-testid="lead-traveler-phone"]')?.getAttribute('href') || '').replace(/^tel:/i, '') || (telefones.length === 1 ? telefones[0] : '');
    if (!telefone) avisos.push('Telefone ausente ou ambíguo; confira no portal. Pode ficar vazio.');
    const datas = Array.from(pagina.querySelectorAll('[data-testid="conduction-time"]'));
    const datasLidas = [...new Set(datas.map(el => {
      const time = el.matches('time') ? el : el.querySelector('time[datetime]');
      return ICDReservaDate.extrair(time?.getAttribute('datetime') || el.textContent || '');
    }).filter(Boolean))];
    const dataElemento = datas[0];
    let blocoProduto = dataElemento?.parentElement || null;
    for (let nivel = 0; blocoProduto && nivel < 5 && !blocoProduto.querySelector('h2'); nivel++) {
      blocoProduto = blocoProduto.parentElement;
    }
    const titulos = blocoProduto?.querySelectorAll('h2');
    const titulo = titulos?.length === 1 ? titulos[0] : null;
    const passeio = titulo?.textContent?.trim() || '';
    const modalidade = titulo?.parentElement?.querySelector('p')?.textContent?.trim() || '';
    // Duplicação desktop/mobile é comum; aceitar somente se as datas concordam.
    const dataVisita = datasLidas.length === 1 ? datasLidas[0] : '';
    if (!passeio) avisos.push('Passeio não identificado. Confira e informe se necessário.');
    if (!dataVisita) avisos.push('Data da visita ausente, ambígua ou não reconhecida. Selecione na conferência ou no ICD.');
    const fornecedor = ICDFornecedorMap.resolver('GETYOURGUIDE', passeio);
    avisos.push(fornecedor
      ? `Canal: OTA’s. Distribuidora: 000 GetYourGuide. Fornecedor associado: ${fornecedor}. Confira antes de confirmar.`
      : 'Canal: OTA’s. Distribuidora: 000 GetYourGuide. Passeio sem associação cadastrada; informe o nome exato do fornecedor no ICD.');
    return { reserva: normalizar({ gyg: codigos.length === 1 ? codigos[0] : '', nome, email, telefone,
      passeio, modalidade, dataVisita }), avisos };
  }

  export async function conferir(captura: Captura): Promise<Reserva | null> {
    // O diálogo informa os campos que não estão incluídos na captura.
    // Avisos específicos são apresentados dentro da mesma conferência.
    return ICDReservaReview.conferir({ gyg: captura.reserva.gyg, nome: captura.reserva.nome,
      email: captura.reserva.email, telefone: captura.reserva.telefone,
      passeio: captura.reserva.passeio, modalidade: captura.reserva.modalidade,
      fornecedor: captura.reserva.fornecedor, dataVisita: captura.reserva.dataVisita }, {
      titulo: 'Conferir reserva GetYourGuide',
      campos: [
        { chave: 'gyg', rotulo: 'Código da reserva' },
        { chave: 'nome', rotulo: 'Nome completo do cliente' },
        { chave: 'email', rotulo: 'E-mail (opcional)', tipo: 'email' },
        { chave: 'telefone', rotulo: 'Telefone (opcional)', tipo: 'tel' },
        { chave: 'passeio', rotulo: 'Passeio na GetYourGuide' },
        { chave: 'modalidade', rotulo: 'Modalidade do passeio' },
        { chave: 'fornecedor', rotulo: 'Fornecedor no ICD (nome exato; opcional)' },
        { chave: 'dataVisita', rotulo: 'Data da visita (opcional)', tipo: 'date' },
      ],
      normalizar: dados => {
        const r = normalizar(dados);
        return { gyg: r.gyg, nome: r.nome, email: r.email, telefone: r.telefone,
          passeio: r.passeio, modalidade: r.modalidade, fornecedor: r.fornecedor, dataVisita: r.dataVisita };
      },
      validar: dados => validar(normalizar(dados)),
      confirmar: async dados => { await chrome.storage.local.set({ dadosPedido: normalizar(dados) }); },
      avisos: captura.avisos,
      descricao: 'No ICD, use PREPARAR RESERVA OTA para selecionar canal, distribuidora, fornecedor e data. Horário e valores permanecem manuais. Sem fornecedor definido, a preparação para após a distribuidora.',
    }).then(dados => dados ? normalizar(dados) : null);
  }

  export function iniciar(): void {
    let ocupado = false;
    function injetar(): void {
      if (document.getElementById('btn-copy-gyg')) return;
      const botao = document.createElement('button');
      botao.id = 'btn-copy-gyg'; botao.type = 'button';
      botao.textContent = 'CONFERIR RESERVA';
      botao.style.cssText = 'position:fixed;top:100px;right:20px;z-index:9999;padding:12px 20px;background:#c94600;color:white;border:0;border-radius:8px;cursor:pointer;font:600 14px system-ui;box-shadow:0 4px 15px #0004';
      botao.onclick = async () => {
        if (ocupado) return;
        ocupado = true; botao.disabled = true;
        try {
          const reserva = await conferir(extrair(document));
          botao.textContent = reserva ? '✓ Dados disponíveis no ICD' : 'CONFERIR RESERVA';
        } catch (erro) {
          botao.textContent = 'Tentar conferir novamente';
          console.warn('[ICD Hub] Não foi possível conferir a reserva:', erro instanceof Error ? erro.message : 'Falha inesperada');
        } finally { ocupado = false; botao.disabled = false; }
      };
      document.body.appendChild(botao);
    }
    let agendado = false;
    const observer = new MutationObserver(() => {
      if (agendado || document.getElementById('btn-copy-gyg')) return;
      agendado = true;
      setTimeout(() => { agendado = false; injetar(); }, 200);
    });
    injetar();
    observer.observe(document.body, { subtree: true, childList: true });
  }
}
if (typeof document !== 'undefined') {
  if (typeof ICDFuncionalidades !== 'undefined') ICDFuncionalidades.quandoAtiva('plataformas', () => ICDGetYourGuide.iniciar());
  else ICDGetYourGuide.iniciar();
}
