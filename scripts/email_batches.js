// Executado no background: serializa o progresso compartilhado entre abas.
function criarLotesEmail(storage) {
  const chave = 'icdCampanhaEmail';
  let operacao = Promise.resolve();
  async function executar(req) {
    const dados = await storage.get([chave, 'dadosParaEmail']);
    let campanha = dados[chave] || null;
    if (req.operacao === 'consultar') return { campanha };
    if (req.operacao === 'iniciar') {
      if (campanha && campanha.indice < campanha.lotes.length) throw Error('Há uma campanha em andamento. Retome ou encerre antes de criar outra.');
      if (!Array.isArray(req.emails) || req.emails.some(e => typeof e !== 'string')) throw Error('Lista de destinatários inválida.');
      const emails = [...new Set(req.emails.map(e => e.trim().toLowerCase()).filter(Boolean))];
      if (!emails.length || emails.some(e => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))) throw Error('Confira os destinatários.');
      if (typeof req.assunto !== 'string' || !req.assunto.trim() || typeof req.corpo !== 'string' || !req.corpo.trim()) throw Error('Assunto e mensagem são obrigatórios.');
      const lotes = [];
      for (let i = 0; i < emails.length; i += 100) lotes.push({ emails: emails.slice(i, i + 100), estado: 'pendente' });
      campanha = { id: crypto.randomUUID(), criadoEm: new Date().toISOString(), assunto: req.assunto, corpo: req.corpo, indice: 0, lotes };
    } else {
      if (!campanha || campanha.id !== req.id) throw Error('O acompanhamento mudou em outra aba. Atualize o painel.');
      if (req.operacao === 'encerrar') {
        await storage.remove(chave);
        if (dados.dadosParaEmail?.campanhaId === campanha.id) await storage.remove('dadosParaEmail');
        return { campanha: null };
      }
      if (req.indice !== campanha.indice) throw Error('Este lote já mudou. Atualize o painel antes de continuar.');
      const lote = campanha.lotes[campanha.indice];
      if (!lote) throw Error('Todos os lotes já foram confirmados.');
      if (req.operacao === 'preparar') {
        lote.estado = 'preparado';
        await storage.set({ [chave]: campanha, dadosParaEmail: {
          modo: 'CCO', email: lote.emails.join(', '), assunto: campanha.assunto, corpo: campanha.corpo,
          campanhaId: campanha.id, loteIndice: campanha.indice,
        } });
        return { campanha };
      }
      if (req.operacao !== 'confirmar' || lote.estado !== 'preparado') throw Error('Prepare o lote atual antes de confirmar o envio.');
      lote.estado = 'enviado'; lote.confirmadoEm = new Date().toISOString(); campanha.indice++;
      if (dados.dadosParaEmail?.campanhaId === campanha.id && dados.dadosParaEmail.loteIndice === req.indice) await storage.remove('dadosParaEmail');
    }
    await storage.set({ [chave]: campanha });
    return { campanha };
  }
  return req => {
    const resultado = operacao.then(() => executar(req));
    operacao = resultado.catch(() => {});
    return resultado;
  };
}
if (typeof module !== 'undefined') module.exports = { criarLotesEmail };
if (typeof chrome !== 'undefined') {
  const lotesEmail = criarLotesEmail(chrome.storage.local);
  chrome.runtime.onMessage.addListener((req, sender, responder) => {
    if (req.acao !== 'RELATORIO_LOTES') return;
    lotesEmail(req).then(dados => responder({ ok: true, ...dados })).catch(erro => responder({ ok: false, erro: erro.message }));
    return true;
  });
}
