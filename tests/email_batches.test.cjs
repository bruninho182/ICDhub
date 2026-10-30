const { test } = require('node:test');
const assert = require('node:assert/strict');
const { criarLotesEmail } = require('../scripts/email_batches.js');
function ambiente() {
  const dados = {};
  const storage = { async get() { return structuredClone(dados); }, async set(value) { Object.assign(dados, structuredClone(value)); }, async remove(key) { delete dados[key]; } };
  return { storage, dados, executar: criarLotesEmail(storage) };
}
const emails = Array.from({ length: 235 }, (_, i) => `cliente${i}@example.test`);
const iniciar = { operacao: 'iniciar', emails: [...emails, 'CLIENTE0@example.test'], assunto: 'Aviso', corpo: 'Mensagem fixa' };

test('235 endereços únicos geram lotes 100/100/35 e confirmação permite avançar sem repetir', async () => {
  const a = ambiente();
  let { campanha } = await a.executar(iniciar);
  assert.deepEqual(campanha.lotes.map(l => l.emails.length), [100, 100, 35]);
  const enviados = [];
  for (let indice = 0; indice < 3; indice++) {
    await a.executar({ operacao: 'preparar', id: campanha.id, indice });
    const pendente = a.dados.dadosParaEmail;
    enviados.push(...pendente.email.split(', '));
    assert.equal(pendente.corpo, 'Mensagem fixa');
    ({ campanha } = await a.executar({ operacao: 'confirmar', id: campanha.id, indice }));
  }
  assert.equal(campanha.indice, 3);
  assert.equal(new Set(enviados).size, 235);
  assert.equal(a.dados.dadosParaEmail, undefined);
});

test('retomar e reabrir não avança nem muda a lista do lote', async () => {
  const a = ambiente();
  const { campanha } = await a.executar(iniciar);
  await a.executar({ operacao: 'preparar', id: campanha.id, indice: 0 });
  const outroWorker = criarLotesEmail(a.storage);
  assert.equal((await outroWorker({ operacao: 'consultar' })).campanha.indice, 0);
  await outroWorker({ operacao: 'preparar', id: campanha.id, indice: 0 });
  assert.equal(a.dados.dadosParaEmail.email.split(', ').length, 100);
  await assert.rejects(outroWorker({ operacao: 'iniciar', emails, assunto: 'Outro', corpo: 'Outro' }), /andamento/);
});

test('confirmações simultâneas de abas diferentes não pulam lotes', async () => {
  const a = ambiente();
  const { campanha } = await a.executar(iniciar);
  await a.executar({ operacao: 'preparar', id: campanha.id, indice: 0 });
  const resultados = await Promise.allSettled([0, 1].map(() => a.executar({ operacao: 'confirmar', id: campanha.id, indice: 0 })));
  assert.equal(resultados.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(a.dados.icdCampanhaEmail.indice, 1);
});

test('não confirma lote ainda não preparado e encerrar não remove outro e-mail pendente', async () => {
  const a = ambiente();
  const { campanha } = await a.executar(iniciar);
  await assert.rejects(a.executar({ operacao: 'confirmar', id: campanha.id, indice: 0 }), /Prepare/);
  a.dados.dadosParaEmail = { assunto: 'Voucher separado' };
  await a.executar({ operacao: 'encerrar', id: campanha.id });
  assert.equal(a.dados.icdCampanhaEmail, undefined);
  assert.equal(a.dados.dadosParaEmail.assunto, 'Voucher separado');
});
