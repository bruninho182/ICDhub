"use strict";
var ICDFornecedorMap;
(function (ICDFornecedorMap) {
    // Associações por título completo observado; evitar confundir combos ou atrações distintas.
    // Origem: gravação fornecida pelo responsável da operação em 30/10/2026.
    const getyourguide = {
        'christ the redeemer entry ticket by corcovado train': 'Trem do Corcovado',
        'rio de janeiro: sugarloaf cable car': 'Bondinho Pão de Açúcar',
        'rio de janeiro aquarium: aquario entrance ticket': 'AquaRio Porto Maravilha',
        'rio de janeiro: maracana stadium entrance ticket': 'Tour Maracanã',
        'monitored tour | rio de janeiro: maracana stadium entrance ticket': 'Tour Maracanã',
    };
    function resolver(origem, passeio) {
        if (origem !== 'GETYOURGUIDE')
            return '';
        const chave = passeio.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/\s+/g, ' ').trim().toLowerCase();
        return Object.hasOwnProperty.call(getyourguide, chave) ? getyourguide[chave] : '';
    }
    ICDFornecedorMap.resolver = resolver;
    function modalidadeBondinho(modalidade) {
        const chave = modalidade.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[–—]/g, '-').replace(/\s+/g, ' ').trim().toLowerCase();
        return chave === 'skip the line ticket | skip-the-line cable car ticket'
            ? 'Acesso rápido e amanhecer' : 'Bilhete Normal';
    }
    ICDFornecedorMap.modalidadeBondinho = modalidadeBondinho;
    function modalidadeMaracana(passeio, modalidade) {
        const normalizar = (texto) => texto.normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
        const titulo = 'rio de janeiro: maracana stadium entrance ticket';
        const guiado = `monitored tour | ${titulo}`;
        if (normalizar(modalidade) === guiado || normalizar(passeio) === guiado)
            return 'Tour Guiado';
        return normalizar(passeio) === titulo || normalizar(modalidade) === titulo ? 'Tour Regular' : '';
    }
    ICDFornecedorMap.modalidadeMaracana = modalidadeMaracana;
})(ICDFornecedorMap || (ICDFornecedorMap = {}));
