console.log("✅ ICD Hub: TicketGo Bridge - Sniper Ativado");

function injetarBotaoTicketGo() {

    const header = document.querySelector('.modal-header') || document.body;
    
    if (document.getElementById('btn-copy-ticketgo')) return;

    const btn = document.createElement('button');
    btn.id = 'btn-copy-ticketgo';
    btn.innerText = '📋 Copiar para ICD';
    btn.style = "position: fixed; top: 15px; right: 80px; z-index: 9999; background: #612d87; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; font-weight: bold; box-shadow: 0 4px 6px rgba(0,0,0,0.2);";

    btn.onclick = () => {
        const firstName = document.getElementsByName('firstname')[0]?.value || "";
        const lastName = document.getElementsByName('lastname')[0]?.value || "";
        const email = document.getElementsByName('email')[0]?.value || "";


        let phone = document.getElementsByName('phone')[0]?.value || "";

        if (!phone.trim()) {
            const todosInputs = document.querySelectorAll('input');
            for (let input of todosInputs) {
                let valor = input.value.trim();
                

                if (valor.startsWith('+') && valor.length >= 9) {

                    let soNumeros = valor.substring(1).replace(/\s/g, ''); 
                    if (!isNaN(soNumeros)) {
                        phone = valor;
                        console.log("✅ Telefone escondido encontrado na TicketGo:", phone);
                        break; 
                    }
                }
            }
        }

        const orderField = document.getElementsByName('order_uuid')[0] || 
                           document.querySelector('[id*="order_uuid"]');
        
        const order = orderField ? orderField.value.trim() : "";

        const dados = {
            nome: `${firstName} ${lastName}`.trim(),
            email: email,
            telefone: phone,
            orderNumber: order,
            origem: "TicketGo"
        };

        console.log("🔍 Captura TicketGo realizada:", dados);

        if (!dados.nome || !dados.orderNumber) {
            alert("⚠️ Erro na captura: Certifique-se de que o campo 'Order Number' contém o código (ex: FRCG...)");
            return;
        }
        chrome.storage.local.set({ ticketgoData: dados }, () => {
            btn.innerText = '✅ Dados Copiados!';
            btn.style.background = '#25D366';
            setTimeout(() => {
                btn.innerText = '📋 Copiar para ICD';
                btn.style.background = '#612d87';
            }, 2000);
        });
    };

    document.body.appendChild(btn);
}

setInterval(injetarBotaoTicketGo, 2000);