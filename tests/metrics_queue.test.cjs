const { test } = require('node:test');
const assert = require('node:assert/strict');
const { criarFilaMetricas } = require('../scripts/metrics_queue.js');

function ambiente(enviar, inicial = []) {
  let dados = { metricsQueue: inicial, icdFuncionalidades: { metricas: true } };
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

test('fila antiga envia mais de um lote com operador_id', async () => {
  const tamanhos = [];
  const config = ambiente(async lote => {
    tamanhos.push(lote.length);
    assert.ok(lote.every(e => e.operador_id === 'joao_silva'));
  }, Array.from({ length: 105 }, () => evento()));
  await criarFilaMetricas(config).enviarTodos();
  assert.deepEqual(tamanhos, [100, 5]);
  assert.equal((await config.storage.get()).metricsQueue.length, 0);
});

test('falha em um segundo lote preserva apenas eventos ainda pendentes', async () => {
  let chamadas = 0;
  const config = ambiente(async () => {
    if (++chamadas === 2) throw Error('offline');
  }, Array.from({ length: 105 }, () => evento()));
  const fila = criarFilaMetricas(config);
  await assert.rejects(fila.enviarTodos(), /offline/);
  const pendentes = (await config.storage.get()).metricsQueue;
  assert.equal(pendentes.length, 5);
  assert.ok(pendentes.every(e => e.detalhes.evento_id));
  await fila.enviarTodos();
  assert.equal((await config.storage.get()).metricsQueue.length, 0);
});

test('evento inválido não entra na fila nem bloqueia registros seguintes', async () => {
  const config = ambiente(async () => {});
  const fila = criarFilaMetricas(config);
  await assert.rejects(fila.registrar({ tipo: 'email' }), /inválida/);
  await fila.registrar(evento());
  assert.equal((await config.storage.get()).metricsQueue.length, 1);
});

test('métricas persistem somente campos permitidos, sem dados de clientes ou conteúdo', async () => {
  const config = ambiente(async () => {}); const fila = criarFilaMetricas(config);
  const e = evento('whatsapp'); e.email = 'cliente@example.test'; e.detalhes = {destinatario:'Cliente',assunto:'Reserva 123',codigo:'ABC',cliente:'Nome',texto:'Conversa privada',metodo:'enter',tamanho:42};
  await fila.registrar(e);
  const salvo = (await config.storage.get()).metricsQueue[0];
  assert.equal(salvo.operador,'João Silva');
  assert.equal(salvo.detalhes.tamanho,42);
  assert.deepEqual(Object.keys(salvo.detalhes).sort(),['evento_id','metodo','tamanho']);
  assert.doesNotMatch(JSON.stringify(salvo),/cliente@example|Conversa privada|Reserva 123|ABC|Cliente/);
});
test('fila legada é saneada antes do envio e continua saneada se a rede falhar', async () => {
  const e = evento('email'); e.email='cliente@example.test';e.detalhes={assunto:'Assunto privado',destinatario:'cliente@example.test'};
  let payload; const config = ambiente(async lote => {payload=lote;throw Error('offline');},[e]);
  await assert.rejects(criarFilaMetricas(config).enviarTodos(),/offline/);
  assert.doesNotMatch(JSON.stringify(payload),/cliente@example|Assunto privado/);
  assert.doesNotMatch(JSON.stringify((await config.storage.get()).metricsQueue),/cliente@example|Assunto privado/);
});
test('chave de métricas desativada pausa coleta e transmissão sem descartar o histórico local', async () => {
  let envios=0;const config=ambiente(async()=>envios++,[evento()]);await config.storage.set({icdFuncionalidades:{metricas:false}});
  const fila=criarFilaMetricas(config);assert.equal(await fila.registrar(evento('email')),null);await fila.enviarTodos();
  assert.equal(envios,0);assert.equal((await config.storage.get()).metricsQueue.length,1);
  await config.storage.set({icdFuncionalidades:{metricas:true}});await fila.enviarTodos();assert.equal(envios,1);
});

test('ausência de adesão explícita não permite novos registros nem envios de métricas', async () => {
  let envios=0;const config=ambiente(async()=>envios++);await config.storage.set({icdFuncionalidades:{}});
  const fila=criarFilaMetricas(config);assert.equal(await fila.registrar(evento()),null);await fila.enviarTodos();
  assert.equal(envios,0);assert.equal((await config.storage.get()).metricsQueue.length,0);
});

test('horário de sincronização só é salvo após confirmação do envio', async () => {
  let falhar = true;
  const config = ambiente(async () => { if (falhar) throw Error('offline'); }, [evento()]);
  const fila = criarFilaMetricas(config);
  await assert.rejects(fila.enviarTodos(), /offline/);
  assert.equal((await config.storage.get()).metricsLastConfirmedAt, undefined);
  falhar = false;
  await fila.enviarTodos();
  assert.ok(Number.isFinite(Date.parse((await config.storage.get()).metricsLastConfirmedAt)));
});
