const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');

function painel() {
    const dom = new JSDOM(fs.readFileSync('dashboard/dashboard.html', 'utf8'), {
        url: 'https://painel.example.test/', runScripts: 'outside-only'
    });
    vm.runInContext(fs.readFileSync('dashboard/dashboard.js', 'utf8'), dom.getInternalVMContext());
    return dom;
}

test('dia, semana, mês e ano seguem São Paulo mesmo após a meia-noite UTC', () => {
    const dom = painel();
    try {
        const intervalo = dom.window.intervaloDashboard;
        const antes = new Date('2026-11-10T02:59:59Z');
        assert.equal(intervalo('hoje', antes).p_inicio, '2026-11-09');
        assert.equal(intervalo('hoje', new Date('2026-11-10T03:00:00Z')).p_inicio, '2026-11-10');
        assert.equal(intervalo('semana', antes).p_inicio, '2026-11-09');
        assert.equal(intervalo('mes', antes).p_inicio, '2026-11-01');
        assert.equal(intervalo('ano', antes).p_inicio, '2026-01-01');
        assert.equal(intervalo('personalizado', antes, '2026-11-01', '2026-11-02').p_fim_exclusivo, '2026-11-03');
    } finally { dom.window.close(); }
});

test('dashboard soma agregados diários e exige autorização master mesmo após o login', async () => {
    const dom = painel();
    try {
        const w = dom.window;
        const doc = w.document;
        const totais = w.agruparPorOperador([
            { operador: 'Teste', operador_id: 'teste', whatsapp: 1200, email: 3, voucher: 5, timestamp: '2026-11-09T22:00:00Z' },
            { operador: 'Teste', operador_id: 'teste', whatsapp: 800, email: 7, voucher: 5, timestamp: '2026-11-08T22:00:00Z' }
        ]);
        assert.equal(totais.teste.total, 2020);
        const chamadas = [];
        w.fetch = async (url, opcoes) => {
            chamadas.push({ url, opcoes });
            return chamadas.length === 1 ? { ok: true, json: async () => ({ access_token: 'token-teste' }) }
                : { ok: false, status: 403 };
        };
        doc.getElementById('emailDashboard').value = 'master@example.test';
        doc.getElementById('senhaDashboard').value = 'senha-teste';
        await w.validarSenha();
        assert.match(chamadas[0].url, /auth\/v1\/token/);
        assert.equal(chamadas[1].opcoes.headers.Authorization, 'Bearer token-teste');
        assert.match(doc.getElementById('erroLogin').textContent, /acesso master/);
        assert.equal(doc.getElementById('conteudoDashboard').classList.contains('visible'), false);
        assert.equal(doc.getElementById('senhaDashboard').value, '');
    } finally { dom.window.close(); }
});

test('consulta mantém os últimos totais e o período exibido quando a atualização falha', async () => {
    const dom = painel();
    try {
        const w = dom.window;
        const doc = w.document;
        w.chrome = { storage: { local: { get(_chaves, cb) { cb({}); } } } };
        const respostas = [
            { ok: true, json: async () => ({ access_token: 'token-teste' }) },
            { ok: true, json: async () => [{
                operador: 'Operador de teste', operador_id: 'teste', dia: '2026-11-10',
                timestamp: '2026-11-10T10:00:00Z', whatsapp: 1250, email: 10, voucher: 4
            }] },
            { ok: false, status: 503 }
        ];
        w.fetch = async () => respostas.shift();
        w.localStorage.setItem('operadores_desativados', JSON.stringify(['teste']));
        doc.getElementById('emailDashboard').value = 'master@example.test';
        doc.getElementById('senhaDashboard').value = 'senha-teste';
        await w.validarSenha();
        assert.equal(doc.getElementById('conteudoDashboard').classList.contains('visible'), true);
        assert.equal(doc.getElementById('totalWhatsapp').textContent, '1250');
        const periodo = doc.getElementById('periodoExibido').textContent;
        await w.carregarDados();
        assert.equal(doc.getElementById('totalWhatsapp').textContent, '1250');
        assert.equal(doc.getElementById('periodoExibido').textContent, periodo);
        assert.match(doc.getElementById('ultimaAtualizacao').textContent, /última consulta bem-sucedida/);
    } finally { dom.window.close(); }
});

test('comparação mensal usa dias completos e limita os dois períodos ao mês mais curto', () => {
    const dom = painel();
    try {
        const comparar = dom.window.intervalosComparacao;
        const janela = comparar('mes', { p_inicio: '2026-03-01', p_fim_exclusivo: '2026-04-01' });
        assert.equal(janela.atual.p_fim_exclusivo, '2026-03-29');
        assert.equal(janela.anterior.p_inicio, '2026-02-01');
        assert.equal(janela.anterior.p_fim_exclusivo, '2026-03-01');
        assert.equal(comparar('semana', { p_inicio: '2026-11-09', p_fim_exclusivo: '2026-11-10' }), null);
    } finally { dom.window.close(); }
});

test('consultas simultâneas compartilham uma renovação e usam o token renovado', async () => {
    const dom = painel();
    try {
        const contexto = dom.getInternalVMContext();
        vm.runInContext("sessaoMaster = { token: 'antigo', renovacao: 'refresh-antigo', expiraEm: 0 }", contexto);
        let renovacoes = 0;
        const tokens = [];
        dom.window.fetch = async (url, opcoes) => {
            if (url.includes('grant_type=refresh_token')) {
                renovacoes++;
                assert.equal(JSON.parse(opcoes.body).refresh_token, 'refresh-antigo');
                return { ok: true, json: async () => ({ access_token: 'novo', refresh_token: 'refresh-novo', expires_in: 3600 }) };
            }
            tokens.push(opcoes.headers.Authorization);
            return { ok: true };
        };
        await vm.runInContext('Promise.all([consultarMetricas(sessaoMaster, {}), consultarMetricas(sessaoMaster, {})])', contexto);
        assert.equal(renovacoes, 1);
        assert.deepEqual(tokens, ['Bearer novo', 'Bearer novo']);
        assert.equal(vm.runInContext('sessaoMaster.renovacao', contexto), 'refresh-novo');
    } finally { dom.window.close(); }
});
