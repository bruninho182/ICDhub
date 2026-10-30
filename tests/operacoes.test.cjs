const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');
const arquivo = nome => fs.readFileSync(require.resolve('../' + nome), 'utf8');
const email = { email: 'cliente@example.test', assunto: 'Voucher 123 - Cliente', corpo: 'Olá!\nSeu voucher está pronto. <texto literal>' };
function ambiente(html = '<input name="_to"><input name="_subject"><textarea id="composebody">Assinatura</textarea>') {
  const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'https://webmail-seguro.com.br/?_action=compose' });
  const w = dom.window;
  let pendente = { ...email };
  let removidos = 0;
  w.chrome = { storage: { local: { async get() { return { dadosParaEmail: pendente }; }, async remove() { removidos++; pendente = undefined; } }, onChanged: { addListener() {} } } };
  w.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  w.HTMLDialogElement.prototype.close = function () { this.open = false; };
  for (const f of ['operacao_review', 'email_compose']) vm.runInContext(arquivo(`scripts/generated/${f}.js`), dom.getInternalVMContext());
  return { w, contexto: dom.getInternalVMContext(), api: w.ICDEmail, removidos: () => removidos, pendente: valor => { pendente = valor; } };
}

test('e-mail não preenche sem revisão; aplicação preserva assinatura e consome somente após preencher', async () => {
  const a = ambiente();
  try {
    assert.equal(a.w.document.querySelector('[name=_to]').value, '');
    assert.equal(a.removidos(), 0);
    await a.api.aplicar(email);
    assert.equal(a.w.document.querySelector('[name=_to]').value, email.email);
    assert.equal(a.w.document.getElementById('composebody').value, email.corpo + '\n\nAssinatura');
    assert.equal(a.removidos(), 1);
  } finally { a.w.close(); }
});

test('CCO espera campo abrir e preenche destinatários ocultos', async () => {
  const a = ambiente('<input name="_to"><input name="_subject"><button class="add-bcc">CCO</button><textarea id="composebody"></textarea>');
  try {
    a.w.document.querySelector('button.add-bcc').onclick = () => {
      const input = a.w.document.createElement('textarea'); input.name = '_bcc'; a.w.document.body.append(input);
    };
    const dados = { ...email, modo: 'CCO', email: 'a@example.test, b@example.test' }; a.pendente(dados);
    await a.api.aplicar(dados);
    assert.equal(a.w.document.querySelector('[name=_bcc]').value, dados.email);
    assert.equal(a.w.document.querySelector('[name=_to]').value, '');
  } finally { a.w.close(); }
});

test('editor ausente ou rascunho divergente preserva dados pendentes', async () => {
  for (const html of ['<input name="_to"><input name="_subject">', '<input name="_to" value="outro@example.test"><input name="_subject"><textarea id="composebody">Rascunho</textarea>']) {
    const a = ambiente(html);
    try { await assert.rejects(a.api.aplicar(email)); assert.equal(a.removidos(), 0); }
    finally { a.w.close(); }
  }
});

test('editor HTML preserva assinatura e trata mensagem como texto, sem duplicar', async () => {
  const a = ambiente('<input name="_to"><input name="_subject"><iframe id="composebody_ifr"></iframe>');
  try {
    const doc = a.w.document.querySelector('iframe').contentDocument;
    doc.body.innerHTML = '<p id="assinatura">Equipe ICD</p>';
    await a.api.aplicar(email); await a.api.aplicar(email);
    assert.equal(doc.querySelectorAll('[data-icd-email]').length, 1);
    assert.equal(doc.getElementById('assinatura').textContent, 'Equipe ICD');
    assert.match(doc.querySelector('[data-icd-email]').textContent, /<texto literal>/);
    assert.equal(doc.querySelector('texto'), null);
  } finally { a.w.close(); }
});

test('novo e-mail pendente não é removido ao concluir o anterior', async () => {
  const a = ambiente();
  try {
    a.pendente({ ...email, assunto: 'Outro voucher' });
    await a.api.aplicar(email); assert.equal(a.removidos(), 0);
  } finally { a.w.close(); }
});

test('conferência operacional cancela sem ação e exibe dados como texto', async () => {
  const a = ambiente();
  try {
    const promessa = a.w.ICDOperacao.confirmar({ titulo: 'Conferir', descricao: 'Descrição', campos: [['Cliente', '<img src=x>']], acao: 'Continuar' });
    const root = a.w.document.getElementById('icd-operacao-review').shadowRoot;
    assert.equal(root.querySelector('dd').textContent, '<img src=x>');
    assert.equal(root.querySelector('img'), null);
    root.getElementById('cancelar').click(); assert.equal(await promessa, false);
  } finally { a.w.close(); }
});

test('remarcação só persiste os dados após confirmação sem mudar a regra aplicada', async () => {
  const a = ambiente();
  try {
    let salvo;
    a.w.alert = () => {}; a.w.setTimeout = () => 0;
    a.w.chrome.storage.local.get = async () => ({ nomeOperador: 'Operador' });
    a.w.chrome.storage.local.set = async valor => { salvo = valor; };
    vm.runInContext(arquivo('scripts/remarcacao_tool.js'), a.contexto);
    a.w.extrairVoucher = () => '12345678-1';
    a.w.extrairEmail = () => 'cliente@example.test';
    a.w.extrairUnidade = () => 'eCommerce';
    a.w.extrairRefExterna = () => 'Ref';
    a.w.extrairMetodoPagamento = () => 'pix';
    a.w.ICDOperacao.confirmar = async () => false;
    await a.w.processarRemarcacao(); assert.equal(salvo, undefined);
    a.w.ICDOperacao.confirmar = async () => true;
    await a.w.processarRemarcacao();
    assert.equal(salvo.remarcacaoDados.voucher, '12345678-1');
    assert.equal(salvo.remarcacaoDados.usarRefExterna, false);
  } finally { a.w.close(); }
});

test('registro PIX exige conferência antes de enviar dados à planilha', async () => {
  const label = (nome, valor) => `<div class="MuiGrid-item"><p>${nome}</p><p>${valor}</p></div>`;
  const a = ambiente('<button>Cancelar Reserva</button><span class="MuiChip-label">12345678-1</span><p style="font-weight: 600">Trem do Corcovado</p>' +
    label('E-mail:', 'cliente@example.test') + label('Método de pagamento:', 'PIX') + label('Código da transação:', 'PIX123'));
  try {
    a.w.alert = () => {};
    const enviados = [];
    a.w.chrome.runtime = { sendMessage(msg, cb) { enviados.push(msg); cb({ ok: true, linha: 2 }); } };
    a.w.chrome.storage.local.get = (keys, cb) => { const dados = { icdRefundButtonsEnabled: true }; if (cb) cb(dados); return Promise.resolve(dados); };
    a.w.ICDOperacao.confirmar = async () => false;
    vm.runInContext(arquivo('scripts/icd_sheet_icdgrupo.js'), a.contexto);
    const botao = a.w.document.getElementById('icdhub-btn-coletar-icd');
    assert.ok(botao);
    botao.click(); await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(enviados.length, 0);
    a.w.ICDOperacao.confirmar = async () => true;
    botao.click(); await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(enviados.length, 1);
    assert.equal(enviados[0].acao, 'ENVIAR_LINHA_PLANILHA');
    assert.equal(enviados[0].linha.E, '12345678-1');
  } finally { a.w.close(); }
});
