"use strict";
var ICDOperacao;
(function (ICDOperacao) {
    function pendencias(titulo, campos) {
        const problemas = campos.filter(([nome, valor]) => !String(valor || '').trim() || (/e-mail/i.test(nome) && !/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(valor)));
        if (!problemas.length)
            return Promise.resolve(true);
        return confirmar({ titulo, descricao: 'A operação não será continuada. Confira os campos abaixo e aguarde a página carregar ou corrija os dados no sistema.',
            campos: campos.map(([nome, valor]) => [nome, !String(valor || '').trim() ? '⚠ Não localizado' : problemas.some(([n]) => n === nome) ? '⚠ Formato inválido' : '✓ Preenchido']), acao: 'Voltar e corrigir' }).then(() => false);
    }
    ICDOperacao.pendencias = pendencias;
    let aberta = false;
    function confirmar(opcoes) {
        if (aberta)
            return Promise.resolve(false);
        aberta = true;
        return new Promise(resolve => {
            const host = document.createElement('div');
            host.id = 'icd-operacao-review';
            const root = host.attachShadow({ mode: 'open' });
            root.innerHTML = `<style>
        dialog{box-sizing:border-box;font:14px/1.6 system-ui;color:#172033;background:#fff;width:min(620px,94vw);max-height:85vh;overflow:auto;border:0;border-radius:16px;padding:26px;box-shadow:0 20px 80px #0006}dialog::backdrop{background:#14203899}h2{font-size:22px;margin:0 0 10px}p{color:#526077}dl{margin:18px 0}dt{font-weight:650;margin-top:12px;color:#526077}dd{margin:4px 0;white-space:pre-wrap;overflow-wrap:anywhere;padding:10px;background:#f1f5fa;border-radius:7px;max-height:180px;overflow:auto}footer{display:flex;justify-content:flex-end;gap:10px;margin-top:22px}button{font:600 14px system-ui;padding:11px 16px;border:1px solid #bac6d8;border-radius:8px;background:#fff;cursor:pointer}#confirmar{background:#6036b5;color:#fff;border-color:#6036b5}button:focus-visible{outline:3px solid #a78bfa;outline-offset:2px}
      </style><dialog aria-labelledby="titulo"><h2 id="titulo"></h2><p id="descricao"></p><dl></dl><footer><button id="cancelar">Cancelar</button><button id="confirmar"></button></footer></dialog>`;
            root.getElementById('titulo').textContent = opcoes.titulo;
            root.getElementById('descricao').textContent = opcoes.descricao;
            root.getElementById('confirmar').textContent = opcoes.acao;
            for (const [rotulo, valor] of opcoes.campos) {
                const dt = document.createElement('dt');
                dt.textContent = rotulo;
                const dd = document.createElement('dd');
                dd.textContent = valor || 'Não informado';
                root.querySelector('dl').append(dt, dd);
            }
            const dialog = root.querySelector('dialog');
            const fechar = (confirmado) => { dialog.close(); host.remove(); aberta = false; resolve(confirmado); };
            root.getElementById('cancelar').onclick = () => fechar(false);
            root.getElementById('confirmar').onclick = () => fechar(true);
            dialog.oncancel = e => { e.preventDefault(); fechar(false); };
            document.body.append(host);
            try {
                dialog.showModal();
            }
            catch (erro) {
                host.remove();
                aberta = false;
                throw erro;
            }
        });
    }
    ICDOperacao.confirmar = confirmar;
})(ICDOperacao || (ICDOperacao = {}));
