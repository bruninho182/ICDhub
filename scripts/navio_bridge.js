console.log("⚓ Bridge Navio: Ativada");

function injetarBotaoNavio() {
    if (!window.location.href.includes('navio.ingressocomdesconto.com.br/prevenda/add.html')) return;
    if (document.getElementById('btn-copy-navio')) return;

    const btn = document.createElement('button');
    btn.id = 'btn-copy-navio';
    btn.innerText = '🚀 Enviar para ICD'; // Mudamos o texto aqui
    btn.style = "position: fixed; top: 15px; right: 20px; z-index: 9999; background: #612d87; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; font-weight: bold; box-shadow: 0 4px 6px rgba(0,0,0,0.2);";

    btn.onclick = () => {
        const nome = document.getElementById('CustomerName')?.value || "";
        const email = document.getElementById('CustomerEmail')?.value || "";
        const idOriginal = document.getElementById('OriginalCode')?.value || "";
        const telefone = document.getElementById('AgencyTelefone')?.value || "";

        const dadosNavio = {
            nome: nome.trim(),
            email: email.trim(),
            idOriginal: idOriginal.trim(),
            telefone: telefone.trim()
        };

        console.log("🔍 Dados copiados do Navio:", dadosNavio);

        if (!dadosNavio.nome && !dadosNavio.idOriginal) {
            alert("⚠️ Nenhum dado encontrado. Verifique se a página já carregou.");
            return;
        }

        chrome.storage.local.set({ navioDataBridge: dadosNavio }, () => {
            btn.innerText = '✅ Enviado!';
            btn.style.background = '#25D366';
            setTimeout(() => {
                btn.innerText = '🚀 Enviar para ICD';
                btn.style.background = '#612d87';
            }, 2000);
        });
    };

    document.body.appendChild(btn);
}

setInterval(injetarBotaoNavio, 2000);