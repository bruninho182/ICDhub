namespace ICDCotacao {
  export interface Ingresso { tipo: string; valor: number | string }
  export interface ContextoTarifario {
    origem: 'ICD'; canal: string; distribuidora: string; fornecedor: string;
    modalidade: string; dataVisita: string; horario: string; consultadoEm: string;
    editadoManualmenteEm?: string;
  }
  export interface Passeio { nome: string; ingressos: Ingresso[]; contexto?: ContextoTarifario; importacaoChave?: string }
  export function nomeExibicao(passeio: Passeio): string {
    if (!passeio.contexto || !passeio.importacaoChave) return passeio.nome;
    try {
      const chave: unknown = JSON.parse(passeio.importacaoChave);
      if (Array.isArray(chave) && typeof chave[0] === 'string')
        return [chave[0], passeio.contexto.modalidade].filter(Boolean).join(' · ');
    } catch { /* Cadastro manual ou antigo: manter o nome informado. */ }
    return passeio.nome;
  }
  export interface Linha { passeio: string; tipo: string; centavos: number; quantidade: number }
  export const busca = (valor: string): string => valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
  export const moeda = (centavos: number): string => (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  export function centavos(valor: unknown): number {
    const texto = typeof valor === 'number' ? String(valor) : typeof valor === 'string' ? valor.trim().replace(',', '.') : '';
    if (!/^\d+(?:\.\d{1,2})?$/.test(texto)) throw new Error('Use preços positivos com até duas casas decimais.');
    const [inteiro, decimal = ''] = texto.split('.');
    const resultado = Number(inteiro) * 100 + Number(decimal.padEnd(2, '0'));
    if (!Number.isSafeInteger(resultado) || resultado > 100000000) throw new Error('Preço fora do limite permitido.');
    return resultado;
  }

  export function validarPasseio(nome: string, ingressos: Ingresso[]): Passeio {
    if (!nome.trim()) throw new Error('Informe o nome do passeio.');
    if (!ingressos.length) throw new Error('Adicione pelo menos uma categoria de ingresso.');
    const nomes = new Set<string>();
    return { nome: nome.trim(), ingressos: ingressos.map(ing => {
      const tipo = ing.tipo.trim();
      if (!tipo) throw new Error('Informe o nome de todas as categorias.');
      if (nomes.has(busca(tipo))) throw new Error('Há categorias com o mesmo nome.');
      nomes.add(busca(tipo));
      return { tipo, valor: centavos(ing.valor) / 100 };
    }) };
  }

  export function quantidade(valor: string): number {
    if (!/^\d+$/.test(valor) || Number(valor) > 999) throw new Error('Use quantidades inteiras entre 0 e 999.');
    return Number(valor);
  }

  export function total(linhas: Linha[]): number {
    const resultado = linhas.reduce((soma, linha) => {
      quantidade(String(linha.quantidade));
      if (!Number.isSafeInteger(linha.centavos) || linha.centavos < 0) throw new Error('Tarifa inválida.');
      return soma + linha.quantidade * linha.centavos;
    }, 0);
    if (!Number.isSafeInteger(resultado)) throw new Error('Total fora do limite permitido.');
    return resultado;
  }

  export function mensagem(linhas: Linha[]): string {
    const ativas = linhas.filter(linha => linha.quantidade > 0);
    total(linhas);
    if (!ativas.length) throw new Error('Adicione pelo menos um ingresso à cotação.');
    let texto = '*COTAÇÃO DE PASSEIOS*\n';
    const grupos = new Map<string, Linha[]>();
    for (const linha of ativas) grupos.set(linha.passeio, [...(grupos.get(linha.passeio) || []), linha]);
    for (const [passeio, itens] of grupos) {
      texto += `\n*${passeio}*\n`;
      for (const item of itens) texto += `▪ ${item.quantidade}x ${item.tipo}: ${moeda(item.centavos * item.quantidade)}\n`;
    }
    return texto + `\n*TOTAL: ${moeda(total(ativas))}*`;
  }
}
