const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');
function ambiente(mui = false) {
  const campo = (label, valor, id) => `<div class="MuiFormControl-root"><label for="${id}">${label}</label><input id="${id}" value="${valor}"></div>`;
  const html = campo('Canal de venda', "OTA's", 'canal') + campo('Selecione o fornecedor', 'Trem do Corcovado', 'fornecedor') +
    `<div class="MuiGrid-item"><h6>4. Data da visita</h6><div class="MuiPickersCalendarHeader-switchHeader"><p>outubro 2026</p></div><button class="MuiPickersDay-daySelected">31</button></div>` +
    (mui ? '<div class="MuiFormControl-root"><label for="hora">Hora da visita</label><div id="hora" role="button" aria-controls="horarios">09:00 — 20 vagas</div></div>' :
      '<div class="MuiFormControl-root"><label for="hora">Hora da visita</label><select id="hora"><option value="">Selecione</option><option value="09">09:00 — 20 vagas</option><option value="10" disabled>10:00 — Esgotado</option><option value="11">11:00 — 7 vagas</option></select></div>');
  const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'https://app.icdgrupo.com.br/apps/sales/bookings/new' });
  const w = dom.window;
  const dados = {};
  w.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  w.HTMLDialogElement.prototype.close = function () { this.open = false; };
  w.chrome = { storage: { local: { async get() { return structuredClone(dados); }, async set(valor) { Object.assign(dados, structuredClone(valor)); } } } };
  for (const f of ['reserva_date', 'cotacao', 'tarifario_import', 'disponibilidade_import']) vm.runInContext(fs.readFileSync(require.resolve(`../scripts/generated/${f}.js`), 'utf8'), dom.getInternalVMContext());
  return { w, api: w.ICDDisponibilidadeImport, dados };
}

test('importa todas as opções nativas com o texto completo e preserva o horário selecionado', async () => {
  const a = ambiente();
  try {
    const c = await a.api.capturar(a.w.document);
    assert.equal(c.opcoes.length, 3);
    assert.equal(c.opcoes[0].texto, '09:00 — 20 vagas');
    assert.equal(c.opcoes[1].desabilitada, true);
    assert.equal(c.contexto.dataVisita, '2026-10-31');
    assert.equal(a.w.document.getElementById('hora').value, '');
    assert.equal(a.dados.disponibilidadesICD, undefined);
    await a.api.salvar(c);
    assert.equal(a.dados.disponibilidadesICD.length, 1);
    await a.api.salvar(c);
    assert.equal(a.dados.disponibilidadesICD.length, 1);
  } finally { a.w.close(); }
});

test('menu MUI captura opções no portal sem clicar em um horário', async () => {
  const a = ambiente(true);
  try {
    const trigger = a.w.document.getElementById('hora');
    let clicks = 0;
    trigger.addEventListener('mousedown', () => {
      const lista = a.w.document.createElement('ul'); lista.id = 'horarios'; lista.setAttribute('role', 'listbox');
      lista.innerHTML = '<li role="option">09:00 — 20 vagas</li><li role="option" aria-disabled="true">10:00 — Esgotado</li>';
      lista.querySelectorAll('li').forEach(el => el.onclick = () => clicks++);
      lista.addEventListener('keydown', e => { if (e.key === 'Escape') lista.remove(); });
      a.w.document.body.append(lista);
    });
    const c = await a.api.capturar(a.w.document);
    assert.equal(c.opcoes.length, 2);
    assert.equal(clicks, 0);
    assert.equal(trigger.textContent, '09:00 — 20 vagas');
    assert.equal(a.w.document.getElementById('horarios'), null);
  } finally { a.w.close(); }
});

test('mudança da data antes de salvar bloqueia associação com o dia errado', async () => {
  const a = ambiente();
  try {
    const c = await a.api.capturar(a.w.document);
    a.w.document.querySelector('.MuiPickersDay-daySelected').textContent = '30';
    await assert.rejects(a.api.salvar(c), /seleção mudou/);
    assert.equal(a.dados.disponibilidadesICD, undefined);
  } finally { a.w.close(); }
});

test('copia mensagem para o cliente sem canal ou distribuidora e sem gravar no storage', async () => {
  const a = ambiente();
  try {
    let copiado;
    a.w.navigator.clipboard = { async writeText(texto) { copiado = texto; } };
    a.api.revisar(await a.api.capturar(a.w.document));
    const root = a.w.document.getElementById('icd-disponibilidade-previa').shadowRoot;
    root.getElementById('copiar').click();
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.match(copiado, /09:00 — 20 vagas/);
    assert.match(copiado, /31\/10\/2026/);
    assert.match(copiado, /sujeita a alteração/);
    assert.doesNotMatch(copiado, /OTA's|distribuidora/i);
    assert.equal(a.dados.disponibilidadesICD, undefined);
  } finally { a.w.close(); }
});

test('falha de clipboard mantém prévia disponível para cópia manual', async () => {
  const a = ambiente();
  try {
    a.w.navigator.clipboard = { async writeText() { throw Error('denied'); } };
    a.api.revisar(await a.api.capturar(a.w.document));
    const root = a.w.document.getElementById('icd-disponibilidade-previa').shadowRoot;
    root.getElementById('copiar').click();
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.match(root.getElementById('status').textContent, /manualmente/);
    assert.match(root.getElementById('mensagem').value, /HORÁRIOS E DISPONIBILIDADE/);
    assert.equal(root.getElementById('copiar').disabled, false);
  } finally { a.w.close(); }
});
