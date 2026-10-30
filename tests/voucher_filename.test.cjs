const { test } = require('node:test');
const assert = require('node:assert/strict');
const nomes = require('../scripts/voucher_filename.js');
test('nome PDF é limpo, limitado e não contém caminhos ou caracteres inválidos', () => {
  assert.equal(nomes.limpar('voucher-123 - Cliente.pdf'), '123 - Cliente.pdf');
  assert.equal(nomes.limpar('CON.pdf'), 'voucher-CON.pdf');
  assert.equal(nomes.limpar(''), null);
  assert.doesNotMatch(nomes.limpar('../Pasta\\Cliente: Nome?.pdf'), /[/\\:?]/);
  assert.ok(nomes.limpar('a'.repeat(300)).length <= 174);
});
test('somente domínios ICD são aceitos como origem para renomeação', () => {
  assert.equal(nomes.origemICD('https://app.icdgrupo.com.br/voucher.pdf'), true);
  assert.equal(nomes.origemICD('blob:https://app.icdgrupo.com.br/id'), true);
  assert.equal(nomes.origemICD('https://ingressocomdesconto.com.br.exemplo.test/x'), false);
  assert.equal(nomes.origemICD('https://outro.example.test/x.pdf'), false);
});
