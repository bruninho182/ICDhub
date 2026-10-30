const { test } = require('node:test');
const assert = require('node:assert/strict');
const { criarFilaMetricas } = require('../scripts/metrics_queue.js');

function ambiente(enviar, inicial = []) {
  let dados = { metricsQueue: inicial };
  return {
    storage: {
      async get() { return structuredClone(dados); },
      async set(valor) { dados = { ...dados, ...structuredClone(valor) }; },
    },
    enviar,
  };
}
const evento = (tipo = 'voucher') => ({ operador: 'João Silva', tipo,
  timestamp: new Date().toISOString(), detalhes: {} });

test('registros simultâneos preservam todos os eventos e IDs distintos', async () => {
  const config = ambiente(async () => {});
  const fila = criarFilaMetricas(config);
  await Promise.all(Array.from({ length: 30 }, () => fila.registrar(evento())));
  const { metricsQueue } = await config.storage.get();
  assert.equal(metricsQueue.length, 30);
  assert.equal(new Set(metricsQueue.map(e => e.detalhes.evento_id)).size, 30);
  assert.equal(metricsQueue[0].operador_id, 'joao_silva');
});

test('envios simultâneos compartilham requisição e preservam registro durante envio', async () => {
  let liberar;
  let iniciou;
  const inicio = new Promise(resolve => { iniciou = resolve; });
  let chamadas = 0;
  const config = ambiente(async () => {
    chamadas++;
    iniciou();
    await new Promise(resolve => { liberar = resolve; });
  });
  const fila = criarFilaMetricas(config);
  await fila.registrar(evento());
  const a = fila.enviarTodos();
  const b = fila.enviarTodos();
  await inicio;
  const novo = fila.registrar(evento('email'));
  liberar();
  await Promise.all([a, b, novo]);
  assert.equal(chamadas, 1);
  assert.deepEqual((await config.storage.get()).metricsQueue.map(e => e.tipo), ['email']);
});

test('falha mantém fila persistida e permite retentativa após recriar serviço', async () => {
  let falhar = true;
  const config = ambiente(async () => { if (falhar) throw new Error('offline'); });
  const fila = criarFilaMetricas(config);
  await fila.registrar(evento());
  await assert.rejects(fila.enviarTodos(), /offline/);
  assert.equal((await config.storage.get()).metricsQueue.length, 1);
  falhar = false;
  await criarFilaMetricas(config).enviarTodos();
  assert.equal((await config.storage.get()).metricsQueue.length, 0);
});

test('fila antiga é enviada em lotes com operador_id', async () => {
  let enviados;
  const config = ambiente(async lote => { enviados = lote; }, Array.from({ length: 105 }, () => evento()));
  await criarFilaMetricas(config).enviarTodos();
  assert.equal(enviados.length, 100);
  assert.equal(enviados[0].operador_id, 'joao_silva');
  assert.equal((await config.storage.get()).metricsQueue.length, 5);
});

test('evento inválido não entra na fila nem bloqueia registros seguintes', async () => {
  const config = ambiente(async () => {});
  const fila = criarFilaMetricas(config);
  await assert.rejects(fila.registrar({ tipo: 'email' }), /inválida/);
  await fila.registrar(evento());
  assert.equal((await config.storage.get()).metricsQueue.length, 1);
});
