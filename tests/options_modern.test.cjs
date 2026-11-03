const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');
const tick = () => new Promise(resolve => setTimeout(resolve, 0));

async function ambiente() {
  const html = fs.readFileSync(require.resolve('../options.html'), 'utf8');
  const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'https://preview.test/options.html' });
  const w = dom.window;
  const dados = { listaPastas: ['Pagamentos'], configMaster: [
    { id: '1', nome: 'PIX', texto: 'Mensagem para pagamento', pasta: 'Pagamentos' },
    { id: '2', nome: 'Voucher', texto: 'Ingresso disponível', pasta: 'Geral' },
  ], listaPasseios: [{ nome: 'Pão de Açúcar', ingressos: [{ tipo: 'Adulto', valor: 100 }] }] };
  const listeners = new Set();
  w.scrollTo = () => {}; w.HTMLElement.prototype.scrollIntoView = () => {};
  w.alert = () => {}; w.confirm = () => true;
  w.chrome = { storage: { local: {
    get(keys, cb) { const res = structuredClone(keys === null ? dados : Object.fromEntries((Array.isArray(keys) ? keys : [keys]).map(k => [k, dados[k]]))); if (cb) cb(res); return Promise.resolve(res); },
    set(value, cb) { Object.assign(dados, structuredClone(value)); for (const fn of listeners) fn(Object.fromEntries(Object.keys(value).map(k => [k, {}])), 'local'); if (cb) cb(); return Promise.resolve(); },
  }, onChanged: { addListener(fn) { listeners.add(fn); } } } };
  for (const file of ['scripts/generated/cotacao.js', 'scripts/generated/email_template.js', 'scripts/options.js', 'scripts/generated/options_modern.js']) {
    vm.runInContext(fs.readFileSync(require.resolve('../' + file), 'utf8'), dom.getInternalVMContext());
  }
  await tick();
  return { w, dados, el: id => w.document.getElementById(id) };
}

test('painel carrega cadastros existentes sem regravar ou alterar estrutura', async () => {
  const a = await ambiente();
  try {
    assert.equal(a.el('resumo-config').querySelector('strong').textContent, '2');
    assert.equal(a.el('listaBotoes').querySelectorAll('[data-filtro]').length, 2);
    assert.equal(a.dados.configMaster[0]._originalIndex, undefined);
    assert.equal(a.dados.listaPasseios[0].ingressos[0].valor, 100);
    assert.equal(a.el('previa-atalho').textContent, 'Sua mensagem aparecerá aqui enquanto você digita.');
  } finally { a.w.close(); }
});

test('buscas filtram sem mudar índices de edição e prévia preserva texto literal', async () => {
  const a = await ambiente();
  try {
    const busca = a.el('buscar-atalhos-config'); busca.value = 'disponivel'; busca.dispatchEvent(new a.w.Event('input'));
    const itens = [...a.el('listaBotoes').querySelectorAll('[data-filtro]')];
    assert.equal(itens[0].hidden, true); assert.equal(itens[1].hidden, false);
    itens[1].querySelector('.btn-edit').click(); await tick();
    assert.equal(a.el('editIndex').value, '1');
    const texto = a.el('novoTextoBotao'); texto.value = '<img src=x onerror=alert(1)>\nMensagem'; texto.dispatchEvent(new a.w.Event('input'));
    assert.equal(a.el('previa-atalho').querySelector('img'), null);
    assert.match(a.el('previa-atalho').textContent, /<img/);
    const passeios = a.el('buscar-passeios-config'); passeios.value = 'pao'; passeios.dispatchEvent(new a.w.Event('input'));
    assert.equal(a.el('lista-passeios-config').querySelector('[data-filtro]').hidden, false);
  } finally { a.w.close(); }
});

test('cancelar edição do tarifário volta a criar novo passeio e rejeita valores negativos', async () => {
  const a = await ambiente();
  try {
    a.el('lista-passeios-config').querySelector('.btn-editar-p').click();
    assert.equal(a.el('btn-cancelar-passeio').hidden, false);
    a.el('btn-cancelar-passeio').click();
    assert.equal(a.el('nomePasseio').value, '');
    a.el('nomePasseio').value = 'Novo passeio';
    a.w.document.querySelector('.tipo-ingresso').value = 'Adulto';
    a.w.document.querySelector('.valor-ingresso').value = '-1';
    a.el('btn-salvar-passeio').click(); await tick();
    assert.equal(a.dados.listaPasseios.length, 1);
    a.w.document.querySelector('.valor-ingresso').value = '0';
    a.el('btn-salvar-passeio').click(); await tick();
    assert.equal(a.dados.listaPasseios.length, 2);
    assert.equal(a.dados.listaPasseios[0].nome, 'Pão de Açúcar');
    assert.equal(a.dados.listaPasseios[1].ingressos[0].valor, 0);
  } finally { a.w.close(); }
});

test('abas respondem ao teclado e atualizam acessibilidade e link direto', async () => {
  const a = await ambiente();
  try {
    const tabs = a.w.document.querySelectorAll('.tab-btn');
    tabs[0].dispatchEvent(new a.w.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    assert.equal(tabs[1].getAttribute('aria-selected'), 'true');
    assert.equal(a.w.location.hash, '#sec-cotacao');
    assert.equal(a.el('sec-cotacao').classList.contains('active'), true);
  } finally { a.w.close(); }
});

test('edição manual de tarifário importado mantém a consulta original e registra a edição', async () => {
  const a = await ambiente();
  try {
    a.dados.listaPasseios[0].contexto = { origem: 'ICD', canal: 'Call Center', distribuidora: '',
      fornecedor: 'Bondinho', modalidade: '', dataVisita: '2026-10-31', horario: '', consultadoEm: '2026-10-30T15:00:00Z' };
    a.w.renderizarListaPasseios();
    assert.doesNotMatch(a.el('lista-passeios-config').textContent, /Importado do ICD/);
    a.el('lista-passeios-config').querySelector('.btn-editar-p').click();
    a.w.document.querySelector('.valor-ingresso').value = '150';
    a.el('btn-salvar-passeio').click(); await tick();
    const p = a.dados.listaPasseios[0];
    assert.equal(p.contexto.consultadoEm, '2026-10-30T15:00:00Z');
    assert.ok(p.contexto.editadoManualmenteEm);
    assert.equal(p.ingressos[0].valor, 150);
  } finally { a.w.close(); }
});

test('atalho mantém idiomas ao editar, permite removê-los e busca o texto traduzido', async () => {
  const a = await ambiente();
  try {
    a.el('listaBotoes').querySelector('.btn-edit').click();
    a.el('novoTextoEspanhol').value = 'Su pago está confirmado';
    a.el('novoTextoIngles').value = '<b>Your payment is confirmed</b>';
    a.el('idioma-previa-atalho').value = 'en';
    a.el('idioma-previa-atalho').dispatchEvent(new a.w.Event('change'));
    assert.equal(a.el('previa-atalho').textContent, '<b>Your payment is confirmed</b>');
    assert.equal(a.el('previa-atalho').querySelector('b'), null);
    a.el('btnAdicionarBotao').click(); await tick();
    assert.equal(a.dados.configMaster.length, 2);
    assert.equal(a.dados.configMaster[0].texto, 'Mensagem para pagamento');
    assert.equal(a.dados.configMaster[0].traducoes.es, 'Su pago está confirmado');
    const busca = a.el('buscar-atalhos-config'); busca.value = 'payment'; busca.dispatchEvent(new a.w.Event('input'));
    assert.equal(a.el('listaBotoes').querySelector('[data-filtro]').hidden, false);
    a.el('listaBotoes').querySelector('.btn-edit').click(); await tick();
    assert.equal(a.el('novoTextoIngles').value, '<b>Your payment is confirmed</b>');
    a.el('novoTextoIngles').value = '';
    a.el('btnAdicionarBotao').click(); await tick();
    assert.equal(a.dados.configMaster[0].traducoes.en, '');
    assert.equal(a.dados.configMaster[0].traducoes.es, 'Su pago está confirmado');
    a.el('btnCancelarEdicao').click();
    assert.equal(a.el('novoTextoEspanhol').value, '');
  } finally { a.w.close(); }
});

test('salva português e depois espanhol no mesmo botão sem perder textos nem duplicar registro', async () => {
  const a = await ambiente();
  try {
    a.el('novoNomeBotao').value = 'Confirmar reserva';
    a.el('novoTextoBotao').value = 'Sua reserva foi confirmada';
    a.el('btnAdicionarBotao').click(); await tick();
    const index = a.el('editIndex').value;
    assert.notEqual(index, '-1');
    const idioma = a.el('idioma-previa-atalho');
    idioma.value = 'es'; idioma.dispatchEvent(new a.w.Event('change'));
    assert.equal(a.el('novoTextoBotao').hidden, true);
    assert.equal(a.el('novoTextoEspanhol').hidden, false);
    a.el('novoTextoEspanhol').value = 'Su reserva está confirmada';
    a.el('novoTextoEspanhol').dispatchEvent(new a.w.Event('input'));
    a.el('btnAdicionarBotao').click(); await tick();
    assert.equal(a.dados.configMaster.length, 3);
    assert.equal(a.el('editIndex').value, index);
    assert.equal(idioma.value, 'es');
    assert.equal(a.dados.configMaster[index].texto, 'Sua reserva foi confirmada');
    assert.equal(a.dados.configMaster[index].traducoes.es, 'Su reserva está confirmada');
    idioma.value = 'pt'; idioma.dispatchEvent(new a.w.Event('change'));
    assert.equal(a.el('novoTextoBotao').hidden, false);
    assert.equal(a.el('novoTextoBotao').value, 'Sua reserva foi confirmada');
    a.el('btnCancelarEdicao').click();
    assert.equal(a.el('editIndex').value, '-1');
    assert.equal(a.el('novoTextoEspanhol').value, '');
  } finally { a.w.close(); }
});

test('recibo aceita Documento sem máscara e imprime Documento no texto do PDF', async () => {
  const a = await ambiente();
  try {
    const tipo = a.el('reciboTipoDocumento'); const numero = a.el('reciboDocumento');
    assert.ok([...tipo.options].some(o => o.value === 'DOCUMENTO' && o.textContent === 'Documento'));
    tipo.value = 'DOCUMENTO'; tipo.dispatchEvent(new a.w.Event('change'));
    numero.value = 'RG AB-12.345 / Exterior'; numero.dispatchEvent(new a.w.Event('input'));
    assert.equal(numero.value, 'RG AB-12.345 / Exterior');
    assert.equal(numero.hasAttribute('maxlength'), false);
    const textos = []; let salvo;
    a.w.jspdf = { jsPDF: function () { return new Proxy({}, { get(_target, propriedade) {
      if (propriedade === 'text') return texto => textos.push(Array.isArray(texto) ? texto.join('\n') : texto);
      if (propriedade === 'splitTextToSize') return texto => [texto];
      if (propriedade === 'save') return nome => { salvo = nome; };
      return () => {};
    } }); } };
    a.el('reciboNome').value = 'Cliente Teste'; a.el('reciboVoucher').value = 'TESTE';
    a.w.gerarReciboPDF();
    assert.match(textos.join('\n'), /portador do Documento: RG AB-12\.345 \/ Exterior/);
    assert.equal(salvo, 'RECIBO - TESTE.pdf');
    tipo.value = 'CPF'; tipo.dispatchEvent(new a.w.Event('change'));
    numero.value = '12345678901'; numero.dispatchEvent(new a.w.Event('input'));
    assert.equal(numero.value, '123.456.789-01');
    assert.equal(numero.maxLength, 14);
  } finally { a.w.close(); }
});
