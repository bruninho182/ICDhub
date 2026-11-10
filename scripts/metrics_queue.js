// Fila de métricas com campos permitidos: nunca persiste conteúdo ou identificadores de clientes.
function criarFilaMetricas({ storage, enviar }) {
  let operacao = Promise.resolve();
  let envioAtual = null;
  const chave = 'metricsQueue';
  const exclusivo = tarefa => { const resultado = operacao.then(tarefa); operacao = resultado.catch(() => {}); return resultado; };
  function normalizar(evento) {
    if (!evento || !['whatsapp', 'email', 'voucher'].includes(evento.tipo) || typeof evento.operador !== 'string' || !Number.isFinite(Date.parse(evento.timestamp))) throw new Error('Métrica inválida');
    const original = evento.detalhes || {};
    const detalhes = { evento_id: /^[a-f\d-]{36}$/i.test(original.evento_id || '') ? original.evento_id : crypto.randomUUID() };
    if (['click', 'enter'].includes(original.metodo)) detalhes.metodo = original.metodo;
    if (Number.isSafeInteger(original.tamanho) && original.tamanho >= 0 && original.tamanho <= 1000000) detalhes.tamanho = original.tamanho;
    return { operador: evento.operador, operador_id: evento.operador.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, ''), tipo: evento.tipo, timestamp: evento.timestamp, detalhes };
  }
  async function habilitada() { const dados = await storage.get(['icdFuncionalidades']); return dados.icdFuncionalidades?.metricas === true; }
  async function ler() {
    const dados = await storage.get([chave]);
    return (Array.isArray(dados[chave]) ? dados[chave] : []).flatMap(evento => { try { return [normalizar(evento)]; } catch { return []; } });
  }
  function registrar(evento) {
    return exclusivo(async () => {
      const normalizado = normalizar(evento);
      if (!await habilitada()) return null;
      const fila = await ler(); fila.push(normalizado);
      await storage.set({ [chave]: fila }); return normalizado;
    });
  }
  function enviarTodos() {
    if (envioAtual) return envioAtual;
    envioAtual = exclusivo(async () => {
      // Sanear também a fila de versões anteriores, inclusive se o envio estiver desligado ou falhar.
      const fila = await ler(); await storage.set({ [chave]: fila });
      // Limita o trabalho de cada execução e confirma cada lote separadamente.
      let pendentes = fila;
      for (let numero = 0; numero < 3 && pendentes.length; numero++) {
        if (!await habilitada()) return;
        const lote = pendentes.slice(0, 100);
        await enviar(lote);
        pendentes = pendentes.slice(lote.length);
        await storage.set({ [chave]: pendentes, metricsLastConfirmedAt: new Date().toISOString() });
      }
    }).finally(() => { envioAtual = null; });
    return envioAtual;
  }
  return { registrar, enviarTodos };
}
if (typeof module !== 'undefined') module.exports = { criarFilaMetricas };
