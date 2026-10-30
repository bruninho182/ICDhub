"use strict";
// Conferência compartilhada: valores capturados entram apenas por .value/textContent.
var ICDReservaReview;
(function (ICDReservaReview) {
    function conferir(reserva, opcoes) {
        return new Promise(resolve => {
            const host = document.createElement('div');
            host.style.cssText = 'position:fixed;inset:0;z-index:2147483647';
            const raiz = host.attachShadow({ mode: 'closed' });
            raiz.innerHTML = `<style>
        :host{font:15px system-ui;color:#172033} *{box-sizing:border-box}
        dialog{width:min(480px,calc(100vw - 32px));max-height:90vh;overflow:auto;border:0;border-radius:16px;padding:28px;color:#172033;box-shadow:0 20px 80px #0004}
        dialog::backdrop{background:#14213d88} h2{margin:0 0 8px;font-size:22px}
        p{line-height:1.5;color:#526077} label{display:block;font-weight:600;margin-top:16px}
        input{display:block;width:100%;margin-top:6px;padding:11px;border:1px solid #a8b3c4;border-radius:7px;font:inherit}
        input:focus-visible,button:focus-visible{outline:3px solid #a78bfa;outline-offset:2px}
        .acoes{display:flex;gap:10px;justify-content:flex-end;margin-top:24px}
        button{padding:11px 16px;border:1px solid #cbd5e1;border-radius:8px;background:white;font:inherit;cursor:pointer}
        button[type=submit]{background:#6036b5;color:white;border-color:#6036b5}
        #erros{color:#a51c30;white-space:pre-line}
      </style><dialog aria-labelledby="titulo"><form novalidate>
        <h2 id="titulo">Conferir reserva</h2>
        <p>Revise os dados antes de disponibilizá-los para preenchimento no ICD.</p>
        <p id="avisos"></p><div id="campos"></div>
        <p id="descricao">Produto, data e valores não são capturados neste fluxo. Confira essas informações no sistema de origem.</p>
        <p id="erros" role="alert"></p>
        <div class="acoes"><button type="button">Cancelar</button><button type="submit">Confirmar dados</button></div>
      </form></dialog>`;
            const dialog = raiz.querySelector('dialog');
            const form = raiz.querySelector('form');
            let enviando = false;
            const campos = opcoes.campos;
            raiz.querySelector('#titulo').textContent = opcoes.titulo;
            if (opcoes.descricao)
                raiz.querySelector('#descricao').textContent = opcoes.descricao;
            raiz.querySelector('#avisos').style.whiteSpace = 'pre-line';
            raiz.querySelector('#avisos').textContent = (opcoes.avisos || []).join('\n');
            for (const campo of campos) {
                const label = document.createElement('label');
                label.textContent = campo.rotulo;
                const input = document.createElement('input');
                input.name = campo.chave;
                input.type = campo.tipo || 'text';
                input.autocomplete = 'off';
                label.appendChild(input);
                raiz.querySelector('#campos').appendChild(label);
            }
            const entrada = (nome) => form.elements.namedItem(nome);
            campos.forEach(campo => { entrada(campo.chave).value = reserva[campo.chave]; });
            const encerrar = (valor) => { dialog.close(); host.remove(); resolve(valor); };
            dialog.addEventListener('cancel', e => { e.preventDefault(); if (!enviando)
                encerrar(null); });
            form.querySelector('button[type=button]').addEventListener('click', () => { if (!enviando)
                encerrar(null); });
            form.addEventListener('submit', e => {
                e.preventDefault();
                if (enviando)
                    return;
                const revisada = opcoes.normalizar(Object.fromEntries(campos.map(campo => [campo.chave, entrada(campo.chave).value])));
                const erros = opcoes.validar(revisada);
                raiz.querySelector('#erros').textContent = erros.join('\n');
                if (!erros.length) {
                    enviando = true;
                    const submit = form.querySelector('button[type=submit]');
                    submit.disabled = true;
                    submit.textContent = 'Disponibilizando…';
                    Promise.resolve().then(() => opcoes.confirmar(revisada)).then(() => encerrar(revisada)).catch(() => {
                        raiz.querySelector('#erros').textContent = 'Não foi possível disponibilizar os dados. Tente confirmar novamente.';
                        enviando = false;
                        submit.disabled = false;
                        submit.textContent = 'Confirmar dados';
                    });
                }
            });
            document.body.appendChild(host);
            dialog.showModal();
        });
    }
    ICDReservaReview.conferir = conferir;
})(ICDReservaReview || (ICDReservaReview = {}));
