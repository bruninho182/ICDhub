namespace ICDFornecedorMap {
  // Associações por título completo observado; evitar confundir combos ou atrações distintas.
  // Origem: gravação fornecida pelo responsável da operação em 30/10/2026.
  const getyourguide: Record<string, string> = {
    'christ the redeemer entry ticket by corcovado train': 'Trem do Corcovado',
    'rio de janeiro: sugarloaf cable car': 'Bondinho Pão de Açúcar',
    'rio de janeiro aquarium: aquario entrance ticket': 'AquaRio Porto Maravilha',
    'rio de janeiro: maracana stadium entrance ticket': 'Tour Maracanã',
    'monitored tour | rio de janeiro: maracana stadium entrance ticket': 'Tour Maracanã',
  };

  export function resolver(origem: string, passeio: string): string {
    if (origem !== 'GETYOURGUIDE') return '';
    const chave = passeio.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ').trim().toLowerCase();
    return Object.hasOwnProperty.call(getyourguide, chave) ? getyourguide[chave] : '';
  }

  export function modalidadeBondinho(modalidade: string): string {
    const chave = modalidade.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[–—]/g, '-').replace(/\s+/g, ' ').trim().toLowerCase();
    return chave === 'skip the line ticket | skip-the-line cable car ticket'
      ? 'Acesso Rápido' : 'Bilhete Normal';
  }

  export function modalidadeMaracana(passeio: string, modalidade: string): string {
    const normalizar = (texto: string): string => texto.normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
    const titulo = 'rio de janeiro: maracana stadium entrance ticket';
    const guiado = `monitored tour | ${titulo}`;
    // Regra operacional: todas as reservas deste produto usam Tour Regular no ICD.
    return [passeio, modalidade].some(texto => [titulo, guiado].includes(normalizar(texto))) ? 'Tour Regular' : '';
  }
}
