"use strict";
var ICDReservaDate;
(function (ICDReservaDate) {
    const meses = {
        jan: 1, january: 1, janeiro: 1, feb: 2, february: 2, fevereiro: 2,
        mar: 3, march: 3, marco: 3, apr: 4, april: 4, abril: 4,
        may: 5, maio: 5, jun: 6, june: 6, junho: 6, jul: 7, july: 7, julho: 7,
        aug: 8, august: 8, agosto: 8, sep: 9, sept: 9, september: 9, setembro: 9,
        oct: 10, october: 10, outubro: 10, nov: 11, november: 11, novembro: 11,
        dec: 12, december: 12, dezembro: 12,
    };
    ICDReservaDate.limpar = (texto) => texto.normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
    function iso(ano, mes, dia) {
        const data = new Date(Date.UTC(ano, mes - 1, dia));
        if (ano < 2000 || ano > 2100 || data.getUTCFullYear() !== ano ||
            data.getUTCMonth() !== mes - 1 || data.getUTCDate() !== dia)
            return '';
        return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
    }
    ICDReservaDate.iso = iso;
    function normalizar(texto) {
        const valor = ICDReservaDate.limpar(texto).split('(')[0].trim();
        let partes = valor.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (partes)
            return iso(+partes[1], +partes[2], +partes[3]);
        partes = valor.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (partes)
            return iso(+partes[3], +partes[2], +partes[1]);
        partes = valor.match(/^([a-z]+)\.?\s+(\d{1,2}),?\s+(\d{4})$/);
        if (partes && meses[partes[1]])
            return iso(+partes[3], meses[partes[1]], +partes[2]);
        partes = valor.match(/^(\d{1,2})\s+(?:de\s+)?([a-z]+)\.?\s+(?:de\s+)?(\d{4})$/);
        return partes && meses[partes[2]] ? iso(+partes[3], meses[partes[2]], +partes[1]) : '';
    }
    ICDReservaDate.normalizar = normalizar;
    function mesCalendario(texto) {
        const partes = ICDReservaDate.limpar(texto).match(/^([a-z]+)\s+(\d{4})$/);
        return partes && meses[partes[1]] ? +partes[2] * 12 + meses[partes[1]] - 1 : null;
    }
    ICDReservaDate.mesCalendario = mesCalendario;
    // Texto do campo de atividade pode incluir dia da semana e horário.
    // Extrair somente a data local, sem converter para o fuso do computador.
    function extrair(texto) {
        const valor = ICDReservaDate.limpar(texto).replace(/\u00a0/g, ' ').replace(/\s+/g, ' ')
            .replace(/^(?:mon(?:day)?|tue(?:sday)?|wed(?:nesday)?|thu(?:rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?|segunda(?:-feira)?|terca(?:-feira)?|quarta(?:-feira)?|quinta(?:-feira)?|sexta(?:-feira)?|sabado|domingo),?\s+/, '')
            .replace(/^(?:activity date|date of activity|data da atividade|data da visita)\s*:\s*/, '');
        const padroes = [
            /^(\d{4}-\d{2}-\d{2})/,
            /^(\d{1,2}\/\d{1,2}\/\d{4})/,
            /^([a-z]+\.?\s+\d{1,2},?\s+\d{4})/,
            /^(\d{1,2}\s+(?:de\s+)?[a-z]+\.?\s+(?:de\s+)?\d{4})/,
        ];
        for (const padrao of padroes) {
            const match = valor.match(padrao);
            if (!match)
                continue;
            const resto = valor.slice(match[0].length).trim();
            // Não escolher o início de um intervalo ou outra data por engano.
            if (resto && !/^(?:\(|t\d{2}:|(?:[,·•]|at|as|a las)?\s*\d{1,2}:\d{2}\b)/.test(resto))
                return '';
            return normalizar(match[1]);
        }
        return '';
    }
    ICDReservaDate.extrair = extrair;
})(ICDReservaDate || (ICDReservaDate = {}));
