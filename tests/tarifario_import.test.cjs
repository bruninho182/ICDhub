const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');

const categorias = [['Adulto', '139,00'], ['Idoso', '74,00'], ['Infantil', '112,00'],
  ['Estudante', '112,00'], ['ID Jovem', '112,00'], ['PcD', '112,00']];
const campo = (nome, valor, id) => `<div class="MuiFormControl-root"><label for="${id}">${nome}</label><input id="${id}" value="${valor}"></div>`;
const html = campo('Canal de venda', 'Call Center', 'canal') + campo('Selecione o fornecedor', 'Trem do Corcovado', 'fornecedor') +
  `<div class="MuiGrid-item"><h6>4. Data da visita</h6><div class="MuiPickersCalendarHeader-switchHeader"><p>outubro 2026</p></div><button class="MuiPickersDay-daySelected">31</button></div>
  <section><h6>6. Produtos</h6><table><thead><tr><th>Produto</th><th>Tipo de produto</th><th>Preço unitário</th><th>Quantidade</th></tr></thead>
  <tbody>${categorias.map(([tipo, valor]) => `<tr><td>Ingressos Trem do Corcovado</td><td>${tipo}</td><td><strong>R$ ${valor}</strong></td><td><input type="number" value="0"></td></tr>`).join('')}</tbody></table></section>`;
function ambiente() {
  const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'https://app.icdgrupo.com.br/apps/sales/bookings/new' });
  const w = dom.window;
  const dados = { listaPasseios: [{ nome: 'Cadastro manual', ingressos: [{ tipo: 'Adulto', valor: 10 }] }] };
  let gravacoes = 0;
  w.chrome = { storage: { local: {
    async get() { return structuredClone(dados); },
    async set(valor) { gravacoes++; Object.assign(dados, structuredClone(valor)); },
  } } };
  w.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  w.HTMLDialogElement.prototype.close = function () { this.open = false; };
  for (const f of ['reserva_date', 'cotacao', 'tarifario_import']) vm.runInContext(fs.readFileSync(require.resolve(`../scripts/generated/${f}.js`), 'utf8'), dom.getInternalVMContext());
  return { w, api: w.ICDTarifarioImport, dados, gravacoes: () => gravacoes };
}

test('captura as seis categorias do HTML com valores unitários e contexto', () => {
  const a = ambiente();
  try {
    const c = a.api.capturar(a.w.document);
    assert.equal(c.passeios.length, 1);
    assert.equal(c.passeios[0].ingressos.length, 6);
    assert.equal(c.passeios[0].ingressos[0].valor, 139);
    assert.equal(c.passeios[0].ingressos[1].valor, 74);
    assert.equal(c.passeios[0].contexto.dataVisita, '2026-10-31');
    assert.equal(c.passeios[0].contexto.canal, 'Call Center');
    assert.equal(c.passeios[0].contexto.horario, '');
    assert.equal(a.gravacoes(), 0);
    assert.ok([...a.w.document.querySelectorAll('input[type=number]')].every(input => input.value === '0'));
  } finally { a.w.close(); }
});

test('preço monetário brasileiro aceita milhar e rejeita números ambíguos', () => {
  const a = ambiente();
  try {
    assert.equal(a.api.preco('R$ 1.234,56'), 1234.56);
    assert.equal(a.api.preco('R$ 0,00'), 0);
    for (const valor of ['R$ -1,00', '139', 'R$ 1,2', 'Carregando…']) assert.throws(() => a.api.preco(valor));
  } finally { a.w.close(); }
});

test('confirmação salva no formato da calculadora e atualiza somente o mesmo contexto', async () => {
  const a = ambiente();
  try {
    await a.api.salvar(a.api.capturar(a.w.document), a.w.document);
    assert.equal(a.dados.listaPasseios.length, 2);
    a.w.document.querySelector('tbody strong').textContent = 'R$ 140,00';
    await a.api.salvar(a.api.capturar(a.w.document), a.w.document);
    assert.equal(a.dados.listaPasseios.length, 2);
    assert.equal(a.dados.listaPasseios[1].ingressos[0].valor, 140);
    assert.equal(a.dados.listaPasseios[0].nome, 'Cadastro manual');
    a.w.document.getElementById('canal').value = "OTA's";
    await a.api.salvar(a.api.capturar(a.w.document), a.w.document);
    assert.equal(a.dados.listaPasseios.length, 3);
  } finally { a.w.close(); }
});

test('mudança de preço entre prévia e confirmação bloqueia gravação', async () => {
  const a = ambiente();
  try {
    const captura = a.api.capturar(a.w.document);
    a.w.document.querySelector('tbody strong').textContent = 'R$ 150,00';
    await assert.rejects(a.api.salvar(captura, a.w.document), /mudaram/);
    assert.equal(a.gravacoes(), 0);
  } finally { a.w.close(); }
});

test('tabela incompleta ou data sem seleção não vira tarifa zero ou consulta genérica', () => {
  const a = ambiente();
  try {
    const preco = a.w.document.querySelector('tbody strong'); preco.textContent = 'Carregando…';
    assert.throws(() => a.api.capturar(a.w.document), /Preço não reconhecido/);
    preco.textContent = 'R$ 139,00';
    a.w.document.querySelector('.MuiPickersDay-daySelected').remove();
    assert.throws(() => a.api.capturar(a.w.document), /Selecione a data/);
  } finally { a.w.close(); }
});

test('cancelar a prévia não grava nem altera a tela de reserva', () => {
  const a = ambiente();
  try {
    a.api.revisar(a.api.capturar(a.w.document));
    const root = a.w.document.getElementById('icd-importar-previa').shadowRoot;
    assert.equal(root.getElementById('contexto'), null);
    assert.equal(root.querySelector('h3').textContent, 'Ingressos Trem do Corcovado');
    assert.equal(root.querySelectorAll('tbody tr').length, 6);
    root.getElementById('cancelar').click();
    assert.equal(a.w.document.getElementById('icd-importar-previa'), null);
    assert.equal(a.gravacoes(), 0);
  } finally { a.w.close(); }
});
