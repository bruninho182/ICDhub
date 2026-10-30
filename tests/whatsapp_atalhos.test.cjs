const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');
function ambiente() {
  const dom = new JSDOM('<body></body>', { runScripts: 'outside-only', url: 'https://web.whatsapp.com/' });
  const w = dom.window;
  const dados = { listaPastas: ['Pagamento', 'Remarcação'], configMaster: [
    { id: 'pix', nome: 'Pagamento', texto: 'Texto original', pasta: 'Pagamento', traducoes: { es: 'Su pago está confirmado', en: 'Your payment is confirmed' } },
    { id: 'antigo', nome: 'Alterar data', texto: 'Remarcação disponível', pasta: 'Remarcação' },
  ] };
  w.chrome = { runtime: { getURL: p => p }, storage: { local: {
    get(keys, cb) { cb(structuredClone(dados)); }, set(value, cb) { Object.assign(dados, value); cb?.(); },
  }, onChanged: { addListener() {} } } };
  w.ICDCotacaoUI = {};
  for (const file of ['scripts/generated/cotacao.js', 'scripts/whatsapp_tool.js']) vm.runInContext(fs.readFileSync(require.resolve('../' + file), 'utf8'), dom.getInternalVMContext());
  const mensagens = [];
  w.__inserir = texto => mensagens.push(texto);
  vm.runInContext('enviarTexto = texto => window.__inserir(texto)', dom.getInternalVMContext());
  const container = w.document.getElementById('container-botoes-hub');
  const busca = termo => { const el = w.document.getElementById('busca-botoes'); el.value = termo; el.dispatchEvent(new w.Event('input')); };
  return { w, container, busca, mensagens, dados };
}
test('busca em todos os idiomas e pastas preserva a pasta ao limpar e mostra a origem', () => {
  const a = ambiente();
  try {
    a.container.querySelectorAll('.btn-pasta-hub')[1].click();
    assert.equal(a.container.querySelector('.titulo-pasta-ativa').textContent, 'Remarcação');
    a.busca('PAGO ESTA');
    assert.equal(a.container.querySelectorAll('.btn-atalho-hub').length, 1);
    assert.match(a.container.querySelector('small').textContent, /Pagamento/);
    assert.match(a.container.querySelector('[role=status]').textContent, /todas as pastas/);
    a.busca('');
    assert.equal(a.container.querySelector('.titulo-pasta-ativa').textContent, 'Remarcação');
    a.container.querySelector('.btn-atalho-hub').click();
    assert.equal(a.mensagens[0], 'Remarcação disponível');
  } finally { a.w.close(); }
});

test('abre bandeiras disponíveis sem inserir e só insere ao escolher o idioma', () => {
  const a = ambiente();
  try {
    a.busca('Pagamento');
    const btn = a.container.querySelector('.btn-atalho-hub');
    const opcoes = a.container.querySelector('.icd-idiomas-opcoes');
    assert.equal(opcoes.hidden, true);
    assert.equal(a.container.querySelector('select'), null);
    btn.click();
    assert.equal(opcoes.hidden, false);
    assert.equal(btn.getAttribute('aria-expanded'), 'true');
    assert.equal(a.mensagens.length, 0);
    assert.deepEqual([...opcoes.querySelectorAll('button')].map(el => el.dataset.idioma), ['pt', 'es', 'en']);
    assert.equal(opcoes.querySelectorAll('svg').length, 3);
    opcoes.querySelector('[data-idioma=en]').click();
    assert.equal(a.mensagens[0], 'Your payment is confirmed');
    assert.equal(opcoes.hidden, true);
    assert.equal(btn.getAttribute('aria-expanded'), 'false');
    btn.click(); opcoes.querySelector('[data-idioma=es]').click();
    assert.equal(a.mensagens[1], 'Su pago está confirmado');
    btn.click(); opcoes.querySelector('[data-idioma=pt]').click();
    assert.equal(a.mensagens[2], 'Texto original');
    a.busca('Alterar');
    assert.equal(a.container.querySelector('.icd-idiomas-opcoes'), null);
    a.container.querySelector('.btn-atalho-hub').click();
    assert.equal(a.mensagens[3], 'Remarcação disponível');
  } finally { a.w.close(); }
});
test('bandeiras fecham com Escape, clique fora ou busca sem inserir mensagens', () => {
  const a = ambiente();
  try {
    a.busca('Pagamento');
    const btn = a.container.querySelector('.btn-atalho-hub');
    const opcoes = a.container.querySelector('.icd-idiomas-opcoes');
    btn.click(); btn.click(); assert.equal(opcoes.hidden, true);
    btn.click();
    opcoes.querySelector('button').dispatchEvent(new a.w.KeyboardEvent('keydown', { key:'Escape', bubbles:true }));
    assert.equal(opcoes.hidden, true);
    assert.equal(a.w.document.activeElement, btn);
    btn.click(); a.w.document.body.click(); assert.equal(opcoes.hidden, true);
    btn.click(); a.busca('Your');
    assert.equal(a.container.querySelector('.icd-idiomas-opcoes').hidden, true);
    assert.equal(a.mensagens.length, 0);
  } finally { a.w.close(); }
});
