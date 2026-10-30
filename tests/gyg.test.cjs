const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');

const fixture = `<main><p>Booking GYGTEST123</p><p>Lead traveler<br>Alexandra Maria de Souza Oliveira</p>
<p>customer-test@reply.getyourguide.com</p><a href="tel:+5511999990000">Ligar</a></main>`;

function ambiente(html = fixture, set) {
  const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'https://supplier.getyourguide.com/bookings/GYGTEST123' });
  const w = dom.window;
  const gravacoes = [];
  w.chrome = { storage: { local: { async set(dados) { if (set) await set(dados); gravacoes.push(dados); } } } };
  Object.defineProperty(w.HTMLElement.prototype, 'innerText', { get() {
    const clone = this.cloneNode(true);
    clone.querySelectorAll('br').forEach(el => el.replaceWith('\n'));
    clone.querySelectorAll('p,main').forEach(el => el.append('\n'));
    return clone.textContent;
  } });
  w.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  w.HTMLDialogElement.prototype.close = function () { this.open = false; };
  let raiz;
  const attach = w.HTMLElement.prototype.attachShadow;
  w.HTMLElement.prototype.attachShadow = function (o) { raiz = attach.call(this, o); return raiz; };
  for (const file of ['reserva_date', 'fornecedor_map', 'reserva_review', 'gyg']) {
    vm.runInContext(fs.readFileSync(require.resolve(`../scripts/generated/${file}.js`), 'utf8'), dom.getInternalVMContext());
  }
  return { dom, w, api: w.ICDGetYourGuide, gravacoes, raiz: () => raiz };
}
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
function submit(a) { a.raiz().querySelector('form').dispatchEvent(new a.w.Event('submit', { cancelable: true })); }

test('captura nome completo, endereço relay e telefone do link', () => {
  const a = ambiente();
  try {
    const r = a.api.extrair(a.w.document).reserva;
    assert.equal(r.gyg, 'GYGTEST123');
    assert.equal(r.nome, 'Alexandra Maria de Souza Oliveira');
    assert.equal(r.email, 'customer-test@reply.getyourguide.com');
    assert.equal(r.telefone, '+5511999990000');
    assert.equal(a.api.validar(r).length, 0);
  } finally { a.w.close(); }
});

test('HTML estruturado captura passeio, modalidade e data sem extrair horário', () => {
  const a = ambiente(`<p>GYGTEST123</p><div><div><h2>Rio de Janeiro: Sugarloaf Cable Car</h2><p>Standard Ticket | Cable Car Ticket</p></div>
    <div><span></span><p data-testid="conduction-time">Oct 31, 2026 (Valid: 1 day)</p></div></div>
    <li data-testid="booking-detail-lead-traveler"><p data-testid="lead-traveler-name">Alexandra Exemplo</p>
    <a data-testid="lead-traveler-email" href="mailto:customer-test@reply.getyourguide.com">E-mail</a>
    <a data-testid="lead-traveler-phone" href="tel:+5511999990000">Telefone</a></li>`);
  try {
    const r = a.api.extrair(a.w.document).reserva;
    assert.equal(r.passeio, 'Rio de Janeiro: Sugarloaf Cable Car');
    assert.equal(r.modalidade, 'Standard Ticket | Cable Car Ticket');
    assert.equal(r.dataVisita, '2026-10-31');
    assert.equal(r.fornecedor, 'Bondinho P\u00e3o de A\u00e7\u00facar');
    assert.equal(r.nome, 'Alexandra Exemplo');
    assert.equal(r.horario, undefined);
  } finally { a.w.close(); }
});

test('captura Maracanã com data e horário e duplicação responsiva do campo', () => {
  const a = ambiente(`<p>GYGTEST123</p><div><div><h2>Rio de Janeiro: Maracanã Stadium Entrance Ticket</h2><p>Standard Ticket</p></div>
    <div><p data-testid="conduction-time">Wednesday, Nov 25, 2026, 11:30 AM</p></div></div>
    <div hidden><p data-testid="conduction-time">Nov 25, 2026 at 11:30 AM</p></div>
    <p data-testid="lead-traveler-name">Cliente Exemplo</p>`);
  try {
    const r = a.api.extrair(a.w.document).reserva;
    assert.equal(r.dataVisita, '2026-11-25');
    assert.equal(r.fornecedor, 'Tour Maracanã');
    assert.equal(r.horario, undefined);
  } finally { a.w.close(); }
});

test('datas divergentes não escolhem uma data arbitrária', () => {
  const a = ambiente('<p data-testid="conduction-time">Nov 25, 2026</p><p data-testid="conduction-time">Nov 26, 2026</p>');
  try {
    const captura = a.api.extrair(a.w.document);
    assert.equal(captura.reserva.dataVisita, '');
    assert.match(captura.avisos.join(' '), /ambígua/);
  } finally { a.w.close(); }
});

test('não deduz nome a partir de textos soltos e não escolhe entre reservas', () => {
  const a = ambiente('<p>Booking GYGAAA GYGBBB</p><p>Central de Atendimento</p><p>support@example.test sales@example.test</p>');
  try {
    const captura = a.api.extrair(a.w.document);
    assert.equal(captura.reserva.gyg, '');
    assert.equal(captura.reserva.nome, '');
    assert.equal(captura.reserva.email, '');
    assert.match(captura.avisos.join(' '), /mais de uma reserva/);
    assert.equal(a.api.validar(captura.reserva).length, 2);
  } finally { a.w.close(); }
});

test('contatos ausentes são opcionais; valores inválidos exigem correção', () => {
  const a = ambiente('<p>GYGABC</p><p>Dados do Cliente\nNome: JOÃO DA SILVA</p>');
  try {
    const r = a.api.extrair(a.w.document).reserva;
    assert.equal(r.nome, 'JOÃO DA SILVA');
    assert.equal(a.api.validar(r).length, 0);
    assert.equal(a.api.validar({ ...r, email: 'inválido', telefone: 'abc' }).length, 2);
  } finally { a.w.close(); }
});

test('cancelamento por Escape não altera reserva pendente', async () => {
  const a = ambiente();
  try {
    const revisao = a.api.conferir(a.api.extrair(a.w.document));
    a.raiz().querySelector('dialog').dispatchEvent(new a.w.Event('cancel', { cancelable: true }));
    assert.equal(await revisao, null);
    assert.equal(a.gravacoes.length, 0);
  } finally { a.w.close(); }
});

test('confirma dados corrigidos uma única vez no formato esperado pelo ICD', async () => {
  const a = ambiente();
  try {
    a.w.document.querySelector('#btn-copy-gyg').click();
    assert.equal(a.gravacoes.length, 0);
    const raiz = a.raiz();
    raiz.querySelector('[name=nome]').value = 'MARIA ALEXANDRA DA SILVA OLIVEIRA';
    raiz.querySelector('[name=email]').value = 'errado';
    submit(a);
    assert.match(raiz.querySelector('#erros').textContent, /e-mail/);
    assert.equal(a.gravacoes.length, 0);
    raiz.querySelector('[name=email]').value = '';
    raiz.querySelector('[name=fornecedor]').value = 'Fornecedor Teste';
    raiz.querySelector('[name=dataVisita]').value = '2026-10-31';
    raiz.querySelector('[name=passeio]').value = 'Passeio Teste';
    submit(a); submit(a);
    await tick();
    assert.equal(a.gravacoes.length, 1);
    const r = a.gravacoes[0].dadosPedido;
    assert.equal(r.nome, 'MARIA ALEXANDRA DA SILVA OLIVEIRA');
    assert.equal(r.gyg, 'GYGTEST123');
    assert.equal(r.versao, 1);
    assert.equal(r.origem, 'GETYOURGUIDE');
    assert.equal(r.fornecedor, 'Fornecedor Teste');
    assert.equal(r.dataVisita, '2026-10-31');
    assert.equal(r.passeio, 'Passeio Teste');
  } finally { a.w.close(); }
});

test('falha no storage mantém diálogo e permite retentativa', async () => {
  let falhar = true;
  const a = ambiente(fixture, async () => { if (falhar) throw new Error('quota'); });
  try {
    const revisao = a.api.conferir(a.api.extrair(a.w.document));
    submit(a); await tick();
    assert.equal(a.gravacoes.length, 0);
    assert.match(a.raiz().querySelector('#erros').textContent, /Tente confirmar novamente/);
    falhar = false;
    submit(a);
    assert.equal((await revisao).gyg, 'GYGTEST123');
    assert.equal(a.gravacoes.length, 1);
  } finally { a.w.close(); }
});

test('ICD novo preserva nome GYG revisado e recebe código, email e telefone', () => {
  const a = ambiente();
  try {
    a.dom.reconfigure({ url: 'https://app.icdgrupo.com.br/apps/sales/bookings/new' });
    a.w.chrome.storage.local.get = () => {};
    a.w.chrome.storage.onChanged = { addListener() {} };
    a.w.chrome.runtime = { onMessage: { addListener() {} } };
    a.w.setInterval = () => 0;
    a.w.setTimeout = () => 0;
    vm.runInContext(fs.readFileSync(require.resolve('../scripts/ingresso_master.js'), 'utf8'), a.dom.getInternalVMContext());
    const valores = {};
    a.w.forceReactValue = (input, valor) => { valores[input.dataset.busca || input.busca] = valor; input.value = valor; };
    a.w.selecionarBarraMui = () => {};
    a.w.prepararDadosEmail = () => {};
    const r = a.api.normalizar({ gyg: 'GYGTEST123', nome: 'MARIA ALEXANDRA DA SILVA OLIVEIRA', email: 'cliente@example.test', telefone: '+5511999990000' });
    // Primeira etapa: nascimento ou outros campos isolados não consomem a reserva.
    assert.equal(a.w.preencherNovoSistemaICD(r, 'Operador Teste', 'GYG'), false);
    for (const busca of ['Nome', 'E-mail', 'Telefone', 'Número do documento']) {
      const input = a.w.document.createElement('input');
      input.placeholder = busca + ' *'; input.dataset.busca = busca;
      a.w.document.body.append(input);
    }
    const nomeManual = a.w.document.querySelector('input[data-busca="Nome"]');
    nomeManual.value = 'Outro cliente';
    assert.equal(a.w.preencherNovoSistemaICD(r, 'Operador Teste', 'GYG'), false);
    assert.equal(nomeManual.value, 'Outro cliente');
    assert.equal(a.w.document.querySelector('input[data-busca="E-mail"]').value, '');
    nomeManual.value = '';
    assert.equal(a.w.preencherNovoSistemaICD(r, 'Operador Teste', 'GYG'), true);
    assert.equal(valores.Nome, r.nome);
    assert.equal(valores['E-mail'], r.email);
    assert.equal(valores.Telefone, r.telefone);
    assert.equal(valores['Número do documento'], r.gyg);
    assert.equal(valores.nascimento, undefined);
    const camposAntigos = {};
    a.w.document.getElementsByName = nome => [{ busca: nome }];
    a.w.forceReactValue = (input, valor) => { camposAntigos[input.busca] = valor; };
    a.w.preencherCamposGYG(r, 'Operador Teste');
    assert.equal(camposAntigos.sAge_Nome, r.nome);
    assert.equal(camposAntigos.sAge_Email, r.email);
    assert.equal(camposAntigos.sAge_CPF, r.gyg);
  } finally { a.w.close(); }
});
