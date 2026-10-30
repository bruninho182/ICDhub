const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');
const codigo = fs.readFileSync(require.resolve('../scripts/generated/headout.js'), 'utf8');

function ambiente(html = '') {
  const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'https://hub.headout.com/' });
  const janela = dom.window;
  const gravacoes = [];
  janela.chrome = { storage: { local: { async set(dados) { gravacoes.push(dados); } } } };
  // jsdom não implementa layout nem dialog nativo.
  Object.defineProperty(janela.HTMLElement.prototype, 'innerText', {
    get() { return this.textContent; },
  });
  janela.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  janela.HTMLDialogElement.prototype.close = function () { this.open = false; };
  let sombra;
  const attach = janela.HTMLElement.prototype.attachShadow;
  janela.HTMLElement.prototype.attachShadow = function (opcoes) {
    sombra = attach.call(this, opcoes); return sombra;
  };
  vm.runInContext(codigo, dom.getInternalVMContext());
  return { dom, janela, gravacoes, api: janela.ICDHeadout, sombra: () => sombra };
}

const tabela = `<table><thead><tr><th>Booking ID</th><th>Guest name</th><th>Additional details</th></tr></thead>
<tbody><tr><td>HD-123</td><td>Alexandra Exemplo</td><td>cliente@example.test</td></tr></tbody></table>`;

test('normaliza e valida dados sem inventar campos ausentes', () => {
  const a = ambiente();
  try {
    const reserva = a.api.normalizar({ bookingId: ' HD-123 ', nome: ' Alexandra   Exemplo ', email: ' cliente@example.test ' });
    assert.equal(reserva.nome, 'ALEXANDRA EXEMPLO');
    assert.equal(a.api.validar(reserva).length, 0);
    assert.equal(a.api.validar(a.api.normalizar({})).length, 3);
    assert.equal(reserva.data, undefined);
  } finally { a.dom.window.close(); }
});

test('captura usa tabela da linha e ignora texto do botão na célula do ID', async () => {
  const a = ambiente('<table><tr><th>Outra tabela</th></tr></table>' + tabela);
  try {
    const linha = a.janela.document.querySelector('tbody tr:has(td)');
    const reserva = await a.api.extrair(linha);
    assert.equal(reserva.bookingId, 'HD-123');
    assert.equal(reserva.email, 'cliente@example.test');
    assert.equal(a.gravacoes.length, 0);
  } finally { a.dom.window.close(); }
});

test('mudança de colunas interrompe captura com diagnóstico', async () => {
  const a = ambiente('<table><tr><th>Changed</th></tr><tr><td>123</td></tr></table>');
  try { await assert.rejects(a.api.extrair(a.janela.document.querySelector('tr:has(td)')), /colunas/); }
  finally { a.dom.window.close(); }
});

test('cancelar conferência não publica dados', async () => {
  const a = ambiente();
  try {
    const revisao = a.api.conferir(a.api.normalizar({}));
    a.sombra().querySelector('button[type=button]').click();
    assert.equal(await revisao, null);
    assert.equal(a.gravacoes.length, 0);
    assert.equal(a.janela.document.body.children.length, 0);
  } finally { a.dom.window.close(); }
});

test('fluxo exige conferência e publica somente dados corrigidos', async () => {
  const a = ambiente(tabela);
  try {
    a.janela.document.querySelector('.btn-bridge-hub').click();
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(a.gravacoes.length, 0);
    const raiz = a.sombra();
    raiz.querySelector('[name=nome]').value = 'Nome Corrigido';
    const formulario = raiz.querySelector('form');
    raiz.querySelector('[name=email]').value = 'invalido';
    formulario.dispatchEvent(new a.janela.Event('submit', { cancelable: true }));
    assert.match(raiz.querySelector('#erros').textContent, /e-mail/);
    assert.equal(a.gravacoes.length, 0);
    raiz.querySelector('[name=email]').value = 'corrigido@example.test';
    formulario.dispatchEvent(new a.janela.Event('submit', { cancelable: true }));
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(a.gravacoes.length, 1);
    assert.equal(a.gravacoes[0].bridgeData.nome, 'NOME CORRIGIDO');
    assert.equal(a.gravacoes[0].bridgeData.email, 'corrigido@example.test');
  } finally { a.dom.window.close(); }
});
