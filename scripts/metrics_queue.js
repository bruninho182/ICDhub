// Compartilhado entre o service worker e os testes, sem dependências externas.
function criarFilaMetricas({ storage, enviar }) {
  let operacao = Promise.resolve();
  let envioAtual = null;
  const chave = 'metricsQueue';

  function exclusivo(tarefa) {
    const resultado = operacao.then(tarefa);
    operacao = resultado.catch(() => {});
    return resultado;
  }

  async function ler() {
    const dados = await storage.get([chave]);
    return dados[chave] || [];
  }

  function registrar(evento) {
    return exclusivo(async () => {
      if (!evento || typeof evento.tipo !== 'string' || !evento.tipo.trim() ||
          typeof evento.operador !== 'string' || !Number.isFinite(Date.parse(evento.timestamp))) {
        throw new Error('Métrica inválida');
      }
      const detalhes = evento.detalhes && typeof evento.detalhes === 'object' && !Array.isArray(evento.detalhes)
        ? evento.detalhes : {};
      const normalizado = {
        operador: evento.operador,
        operador_id: evento.operador.toLowerCase().normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '_')
          .replace(/_+/g, '_').replace(/^_|_$/g, ''),
        tipo: evento.tipo,
        timestamp: evento.timestamp,
        detalhes: { ...detalhes, evento_id: crypto.randomUUID() },
      };
      const fila = await ler();
      fila.push(normalizado);
      await storage.set({ [chave]: fila });
      return normalizado;
    });
  }

  function enviarTodos() {
    if (envioAtual) return envioAtual;
    envioAtual = exclusivo(async () => {
      const fila = await ler();
      // Lotes limitados para não bloquear novas gravações por toda a fila.
      const lote = fila.slice(0, 100);
      if (!lote.length) return;
      const payload = lote.map((evento) => ({
        ...evento,
        operador_id: evento.operador_id || evento.operador?.toLowerCase().normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '_')
          .replace(/_+/g, '_').replace(/^_|_$/g, ''),
      }));
      await enviar(payload);
      await storage.set({ [chave]: fila.slice(lote.length) });
    }).finally(() => { envioAtual = null; });
    return envioAtual;
  }

  return { registrar, enviarTodos };
}

if (typeof module !== 'undefined') module.exports = { criarFilaMetricas };
