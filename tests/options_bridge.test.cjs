const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

test('background abre opções e responde sucesso ou falha ao remetente', async () => {
  let listener;
  let chamadas = 0;
  const runtime = { onMessage: { addListener(fn) { listener = fn; } },
    async openOptionsPage() { chamadas++; } };
  vm.runInNewContext(fs.readFileSync(require.resolve('../scripts/options_bridge.js'), 'utf8'), { chrome: { runtime } });
  assert.equal(listener({ acao: 'OUTRA' }, {}, () => {}), undefined);
  const enviar = () => new Promise(resolve => {
    assert.equal(listener({ acao: 'ABRIR_CONFIGURACOES' }, {}, resolve), true);
  });
  assert.equal((await enviar()).ok, true);
  assert.equal(chamadas, 1);
  runtime.openOptionsPage = async () => { throw Error('erro'); };
  const falha = await enviar();
  assert.equal(falha.ok, false);
  assert.match(falha.erro, /Não foi possível abrir/);
});
