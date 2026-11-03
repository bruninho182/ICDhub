const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');

function ambiente() {
  const dom = new JSDOM('<main></main>', { runScripts: 'outside-only', url: 'https://app.icdgrupo.com.br/apps/sales/bookings/new' });
  const w = dom.window;
  const historico = [];
  w.chrome = { storage: { local: { async get() { return {}; } } } };
  const timer = w.setTimeout.bind(w);
  w.setTimeout = (fn, ms) => timer(fn, ms === 100 || ms === 150 || ms === 200 ? 0 : ms);
  for (const f of ['reserva_date', 'fornecedor_map', 'ota_prepare']) {
    vm.runInContext(fs.readFileSync(require.resolve(`../scripts/generated/${f}.js`), 'utf8'), dom.getInternalVMContext());
  }
  function campo(rotulo, opcoes, valor = '', selecionado = () => {}) {
    const id = `campo-${historico.length}-${w.document.querySelectorAll('label').length}`;
    const bloco = w.document.createElement('div');
    bloco.className = 'MuiAutocomplete-root'; bloco.setAttribute('role', 'combobox');
    bloco.setAttribute('aria-expanded', 'false'); bloco.setAttribute('aria-owns', `${id}-list`);
    const label = w.document.createElement('label'); label.htmlFor = id; label.textContent = rotulo;
    const input = w.document.createElement('input'); input.id = id; input.value = valor;
    bloco.append(label, input); w.document.body.append(bloco);
    input.addEventListener('input', () => {
      w.document.getElementById(`${id}-list`)?.remove();
      bloco.setAttribute('aria-expanded', 'true');
      const lista = w.document.createElement('ul'); lista.id = `${id}-list`; lista.setAttribute('role', 'listbox');
      for (const nome of opcoes) {
        const item = w.document.createElement('li'); item.setAttribute('role', 'option'); item.textContent = nome;
        item.onclick = () => { input.value = nome; bloco.setAttribute('aria-expanded', 'false'); lista.remove(); historico.push([rotulo, nome]); selecionado(nome); };
        lista.append(item);
      }
      w.document.body.append(lista);
    });
    return input;
  }
  function calendario({ ano = 2026, mes = 11, disabled = false, hiddenOnly = false, confirmar = true } = {}) {
    const bloco = w.document.createElement('div'); bloco.className = 'MuiGrid-item';
    bloco.innerHTML = '<h6>4. Data da visita</h6><div class="MuiPickersStaticWrapper-staticWrapperRoot"></div>';
    w.document.body.append(bloco);
    const meses = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
    let indice = ano * 12 + mes;
    const root = bloco.lastElementChild;
    function render() {
      root.innerHTML = '<div class="MuiPickersCalendarHeader-switchHeader"><button>anterior</button><p></p><button>próximo</button></div><div class="dias"></div>';
      root.querySelector('p').textContent = `${meses[indice % 12]} ${Math.floor(indice / 12)}`;
      const setas = root.querySelectorAll('button');
      setas[0].onclick = () => { indice--; render(); };
      setas[1].onclick = () => { indice++; render(); };
      for (let dia = 1; dia <= 31; dia++) {
        const btn = w.document.createElement('button'); btn.className = 'MuiPickersDay-day'; btn.textContent = dia;
        if (disabled) btn.classList.add('MuiPickersDay-dayDisabled');
        if (hiddenOnly) btn.classList.add('MuiPickersDay-hidden');
        btn.onclick = () => { historico.push(['data', `${Math.floor(indice / 12)}-${indice % 12 + 1}-${dia}`]); if (confirmar) btn.classList.add('MuiPickersDay-daySelected'); };
        root.querySelector('.dias').append(btn);
      }
    }
    render();
  }
  return { w, api: w.ICDOTAPrepare, datas: w.ICDReservaDate, historico, campo, calendario };
}

test('datas em inglês, português e ISO não dependem de fuso nem Date.parse', () => {
  const a = ambiente();
  try {
    for (const valor of ['Oct 31, 2026 (Valid: 1 day)', '31/10/2026', '31 de outubro de 2026', '2026-10-31']) {
      assert.equal(a.datas.normalizar(valor), '2026-10-31');
    }
    assert.equal(a.datas.normalizar('Feb 29, 2027'), '');
    assert.equal(a.datas.normalizar('2026-02-31'), '');
    assert.equal(a.datas.normalizar('10/31/2026'), '');
  } finally { a.w.close(); }
});

test('data de atividade aceita horário e dia da semana sem alterar o dia local', () => {
  const a = ambiente();
  try {
    for (const valor of ['Nov 25, 2026, 11:30 AM', 'Wednesday, Nov 25, 2026 at 11:30 AM',
      '25 nov. 2026, 11:30', '2026-11-25T23:30:00-03:00', 'Nov 25, 2026 (Valid: 1 day)']) {
      assert.equal(a.datas.extrair(valor), '2026-11-25');
    }
    assert.equal(a.datas.extrair('Nov 25, 2026 - Nov 26, 2026'), '');
    assert.equal(a.datas.extrair('Feb 30, 2026 at 11:30 AM'), '');
  } finally { a.w.close(); }
});

test('Bondinho seleciona somente Acesso Rápido para Skip the Line, sem escolher Amanhecer', async () => {
  for (const [modalidade, esperado] of [
    ['Skip the Line Ticket | Skip-the-Line Cable Car Ticket', 'Acesso Rápido'],
    ['Standard Ticket | Cable Car Ticket', 'Bilhete Normal'],
    ['', 'Bilhete Normal'],
  ]) {
    const a = ambiente();
    try {
      a.campo('Canal de venda', [], "OTA's");
      a.campo('Unidade Distribuidora', [], '000 GetYourGuide');
      a.campo('Selecione o fornecedor', ['Bondinho Pão de Açúcar'], '', () => {
        a.campo('Selecione o passeio', ['Bilhete Normal', 'Amanhecer', 'Acesso rápido e amanhecer', 'Acesso Rápido'], '', () => {
          a.calendario({ mes: 9 });
        });
      });
      await a.api.preparar({ origem: 'GETYOURGUIDE', passeio: 'Rio de Janeiro: Sugarloaf Cable Car',
        modalidade, dataVisita: '2026-10-31' }, () => {});
      assert.deepEqual(a.historico.slice(1), [['Selecione o passeio', esperado], ['data', '2026-10-31']]);
    } finally { a.w.close(); }
  }
});

test('outra atração com passeio obrigatório interrompe antes de escolher a data', async () => {
  const a = ambiente();
  try {
    a.campo('Canal de venda', [], "OTA's");
    a.campo('Unidade Distribuidora', [], '000 GetYourGuide');
    a.campo('Selecione o fornecedor', [], 'Tour Maracanã');
    a.campo('Selecione o passeio', ['Visita Teste']);
    a.calendario();
    await assert.rejects(a.api.preparar({ origem: 'GETYOURGUIDE', fornecedor: 'Tour Maracanã',
      dataVisita: '2026-12-03' }, () => {}), /selecionar o passeio antes da data/);
    assert.equal(a.historico.length, 0);
  } finally { a.w.close(); }
});

test('Maracanã seleciona sempre Tour Regular, inclusive Monitored Tour, antes da data', async () => {
  const titulo = 'Rio de Janeiro: Maracanã Stadium Entrance Ticket';
  for (const [passeio, modalidade, esperado] of [
    [titulo, titulo, 'Tour Regular'],
    [titulo, `Monitored Tour | ${titulo}`, 'Tour Regular'],
    [`Monitored Tour | ${titulo}`, '', 'Tour Regular'],
    [titulo, 'Standard Ticket', 'Tour Regular'],
    [titulo, '', 'Tour Regular'],
  ]) {
    const a = ambiente();
    try {
      a.campo('Canal de venda', [], "OTA's");
      a.campo('Unidade Distribuidora', [], '000 GetYourGuide');
      a.campo('Selecione o fornecedor', ['Tour Maracanã'], '', () => {
        a.campo('Selecione o passeio', ['Tour Regular', 'Tour Guiado'], '', () => a.calendario({ mes: 10 }));
      });
      await a.api.preparar({ origem: 'GETYOURGUIDE', passeio, modalidade, dataVisita: '2026-11-25' }, () => {});
      assert.deepEqual(a.historico, [['Selecione o fornecedor', 'Tour Maracanã'],
        ['Selecione o passeio', esperado], ['data', '2026-11-25']]);
    } finally { a.w.close(); }
  }
});

test('prepara campos na ordem e navega meses até a data correta sem tocar no horário', async () => {
  const a = ambiente();
  try {
    a.campo('Canal de venda', ["OTA's", 'Call Center']);
    a.campo('Unidade Distribuidora', ['000 GetYourGuide']);
    a.campo('Selecione o fornecedor', ['Fornecedor Teste']);
    const hora = a.campo('Hora da visita', ['09:00'], '10:00');
    a.calendario();
    await a.api.preparar({ origem: 'GETYOURGUIDE', fornecedor: 'Fornecedor Teste', dataVisita: '2026-10-31' }, () => {});
    assert.deepEqual(a.historico, [ ['Canal de venda', "OTA's"], ['Unidade Distribuidora', '000 GetYourGuide'],
      ['Selecione o fornecedor', 'Fornecedor Teste'], ['data', '2026-10-31'] ]);
    assert.equal(hora.value, '10:00');
  } finally { a.w.close(); }
});

test('nome parcial não escolhe fornecedor parecido; falha restaura o texto anterior', async () => {
  const a = ambiente();
  try {
    const input = a.campo('Selecione o fornecedor', ['Fornecedor Teste Plus'], 'Original');
    await assert.rejects(a.api.selecionar('Selecione o fornecedor', 'Fornecedor Teste'), /não encontrada/);
    assert.equal(input.value, 'Original');
    assert.equal(a.historico.length, 0);
  } finally { a.w.close(); }
});

test('fornecedor sem correspondência definida deixa calendário para seleção manual', async () => {
  const a = ambiente();
  try {
    a.campo('Canal de venda', [], "OTA's");
    a.campo('Unidade Distribuidora', [], '000 GetYourGuide');
    await assert.rejects(a.api.preparar({ origem: 'GETYOURGUIDE', dataVisita: '2026-10-31' }, () => {}), /nome exato/);
    assert.equal(a.historico.length, 0);
  } finally { a.w.close(); }
});

test('regressão do vídeo: associa Sugarloaf e aguarda fornecedor antes do calendário', async () => {
  const a = ambiente();
  try {
    a.campo('Canal de venda', [], "OTA's");
    a.campo('Unidade Distribuidora', [], '000 GetYourGuide');
    a.campo('Selecione o fornecedor', ['AquaRio Porto Maravilha', 'Bondinho Pão de Açúcar', 'Trem do Corcovado'], '', () => {
      a.campo('Selecione o passeio', ['Bilhete Normal'], '', () => a.calendario({ mes: 9 }));
    });
    assert.equal(a.w.document.querySelector('.MuiPickersStaticWrapper-staticWrapperRoot'), null);
    await a.api.preparar({ origem: 'GETYOURGUIDE', passeio: 'Rio de Janeiro: Sugarloaf Cable Car',
      fornecedor: '', dataVisita: '2026-10-31' }, () => {});
    assert.deepEqual(a.historico, [['Selecione o fornecedor', 'Bondinho Pão de Açúcar'],
      ['Selecione o passeio', 'Bilhete Normal'], ['data', '2026-10-31']]);
  } finally { a.w.close(); }
});

test('associação exige título completo e preserva fornecedor informado pelo operador', async () => {
  const a = ambiente();
  try {
    assert.equal(a.w.ICDFornecedorMap.resolver('GETYOURGUIDE', 'Rio de Janeiro: Sugarloaf Cable Car and City Tour'), '');
    assert.equal(a.w.ICDFornecedorMap.resolver('OUTRA', 'Rio de Janeiro: Sugarloaf Cable Car'), '');
    a.campo('Canal de venda', [], "OTA's");
    a.campo('Unidade Distribuidora', [], '000 GetYourGuide');
    a.campo('Selecione o fornecedor', ['Fornecedor Manual']);
    a.calendario({ mes: 9 });
    await a.api.preparar({ origem: 'GETYOURGUIDE', passeio: 'Rio de Janeiro: Sugarloaf Cable Car',
      fornecedor: 'Fornecedor Manual', dataVisita: '2026-10-31' }, () => {});
    assert.equal(a.historico[0][1], 'Fornecedor Manual');
  } finally { a.w.close(); }
});

test('quatro correspondências confirmadas resolvem fornecedor sem confundir outros títulos', () => {
  const a = ambiente();
  try {
    const associacoes = [
      ['Christ the Redeemer Entry Ticket by Corcovado Train', 'Trem do Corcovado'],
      ['Rio de Janeiro: Sugarloaf Cable Car', 'Bondinho Pão de Açúcar'],
      ['Rio de Janeiro Aquarium: AquaRio Entrance Ticket', 'AquaRio Porto Maravilha'],
      ['Rio de Janeiro: Maracanã Stadium Entrance Ticket', 'Tour Maracanã'],
    ];
    for (const [titulo, fornecedor] of associacoes) {
      assert.equal(a.w.ICDFornecedorMap.resolver('GETYOURGUIDE', titulo), fornecedor);
      assert.equal(a.w.ICDFornecedorMap.resolver('GETYOURGUIDE', '  ' + titulo.toUpperCase() + '  '), fornecedor);
      assert.equal(a.w.ICDFornecedorMap.resolver('GETYOURGUIDE', titulo + ' and City Tour'), '');
    }
  } finally { a.w.close(); }
});

test('dia desabilitado ou fora do mês não é selecionado', async () => {
  for (const opcao of [{ disabled: true }, { hiddenOnly: true }]) {
    const a = ambiente();
    try {
      a.calendario(opcao);
      await assert.rejects(a.api.selecionarData('2026-12-03'), /indisponível/);
      assert.equal(a.historico.length, 0);
    } finally { a.w.close(); }
  }
});

test('seleção de data exige confirmação visual do calendário', async () => {
  const a = ambiente();
  try {
    a.calendario({ confirmar: false });
    await assert.rejects(a.api.selecionarData('2026-12-03'), /não confirmou/);
  } finally { a.w.close(); }
});
