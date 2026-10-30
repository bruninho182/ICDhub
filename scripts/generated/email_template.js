"use strict";
var ICDEmailTemplate;
(function (ICDEmailTemplate) {
    ICDEmailTemplate.campos = { operador: 'Operador', passeio: 'Passeio', data_visita: 'Data da visita', horario: 'Horário' };
    function preencher(texto, valores) {
        return texto.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (_, chave) => {
            if (!Object.prototype.hasOwnProperty.call(ICDEmailTemplate.campos, chave))
                throw new Error(`Campo desconhecido no modelo: {{${chave}}}.`);
            const valor = valores[chave]?.trim();
            if (!valor)
                throw new Error(`Preencha ${ICDEmailTemplate.campos[chave]} para preparar a mensagem.`);
            return valor;
        });
    }
    ICDEmailTemplate.preencher = preencher;
    function destinatarios(lista) {
        const unicos = [...new Set(lista.map(email => email.trim().toLowerCase()).filter(Boolean))];
        if (!unicos.length)
            throw new Error('Selecione pelo menos um destinatário.');
        if (unicos.some(email => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))
            throw new Error('Há um endereço de e-mail inválido na seleção.');
        return unicos;
    }
    ICDEmailTemplate.destinatarios = destinatarios;
})(ICDEmailTemplate || (ICDEmailTemplate = {}));
