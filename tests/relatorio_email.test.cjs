const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');
const { criarLotesEmail } = require('../scripts/email_batches.js');
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
function ambiente() {
  const rows = ['Cliente@Example.test', 'cliente@example.test', 'outro@example.test'].map((email, i) => `<tr><td>Reserva ${i}</td><td>Cliente</td><td>${email}</td><td>Passeio</td></tr>`).join('');
  const dom = new JSDOM(`<table><tbody>${rows}</tbody></table>`, { runScripts: 'outside-only', url: 'https://report.ingressocomdesconto.com.br/adm/paginas/relatorio_passaportesE.asp?emp=1' });
  const w = dom.window;
  const salvos = []; const abas = [];
  let config = { emailAssunto: 'Aviso {{passeio}}', emailCorpo: 'Olá! Visita em {{data_visita}}, {{horario}}. Atenciosamente, {{operador}}.', nomeOperador: 'Operador Teste' };
  const persistido = {};
  const storage = { async get() { return structuredClone({ ...config, ...persistido }); },
    async set(dados) { Object.assign(persistido, structuredClone(dados)); salvos.push(dados); }, async remove(chave) { delete persistido[chave]; } };
  const lotes = criarLotesEmail(storage);
  w.chrome = { storage: { local: storage }, runtime: { async sendMessage(req) {
    try { return { ok: true, ...await lotes(req) }; } catch (erro) { return { ok: false, erro: erro.message }; }
  } } };
  w.open = () => { const aba = { location: { href: '' }, close() {} }; abas.push(aba); return aba; };
  for (const f of ['email_template', 'relatorio_email']) vm.runInContext(fs.readFileSync(require.resolve(`../scripts/generated/${f}.js`), 'utf8'), dom.getInternalVMContext());
  const revisoes = [];
  w.ICDOperacao = { async confirmar(resumo) { revisoes.push(resumo); return true; } };
  return { w, salvos, abas, revisoes, config: valor => { config = valor; }, root: () => w.document.getElementById('icd-relatorio-email').shadowRoot };
}

test('seleção em lote deduplica endereços e preenche modelo antes de preparar CCO', async () => {
  const a = ambiente();
  try {
    await tick();
    const root = a.root();
    for (const [campo, valor] of Object.entries({ passeio: 'Corcovado', data_visita: '2026-10-31', horario: '09:00' })) root.getElementById(campo).value = valor;
    root.getElementById('selecionar').click();
    assert.match(root.getElementById('contagem').textContent, /3 selecionadas · 2 e-mails únicos/);
    root.getElementById('preparar').click(); await tick();
    assert.equal(a.revisoes.length, 1);
    const dados = a.salvos.find(valor => valor.dadosParaEmail).dadosParaEmail;
    assert.equal(dados.modo, 'CCO');
    assert.equal(dados.email, 'cliente@example.test, outro@example.test');
    assert.match(dados.corpo, /31\/10\/2026, 09:00/);
    assert.equal(dados.assunto, 'Aviso Corcovado');
    assert.match(a.abas[0].location.href, /_action=compose/);
  } finally { a.w.close(); }
});

test('lote só avança após confirmação manual e pode ser retomado pelo progresso salvo', async () => {
  const a = ambiente();
  try {
    a.config({ emailAssunto: 'Aviso', emailCorpo: 'Mensagem' });
    const root = a.root(); root.getElementById('selecionar').click(); root.getElementById('preparar').click(); await tick();
    assert.match(root.getElementById('progresso-lotes').textContent, /Aguardando sua confirmação/);
    root.getElementById('atualizar-lotes').click(); await tick();
    assert.match(root.getElementById('progresso-lotes').textContent, /Lote 1 de 1/);
    assert.equal(a.abas.length, 1);
    root.getElementById('confirmar-lote').click(); await tick();
    assert.match(root.getElementById('progresso-lotes').textContent, /Concluído/);
    assert.equal(root.getElementById('preparar-lote').disabled, true);
  } finally { a.w.close(); }
});

test('cancelar revisão preserva dados e não abre webmail', async () => {
  const a = ambiente();
  try {
    a.config({ emailAssunto: 'Aviso', emailCorpo: 'Mensagem' });
    a.w.ICDOperacao.confirmar = async () => false;
    a.root().getElementById('selecionar').click();
    a.root().getElementById('preparar').click(); await tick();
    assert.equal(a.salvos.length, 0); assert.equal(a.abas.length, 0);
  } finally { a.w.close(); }
});

test('dados ausentes ou campos desconhecidos impedem mensagem incompleta', async () => {
  const a = ambiente();
  try {
    a.root().getElementById('selecionar').click();
    a.root().getElementById('preparar').click(); await tick();
    assert.match(a.root().getElementById('status').textContent, /Preencha Passeio/);
    assert.equal(a.salvos.length, 0);
    assert.throws(() => a.w.ICDEmailTemplate.preencher('Olá {{nome}}', {}), /desconhecido/);
    assert.equal(a.w.ICDEmailTemplate.preencher('Texto antigo sem campos', {}), 'Texto antigo sem campos');
  } finally { a.w.close(); }
});

test('busca seleciona somente encontrados e atualização da tabela não duplica controles', async () => {
  const a = ambiente();
  try {
    const root = a.root(); root.getElementById('busca').value = 'outro@example.test';
    root.getElementById('selecionar').click();
    assert.equal(a.w.document.querySelectorAll('.check-email-icd:checked').length, 1);
    const tbody = a.w.document.querySelector('tbody'); const linha = a.w.document.createElement('tr'); linha.innerHTML = '<td>Nova</td><td>novo@example.test</td>'; tbody.append(linha);
    await new Promise(resolve => setTimeout(resolve, 250));
    assert.equal(a.w.document.querySelectorAll('.check-email-icd').length, 4);
    root.getElementById('limpar').click();
    assert.equal(a.w.document.querySelectorAll('.check-email-icd:checked').length, 0);
  } finally { a.w.close(); }
});

test('marca passeio e intervalo inclusivo pela data prevista, ignorando validade do ingresso', async () => {
  const a = ambiente();
  try {
    const table = a.w.document.querySelector('table');
    const produto = 'TREM DO CORCOVADO SITE NOVO';
    table.innerHTML = '<tbody><tr><td>DATA<br>PREVISTA</td><td>CLIENTE</td><td>E-MAIL</td><td>PRODUTO / PROMOÇÃO</td><td>VALIDADE PRODUTO</td></tr>' +
      [['08:59', produto, '30/10/2026'], ['09:00', produto, '30/10/2026'], ['11:00', produto, '30/10/2026'],
        ['11:01', produto, '30/10/2026'], ['10:00', 'OUTRO PASSEIO', '30/10/2026'], ['10:00', produto, '31/10/2026']]
        .map(([hora, p, dia], i) => `<tr><td>${dia}<br>${hora}</td><td>Cliente</td><td>cliente${i}@example.test</td><td>${p}</td><td>31/10/2027</td></tr>`).join('') + '</tbody>';
    await new Promise(resolve => setTimeout(resolve, 250));
    const root = a.root();
    root.getElementById('filtro-passeio').value = produto;
    root.getElementById('filtro-data').value = '2026-10-30';
    root.getElementById('filtro-inicio').value = '09:00'; root.getElementById('filtro-fim').value = '11:00';
    root.getElementById('selecionar-faixa').click();
    assert.deepEqual([...a.w.document.querySelectorAll('.check-email-icd:checked')].map(el => el.value), ['cliente1@example.test', 'cliente2@example.test']);
    assert.equal(root.getElementById('horario').value, '09:00 às 11:00');
    root.getElementById('filtro-fim').value = '';
    root.getElementById('selecionar-faixa').click();
    assert.equal(a.w.document.querySelectorAll('.check-email-icd:checked').length, 3);
    assert.equal(root.getElementById('horario').value, 'a partir das 09:00');
  } finally { a.w.close(); }
});

test('intervalo invertido mantém seleção e relatório sem cabeçalhos não é adivinhado', () => {
  const a = ambiente();
  try {
    const root = a.root(); root.getElementById('selecionar').click();
    root.getElementById('filtro-passeio').value = 'Passeio';
    root.getElementById('filtro-inicio').value = '11:00'; root.getElementById('filtro-fim').value = '09:00';
    root.getElementById('selecionar-faixa').click();
    assert.equal(a.w.document.querySelectorAll('.check-email-icd:checked').length, 3);
    root.getElementById('filtro-fim').value = '12:00'; root.getElementById('selecionar-faixa').click();
    assert.equal(a.w.document.querySelectorAll('.check-email-icd:checked').length, 3);
    assert.match(root.getElementById('resultado-faixa').textContent, /seleção anterior foi mantida/);
  } finally { a.w.close(); }
});

test('título do bloco agrupa produtos diferentes sem selecionar reservas do próximo título ou tabela', async () => {
  const a = ambiente();
  try {
    const titulo = nome => `<tr><td colspan="9" bgcolor="#999999"><div align="center"><span class="style8">${nome}&nbsp;</span></div></td></tr>`;
    const headers = '<tr><td>DATA<br>PREVISTA</td><td>CLIENTE</td><td>E-MAIL</td><td>PRODUTO / PROMOÇÃO</td></tr>';
    const reserva = (id, hora, produto) => `<tr><td>30/10/2026<br>${hora}</td><td>Cliente</td><td>${id}@example.test</td><td>${produto}</td></tr>`;
    a.w.document.querySelector('table').outerHTML = '<table><tbody>' + titulo('0TREM DO CORCOVADO') + headers +
      reserva('primeiro', '09:00', 'TREM SITE NOVO') + reserva('segundo', '10:30', 'TREM PROMOÇÃO') + reserva('cedo', '08:00', 'TREM SITE NOVO') +
      titulo('OUTRA ATRAÇÃO') + headers + reserva('outro', '10:00', 'TREM SITE NOVO') + '</tbody></table>' +
      '<table><tbody>' + titulo('TERCEIRA ATRAÇÃO') + headers + reserva('terceiro', '10:00', 'TREM SITE NOVO') + '</tbody></table>';
    await new Promise(resolve => setTimeout(resolve, 250));
    const root = a.root();
    const select = root.getElementById('filtro-passeio');
    assert.deepEqual([...select.options].map(el => el.value), ['', '0TREM DO CORCOVADO', 'OUTRA ATRAÇÃO', 'TERCEIRA ATRAÇÃO']);
    select.value = '0TREM DO CORCOVADO';
    root.getElementById('filtro-inicio').value = '09:00'; root.getElementById('filtro-fim').value = '11:00';
    root.getElementById('selecionar-faixa').click();
    assert.deepEqual([...a.w.document.querySelectorAll('.check-email-icd:checked')].map(el => el.value), ['primeiro@example.test', 'segundo@example.test']);
    assert.equal(root.getElementById('passeio').value, '0TREM DO CORCOVADO');
    root.getElementById('isolar-passeio').click();
    assert.equal(a.w.document.querySelectorAll('table').length, 1);
    assert.equal(a.w.document.querySelectorAll('.check-email-icd').length, 3);
    assert.equal(a.w.document.querySelectorAll('.check-email-icd:checked').length, 2);
    assert.doesNotMatch(a.w.document.body.textContent, /OUTRA ATRAÇÃO|TERCEIRA ATRAÇÃO|outro@example/);
    assert.match(a.w.document.body.textContent, /0TREM DO CORCOVADO/);
    assert.equal(root.getElementById('restaurar-pagina').hidden, false);
    root.getElementById('selecionar-faixa').click();
    assert.equal(a.w.document.querySelectorAll('.check-email-icd:checked').length, 2);
    let alteracoes = 0;
    const observador = new a.w.MutationObserver(() => { alteracoes++; });
    observador.observe(a.w.document.body, { childList: true, subtree: true });
    await new Promise(resolve => setTimeout(resolve, 500));
    assert.equal(alteracoes, 0, 'o painel não deve provocar releituras contínuas do relatório');
    observador.disconnect();
  } finally { a.w.close(); }
});

test('alterações fora do relatório e buscas não provocam varreduras das tabelas', async () => {
  const a = ambiente();
  try {
    const doc = a.w.document;
    const original = doc.querySelectorAll.bind(doc);
    let varreduras = 0;
    doc.querySelectorAll = function(seletor) {
      if (seletor === 'table tr' || seletor === '.check-email-icd') varreduras++;
      return original(seletor);
    };
    const aviso = doc.createElement('aside'); aviso.textContent = 'Janela de revisão'; doc.body.append(aviso);
    const root = a.root();
    root.getElementById('busca').value = 'outro@example.test';
    root.getElementById('busca').dispatchEvent(new a.w.Event('input'));
    await new Promise(resolve => setTimeout(resolve, 300));
    assert.match(root.getElementById('contagem').textContent, /1 linhas encontradas/);
    assert.equal(varreduras, 0);
    root.getElementById('selecionar').click();
    assert.equal(original('.check-email-icd:checked').length, 1);
    assert.equal(varreduras, 0);
  } finally { a.w.close(); }
});

test('relatório grande libera o navegador entre blocos e não cria botões por reserva', async () => {
  const a = ambiente();
  try {
    const tabela = a.w.document.querySelector('table');
    tabela.innerHTML = '<tbody><tr><td>DATA PREVISTA</td><td>E-MAIL</td><td>PRODUTO</td></tr>' +
      Array.from({ length: 350 }, (_, i) => `<tr><td>30/10/2026 09:00</td><td>p${i}@example.test</td><td>Trem</td></tr>`).join('') + '</tbody>';
    const root = a.root();
    let viuPausa = false;
    const limite = Date.now() + 8000;
    while (Date.now() < limite) {
      await new Promise(resolve => setTimeout(resolve, 5));
      if (root.getElementById('selecionar').disabled) viuPausa = true;
      if (viuPausa && !root.getElementById('selecionar').disabled) break;
    }
    assert.equal(viuPausa, true, 'a leitura deve ceder tempo ao navegador');
    assert.equal(root.getElementById('selecionar').disabled, false);
    assert.equal(tabela.querySelectorAll('.check-email-icd').length, 350);
    assert.equal(tabela.querySelectorAll('button').length, 0);
    root.getElementById('selecionar').click();
    assert.match(root.getElementById('contagem').textContent, /350 selecionadas/);
  } finally { a.w.close(); }
});
