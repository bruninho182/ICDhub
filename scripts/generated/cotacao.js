"use strict";
var ICDCotacao;
(function (ICDCotacao) {
    function nomeExibicao(passeio) {
        if (!passeio.contexto || !passeio.importacaoChave)
            return passeio.nome;
        try {
            const chave = JSON.parse(passeio.importacaoChave);
            if (Array.isArray(chave) && typeof chave[0] === 'string')
                return [chave[0], passeio.contexto.modalidade].filter(Boolean).join(' · ');
        }
        catch { /* Cadastro manual ou antigo: manter o nome informado. */ }
        return passeio.nome;
    }
    ICDCotacao.nomeExibicao = nomeExibicao;
    ICDCotacao.busca = (valor) => valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
    ICDCotacao.moeda = (centavos) => (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    function centavos(valor) {
        const texto = typeof valor === 'number' ? String(valor) : typeof valor === 'string' ? valor.trim().replace(',', '.') : '';
        if (!/^\d+(?:\.\d{1,2})?$/.test(texto))
            throw new Error('Use preços positivos com até duas casas decimais.');
        const [inteiro, decimal = ''] = texto.split('.');
        const resultado = Number(inteiro) * 100 + Number(decimal.padEnd(2, '0'));
        if (!Number.isSafeInteger(resultado) || resultado > 100000000)
            throw new Error('Preço fora do limite permitido.');
        return resultado;
    }
    ICDCotacao.centavos = centavos;
    function validarPasseio(nome, ingressos) {
        if (!nome.trim())
            throw new Error('Informe o nome do passeio.');
        if (!ingressos.length)
            throw new Error('Adicione pelo menos uma categoria de ingresso.');
        const nomes = new Set();
        return { nome: nome.trim(), ingressos: ingressos.map(ing => {
                const tipo = ing.tipo.trim();
                if (!tipo)
                    throw new Error('Informe o nome de todas as categorias.');
                if (nomes.has(ICDCotacao.busca(tipo)))
                    throw new Error('Há categorias com o mesmo nome.');
                nomes.add(ICDCotacao.busca(tipo));
                return { tipo, valor: centavos(ing.valor) / 100 };
            }) };
    }
    ICDCotacao.validarPasseio = validarPasseio;
    function quantidade(valor) {
        if (!/^\d+$/.test(valor) || Number(valor) > 999)
            throw new Error('Use quantidades inteiras entre 0 e 999.');
        return Number(valor);
    }
    ICDCotacao.quantidade = quantidade;
    function total(linhas) {
        const resultado = linhas.reduce((soma, linha) => {
            quantidade(String(linha.quantidade));
            if (!Number.isSafeInteger(linha.centavos) || linha.centavos < 0)
                throw new Error('Tarifa inválida.');
            return soma + linha.quantidade * linha.centavos;
        }, 0);
        if (!Number.isSafeInteger(resultado))
            throw new Error('Total fora do limite permitido.');
        return resultado;
    }
    ICDCotacao.total = total;
    function mensagem(linhas) {
        const ativas = linhas.filter(linha => linha.quantidade > 0);
        total(linhas);
        if (!ativas.length)
            throw new Error('Adicione pelo menos um ingresso à cotação.');
        let texto = '*COTAÇÃO DE PASSEIOS*\n';
        const grupos = new Map();
        for (const linha of ativas)
            grupos.set(linha.passeio, [...(grupos.get(linha.passeio) || []), linha]);
        for (const [passeio, itens] of grupos) {
            texto += `\n*${passeio}*\n`;
            for (const item of itens)
                texto += `▪ ${item.quantidade}x ${item.tipo}: ${ICDCotacao.moeda(item.centavos * item.quantidade)}\n`;
        }
        return texto + `\n*TOTAL: ${ICDCotacao.moeda(total(ativas))}*`;
    }
    ICDCotacao.mensagem = mensagem;
})(ICDCotacao || (ICDCotacao = {}));
