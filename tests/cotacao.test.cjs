const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');

const passeios = [
  { nome: 'Corcovado', ingressos: [{ tipo: 'Adulto', valor: 99.90 }, { tipo: 'Infantil', valor: 0 }] },
  { nome: 'Pão de Açúcar', ingressos: [{ tipo: 'Adulto', valor: '120.50' }] },
];
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
function ambiente({ clipboardFalha = false } = {}) {
  const dom = new JSDOM('', { runScripts: 'outside-only', url: 'https://web.whatsapp.com/' });
  const w = dom.window;
  let tarifas = structuredClone(passeios);
  const listeners = new Set();
  const copias = [];
  const mensagens = [];
  w.chrome = { storage: { local: { async get() { return { listaPasseios: structuredClone(tarifas) }; } },
    onChanged: { addListener(fn) { listeners.add(fn); }, removeListener(fn) { listeners.delete(fn); } } },
    runtime: { async sendMessage(mensagem) { mensagens.push(mensagem); return { ok: true }; } } };
  w.navigator.clipboard = { async writeText(texto) { if (clipboardFalha) throw Error('denied'); copias.push(texto); } };
  for (const f of ['cotacao', 'cotacao_ui']) vm.runInContext(fs.readFileSync(require.resolve(`../scripts/generated/${f}.js`), 'utf8'), dom.getInternalVMContext());
  return { w, api: w.ICDCotacao, ui: w.ICDCotacaoUI, copias, listeners, mensagens,
    atualizar(valor) { tarifas = valor; for (const fn of listeners) fn({ listaPasseios: {} }, 'local'); },
    root: () => w.document.getElementById('modal-cotacao-icd').shadowRoot };
}
function adicionar(a, passeio, quantidade) {
  const root = a.root();
  root.getElementById('passeio').value = String(passeio);
  root.getElementById('passeio').dispatchEvent(new a.w.Event('change'));
  const input = root.querySelector('input[type=number]');
  input.value = String(quantidade); input.dispatchEvent(new a.w.Event('input'));
  root.getElementById('adicionar').click();
}

test('centavos exatos, preços brasileiros e categorias gratuitas', () => {
  const a = ambiente();
  try {
    assert.equal(a.api.centavos('0,10'), 10);
    assert.equal(a.api.centavos(120.5), 12050);
    assert.equal(a.api.validarPasseio(' Passeio ', [{ tipo: 'Gratuito', valor: '0' }]).ingressos[0].valor, 0);
    assert.equal(a.api.total([{ passeio: 'P', tipo: 'T', centavos: 10, quantidade: 3 }]), 30);
    for (const valor of ['-1', '1.234', '', 'NaN', '1e5', Infinity]) assert.throws(() => a.api.centavos(valor));
    for (const qtd of ['-1', '1.5', '', '1000']) assert.throws(() => a.api.quantidade(qtd));
    assert.throws(() => a.api.validarPasseio('P', [{ tipo: 'Adulto', valor: 1 }, { tipo: 'ADULTO', valor: 2 }]), /mesmo nome/);
  } finally { a.w.close(); }
});

test('cotação reúne passeios, copia o total certo e permite remover itens', async () => {
  const a = ambiente();
  try {
    await a.ui.abrir(); adicionar(a, 0, 2); adicionar(a, 1, 1);
    assert.match(a.root().getElementById('total').textContent, /320,30/);
    a.root().getElementById('copiar').click(); await tick();
    assert.equal(a.copias.length, 1);
    assert.match(a.copias[0], /Corcovado/); assert.match(a.copias[0], /Pão de Açúcar/); assert.match(a.copias[0], /320,30/);
    a.root().querySelector('.item button').click();
    assert.match(a.root().getElementById('total').textContent, /120,50/);
  } finally { a.w.close(); }
});

test('atualização de tarifa bloqueia cópia até atualizar; fecha remove listener', async () => {
  const a = ambiente();
  try {
    await a.ui.abrir(); adicionar(a, 0, 1);
    a.atualizar([{ nome: 'Novo', ingressos: [{ tipo: 'Adulto', valor: 150 }] }]);
    assert.equal(a.root().getElementById('copiar').disabled, true);
    assert.equal(a.root().getElementById('adicionar').disabled, true);
    a.root().getElementById('atualizar').click(); await tick();
    assert.equal(a.root().querySelectorAll('.item').length, 0);
    adicionar(a, 0, 1);
    assert.match(a.root().getElementById('total').textContent, /150,00/);
    assert.equal(a.listeners.size, 1);
    a.root().getElementById('fechar').click(); assert.equal(a.listeners.size, 0);
  } finally { a.w.close(); }
});

test('quantidade inválida não é adicionada e falha de clipboard apresenta prévia', async () => {
  const a = ambiente({ clipboardFalha: true });
  try {
    await a.ui.abrir(); adicionar(a, 0, -1);
    assert.equal(a.root().querySelectorAll('.item').length, 0);
    adicionar(a, 0, 1); a.root().getElementById('copiar').click(); await tick();
    assert.equal(a.copias.length, 0);
    assert.equal(a.root().querySelector('details').open, true);
    assert.match(a.root().getElementById('status').textContent, /Não foi possível copiar/);
  } finally { a.w.close(); }
});

test('busca sem acento, minimização e reabertura mantêm a cotação atual', async () => {
  const a = ambiente();
  try {
    await a.ui.abrir(); adicionar(a, 0, 1);
    const busca = a.root().getElementById('busca'); busca.value = 'pao'; busca.dispatchEvent(new a.w.Event('input'));
    assert.equal(a.root().getElementById('passeio').options.length, 2);
    a.root().getElementById('minimizar').click();
    assert.equal(a.root().querySelector('main').hidden, true);
    await a.ui.abrir();
    assert.equal(a.root().querySelector('main').hidden, false);
    assert.match(a.root().getElementById('total').textContent, /99,90/);
  } finally { a.w.close(); }
});

test('Editar tarifários usa mensagem ao background sem API privilegiada no content script', async () => {
  const a = ambiente();
  try {
    assert.equal(a.w.chrome.runtime.openOptionsPage, undefined);
    await a.ui.abrir();
    a.root().getElementById('configurar').click(); await tick();
    assert.equal(a.mensagens.length, 1);
    assert.equal(a.mensagens[0].acao, 'ABRIR_CONFIGURACOES');
    a.w.chrome.runtime.sendMessage = async () => ({ ok: false });
    a.root().getElementById('configurar').click(); await tick();
    assert.match(a.root().getElementById('status').textContent, /Não foi possível abrir/);
  } finally { a.w.close(); }
});

test('tarifa importada exibe só o ingresso sem data ou canal na cotação', async () => {
  const a = ambiente();
  try {
    a.atualizar([{ nome: 'Corcovado · 31/10/2026', importacaoChave: JSON.stringify(['Corcovado']), ingressos: [{ tipo: 'Adulto', valor: 139 }],
      contexto: { origem: 'ICD', canal: 'Canal interno', distribuidora: 'Distribuidora interna', fornecedor: 'Corcovado',
        modalidade: '', dataVisita: '2026-10-31', horario: '', consultadoEm: '2026-10-30T15:00:00Z' } }]);
    await a.ui.abrir(); adicionar(a, 0, 1);
    assert.equal(a.root().getElementById('contexto-tarifa').hidden, true);
    assert.equal(a.root().getElementById('passeio').options[1].textContent, 'Corcovado');
    a.root().getElementById('copiar').click(); await tick();
    assert.doesNotMatch(a.copias[0], /Canal interno|Distribuidora interna|31\/10\/2026/);
    assert.match(a.copias[0], /139,00/);
  } finally { a.w.close(); }
});

test('calculadora nao apresenta disponibilidade', async () => {
  const a = ambiente();
  try {
    await a.ui.abrir();
    assert.equal(a.root().getElementById('ver-disponibilidade'), null);
    assert.equal(a.root().getElementById('disponibilidades'), null);
  } finally { a.w.close(); }
});
