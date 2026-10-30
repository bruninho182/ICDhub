const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
async function ambiente(preferencias = {}, falhar = false) {
  const dom = new JSDOM('<div id="lista-funcionalidades"></div><p id="status-funcionalidades"></p>', { runScripts: 'outside-only' });
  const w = dom.window;
  const dados = { icdFuncionalidades: preferencias, configMaster: [{ texto: 'preservar' }] };
  const listeners = []; let gravacoes = 0;
  w.chrome = { storage: { local: {
    async get() { return structuredClone(dados); },
    async set(valor) { if (falhar) throw Error('Storage'); gravacoes++; Object.assign(dados, structuredClone(valor)); for (const fn of listeners) fn({icdFuncionalidades:{newValue:structuredClone(dados.icdFuncionalidades)}}, 'local'); },
  }, onChanged: { addListener(fn) { listeners.push(fn); } } } };
  vm.runInContext(fs.readFileSync(require.resolve('../scripts/generated/funcionalidades.js'), 'utf8'), dom.getInternalVMContext());
  await tick();
  return { w, dados, gravacoes: () => gravacoes, input: id => w.document.querySelector(`[data-icd-recurso="${id}"]`), mudar(prefs, area='local') { for (const fn of listeners) fn({icdFuncionalidades:{newValue:prefs}},area); } };
}
test('ferramentas iniciam ativadas, métricas exigem adesão e as chaves têm rótulos', async () => {
  const a = await ambiente(); try {
    assert.equal(a.gravacoes(), 0);
    assert.equal(a.w.document.querySelectorAll('[role=switch]').length, 11);
    for (const input of a.w.document.querySelectorAll('[role=switch]')) { assert.equal(input.checked, input.dataset.icdRecurso !== 'metricas'); assert.ok(input.getAttribute('aria-label')); }
  } finally { a.w.close(); }
});
test('desativa ferramentas independentemente, preserva cadastros e oculta botões inseridos depois', async () => {
  const a = await ambiente({ relatorio: false }); try {
    assert.equal(a.input('relatorio').checked, false);
    const btn = a.w.document.createElement('button'); btn.id='icd-importar-tarifario'; a.w.document.body.append(btn);
    a.input('tarifario').click(); a.input('calculadora').click(); await tick(); await tick();
    assert.equal(a.dados.icdFuncionalidades.relatorio, false);
    assert.equal(a.dados.icdFuncionalidades.tarifario, false);
    assert.equal(a.dados.icdFuncionalidades.calculadora, false);
    assert.equal(a.w.getComputedStyle(btn).display, 'none');
    assert.equal(a.dados.configMaster[0].texto, 'preservar');
    a.input('tarifario').click(); await tick(); await tick();
    assert.notEqual(a.w.getComputedStyle(btn).display, 'none');
    assert.equal(a.dados.icdFuncionalidades.calculadora, false);
  } finally { a.w.close(); }
});
test('preferências externas atualizam chaves e inicializam cada módulo apenas uma vez', async () => {
  const a = await ambiente({ relatorio:false }); try {
    let chamadas=0; a.w.ICDFuncionalidades.quandoAtiva('relatorio',()=>chamadas++);
    assert.equal(chamadas,0);
    a.mudar({relatorio:true},'sync'); assert.equal(chamadas,0);
    a.mudar({relatorio:true}); assert.equal(chamadas,1);
    a.mudar({relatorio:false}); assert.equal(a.input('relatorio').checked,false);
    a.mudar({relatorio:true}); assert.equal(chamadas,1);
  } finally { a.w.close(); }
});
test('falha ao salvar reverte a chave e informa o operador', async () => {
  const a = await ambiente({},true); try {
    a.input('pix').click(); await tick(); await tick();
    assert.equal(a.input('pix').checked,true);
    assert.equal(a.input('pix').disabled,false);
    assert.match(a.w.document.getElementById('status-funcionalidades').textContent,/Não foi possível salvar/);
  } finally { a.w.close(); }
});
