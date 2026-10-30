namespace ICDEmailTemplate {
  export const campos = { operador: 'Operador', passeio: 'Passeio', data_visita: 'Data da visita', horario: 'Horário' };
  export function preencher(texto: string, valores: Record<string, string>): string {
    return texto.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (_, chave: string) => {
      if (!Object.prototype.hasOwnProperty.call(campos, chave)) throw new Error(`Campo desconhecido no modelo: {{${chave}}}.`);
      const valor = valores[chave]?.trim();
      if (!valor) throw new Error(`Preencha ${campos[chave as keyof typeof campos]} para preparar a mensagem.`);
      return valor;
    });
  }
  export function destinatarios(lista: string[]): string[] {
    const unicos = [...new Set(lista.map(email => email.trim().toLowerCase()).filter(Boolean))];
    if (!unicos.length) throw new Error('Selecione pelo menos um destinatário.');
    if (unicos.some(email => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) throw new Error('Há um endereço de e-mail inválido na seleção.');
    return unicos;
  }
}
