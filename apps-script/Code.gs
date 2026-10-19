const SPREADSHEET_ID = '1jejjhBH5QtSHidu0RDWNkwfGF3jXjuscv6j8xNEV0rU';
const SHEET_NAME = '';
const TOKEN_PROPERTY = 'ICD_APPS_SCRIPT_TOKEN';

function obterToken() {
  return PropertiesService.getScriptProperties().getProperty(TOKEN_PROPERTY);
}

const COLUNAS_COM_MENU = {
  F: { numero: 6, nome: 'atração' },
  G: { numero: 7, nome: 'forma de pagamento' },
  H: { numero: 8, nome: 'adquirente' }
};

const EQUIVALENCIAS_FORMA_PAGAMENTO = {
  'CARTAO DE CREDITO': 'CREDITO',
  'CARTAO CREDITO': 'CREDITO',
  'CREDIT CARD': 'CREDITO'
};

function normalizarChave(valor) {
  return String(valor || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .trim()
    .toUpperCase();
}

function opcoesDaValidacao(validacao) {
  if (!validacao) throw new Error('menu não configurado na linha modelo');

  const tipo = validacao.getCriteriaType();
  const criterios = validacao.getCriteriaValues();

  if (tipo === SpreadsheetApp.DataValidationCriteria.VALUE_IN_LIST) {
    return criterios[0].map(String).filter(Boolean);
  }

  if (tipo === SpreadsheetApp.DataValidationCriteria.VALUE_IN_RANGE) {
    return criterios[0].getDisplayValues().flat().map(String).filter(Boolean);
  }

  throw new Error('tipo de menu não suportado: ' + tipo);
}

function valorPermitido(valor, validacao, coluna) {
  let candidato = String(valor || '').trim();
  if (coluna === 'H' && !candidato) return '';
  if (coluna === 'G') {
    candidato = EQUIVALENCIAS_FORMA_PAGAMENTO[normalizarChave(candidato)] || candidato;
  }

  const opcoes = opcoesDaValidacao(validacao);
  const correspondente = opcoes.find(
    (opcao) => normalizarChave(opcao) === normalizarChave(candidato)
  );

  if (!correspondente) {
    throw new Error(
      `${COLUNAS_COM_MENU[coluna].nome} inválido para o menu: "${valor}"`
    );
  }

  return correspondente;
}

const INDICES_VERIFICACAO_LINHA = [
  0,  // E: Voucher
  4,  // I: NSU / código PIX
  5,  // J: Data da compra
  6,  // K: Data da visita
  7,  // L: Valor
  12, // Q: E-mail
  13, // R: Nome
  14  // S: Status
];

function obterLinhasParaVerificacao(sheet) {
  const ultimaLinha = Math.max(sheet.getLastRow(), 2);
  return sheet.getRange(2, 5, ultimaLinha - 1, 15).getDisplayValues();
}

function obterProximaLinhaVazia(linhas) {
  const indice = linhas.findIndex((linha) =>
    INDICES_VERIFICACAO_LINHA.every((indiceColuna) =>
      !String(linha[indiceColuna] || '').trim()
    )
  );

  return indice === -1 ? linhas.length + 2 : indice + 2;
}

function aplicarMenusDaLinhaModelo(sheet, linha, valores) {
  const modelo = sheet.getRange(2, COLUNAS_COM_MENU.F.numero, 1, 3);
  const destino = sheet.getRange(linha, COLUNAS_COM_MENU.F.numero, 1, 3);
  const validacoes = modelo.getDataValidations()[0];

  valores.F = valorPermitido(valores.F, validacoes[0], 'F');
  valores.G = valorPermitido(valores.G, validacoes[1], 'G');
  valores.H = valorPermitido(valores.H, validacoes[2], 'H');

  destino.setDataValidations([validacoes]);
  modelo.copyTo(destino, SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
}

function normalizarVoucher(voucher) {
  return String(voucher || '')
    .trim()
    .replace(/-1\s*$/i, '')
    .trim()
    .toUpperCase();
}

function encontrarLinhaDoVoucher(linhas, voucherNormalizado) {
  const indice = linhas.findIndex(
    (linha) => normalizarVoucher(linha[0]) === voucherNormalizado
  );

  return indice === -1 ? null : indice + 2;
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return resposta({ ok: false, erro: 'corpo da requisição ausente' });
    }

    const body = JSON.parse(e.postData.contents);
    const tokenConfigurado = obterToken();
    if (!tokenConfigurado) {
      return resposta({ ok: false, erro: 'token não configurado no Apps Script' });
    }
    if (body.token !== tokenConfigurado) {
      return resposta({ ok: false, erro: 'token inválido' });
    }

    const linha = body.linha || {};
    if (!String(linha.E || '').trim()) {
      return resposta({ ok: false, erro: 'voucher ausente' });
    }
    if (!String(linha.Q || '').trim()) {
      return resposta({ ok: false, erro: 'e-mail ausente' });
    }

    const lock = LockService.getScriptLock();
    try {
      lock.waitLock(30000);

      const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
      const sheet = SHEET_NAME ? ss.getSheetByName(SHEET_NAME) : ss.getSheets()[0];
      if (!sheet) return resposta({ ok: false, erro: 'aba não encontrada' });

      const linhasParaVerificacao = obterLinhasParaVerificacao(sheet);
      const voucherNormalizado = normalizarVoucher(linha.E);
      const linhaExistente = encontrarLinhaDoVoucher(linhasParaVerificacao, voucherNormalizado);
      if (linhaExistente) {
        return resposta({
          ok: false,
          duplicado: true,
          linha: linhaExistente,
          erro: `voucher já existe na linha ${linhaExistente}`
        });
      }

      const proximaLinha = obterProximaLinhaVazia(linhasParaVerificacao);
      aplicarMenusDaLinhaModelo(sheet, proximaLinha, linha);
      const valores = Array(17).fill('');
      valores[4] = linha.E || '';
      valores[5] = linha.F || '';
      valores[6] = linha.G || '';
      valores[7] = linha.H || '';
      valores[8] = linha.I || '';
      valores[9] = linha.J || '';
      valores[10] = linha.K || '';
      valores[11] = linha.L || '';
      valores[16] = linha.Q || '';

      const destino = sheet.getRange(proximaLinha, 1, 1, valores.length);
      destino
        .setValues([valores])
        .setHorizontalAlignment('center')
        .setVerticalAlignment('middle');
      SpreadsheetApp.flush();
      return resposta({ ok: true, linha: proximaLinha });
    } finally {
      if (lock.hasLock()) lock.releaseLock();
    }
  } catch (err) {
    return resposta({ ok: false, erro: err.message });
  }
}

function doGet() {
  return resposta({ ok: true, msg: 'ICD Hub Apps Script online' });
}

function resposta(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
