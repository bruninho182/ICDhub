function injetarFerramentasRelatorio() {
    // Trava de segurança para não duplicar o botão
    if (document.getElementById('btn-massa-cco')) return; 

    const linhas = document.querySelectorAll('table tr'); 
    let paginaTemEmails = false; // Flag para saber se achamos algum cliente

    linhas.forEach((linha, index) => {
        const celulas = Array.from(linha.querySelectorAll('td, th')); 

        if (celulas.length >= 4) {
            let emailCliente = "";
            let nomeCliente = "Cliente";
            let encontrouEmail = false;

            for (let i = 0; i < celulas.length; i++) {
                const texto = celulas[i].innerText.trim();
                const matchEmail = texto.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);

                if (matchEmail) {
                    emailCliente = matchEmail[0];
                    encontrouEmail = true;
                    paginaTemEmails = true; // Opa! Achamos pelo menos um na página!

                    if (texto.includes('\n') || texto.includes('/')) {
                        const partes = texto.split(/[\n\/]/);
                        if (partes.length > 0 && !partes[0].includes('@')) {
                            nomeCliente = partes[0].trim();
                        }
                    } else if (i > 0) {
                        nomeCliente = celulas[i - 1].innerText.trim();
                    }
                    break; 
                }
            }

            if (encontrouEmail) {
                const tdCheck = document.createElement('td');
                tdCheck.style.textAlign = "center";
                tdCheck.innerHTML = `<input type="checkbox" class="check-email-icd" value="${emailCliente}" data-nome="${nomeCliente}" style="width:18px; height:18px; cursor:pointer;">`;
                linha.prepend(tdCheck);

                const tdBtn = document.createElement('td');
                const btnIndiv = document.createElement('button');
                btnIndiv.innerText = "📧 Enviar";
                btnIndiv.style = "padding: 5px 10px; cursor: pointer; background: #34B7F1; color: white; border: none; border-radius: 4px; font-size: 11px; font-weight: bold;";
                btnIndiv.onclick = () => prepararEnvioCCO([emailCliente]);
                tdBtn.appendChild(btnIndiv);
                linha.appendChild(tdBtn);
                
            } else if (celulas.length > 1) {
                const tdVazio = document.createElement(celulas[0].tagName); 
                linha.prepend(tdVazio);
            }
        }
    });

    // 🚀 O SEGREDO: Só cria o botão de disparo em massa SE houver e-mails na tela!
    if (paginaTemEmails) {
        const btnMassa = document.createElement('button');
        btnMassa.id = 'btn-massa-cco';
        btnMassa.innerText = "📧 Enviar p/ Selecionados (CCO)";
        btnMassa.style = "position: fixed; top: 20px; right: 20px; z-index: 10001; padding: 12px 20px; background: #612d87; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; box-shadow: 0 4px 15px rgba(0,0,0,0.3); transition: transform 0.2s;";
        
        btnMassa.onmouseover = () => btnMassa.style.transform = "scale(1.05)";
        btnMassa.onmouseout = () => btnMassa.style.transform = "scale(1)";
        btnMassa.onclick = dispararEmMassa;
        
        document.body.appendChild(btnMassa);
    }
}

async function prepararEnvioCCO(listaEmails) {
    const res = await chrome.storage.local.get(['emailAssunto', 'emailCorpo']);
    
    if (!res.emailAssunto || !res.emailCorpo) {
        alert("⚠️ Por favor, configure o Assunto e o Corpo do e-mail no Painel de Controle!");
        return;
    }

    const destinatariosCCO = listaEmails.join(', ');

    chrome.storage.local.set({
        dadosParaEmail: {
            modo: 'CCO',
            email: destinatariosCCO, 
            assunto: res.emailAssunto,
            corpo: res.emailCorpo
        }
    }, () => {
        window.open('https://webmail-seguro.com.br/?_task=mail&_action=compose', '_blank');
    });
}

function dispararEmMassa() {
    const selecionados = document.querySelectorAll('.check-email-icd:checked');
    const lista = Array.from(selecionados).map(cb => cb.value);

    if (lista.length === 0) {
        return alert("Selecione pelo menos um cliente na lista!");
    }
    
    prepararEnvioCCO(lista);
}

setTimeout(injetarFerramentasRelatorio, 2000);