chrome.storage.local.get(['funpassParams'], async (res) => {
    if (!res.funpassParams) return;

    const { data, keyword } = res.funpassParams;
    document.getElementById('tituloRelatorio').innerText = `Relatório Funpass - ${data}`;
    const domLoading = document.getElementById('loadingMensagem');

    const paramKeyword = keyword ? `&keyword=${keyword}` : "";
    const cacheBuster = `&nocache=${new Date().getTime()}`;

    const urlTodos = `https://www.ingressocomdesconto.com.br/adm/paginas/relatorio_passaportesE.asp?emp=&tipoConvenio=&dataI=${data}&dataF=${data}&dataT=V&sta=T&can=0&pag=T&ord=D&prm=&for=TODOS&usu=TODOS${paramKeyword}${cacheBuster}`;
    const urlTrem = `https://report.ingressocomdesconto.com.br/adm/paginas/relatorio_passaportesE.asp?emp=&tipoConvenio=&dataI=${data}&dataF=${data}&dataT=V&sta=T&can=0&pag=T&ord=D&prm=&for=8587&usu=TODOS${paramKeyword}${cacheBuster}`;

    const fetchOpcoes = { credentials: 'include' };

    try {
        domLoading.innerText = "⏳ Buscando Relatório Geral (TODOS)... Pode fazer outras coisas.";
        const respTodos = await fetch(urlTodos, fetchOpcoes).then(r => r.text());

        domLoading.innerText = "⏳ Buscando Relatório do TREM... Quase lá!";
        const respTrem = await fetch(urlTrem, fetchOpcoes).then(r => r.text());

        if (respTodos.includes("senha") || respTrem.includes("senha") || respTodos.includes("Login")) {
            domLoading.innerHTML = "⚠️ <b>Erro:</b> O sistema bloqueou a busca pedindo login! Mantenha a aba administrativa ativa e tente de novo.";
            return;
        }

        let cabecalhoSalvo = ""; 
        const extrairLinhas = (htmlTexto) => {
            const doc = new DOMParser().parseFromString(htmlTexto, 'text/html');
            const linhas = doc.querySelectorAll('table tr');
            const palavrasChave = ['FUNPASS', 'CONVENIO', 'PROMOCIONAL'];
            let resultados = [];

            linhas.forEach((linha, index) => {
                if (index === 0 && !cabecalhoSalvo && linha.innerText.includes('DATA')) {
                    cabecalhoSalvo = `<tr style="background:#612d87; color:white; text-align:center;">${linha.innerHTML}</tr>`;
                    return; 
                }

                const textoLinha = linha.innerText.toUpperCase();
                const temPalavra = palavrasChave.some(p => textoLinha.includes(p));
                
                if (temPalavra && !textoLinha.includes('DATA VDA')) {
                    if (textoLinha.includes(data)) {
                        resultados.push(`<tr>${linha.innerHTML}</tr>`);
                    }
                }
            });
            return resultados;
        };

        const dadosTodos = extrairLinhas(respTodos);
        const dadosTrem = extrairLinhas(respTrem);
        const todosResultados = [...new Set([...dadosTodos, ...dadosTrem])];

        if (todosResultados.length === 0) {
            domLoading.innerHTML = `❌ Nenhuma venda encontrada na data <b>${data}</b>.`;
            return;
        }

     
        const cabecalhoDom = document.createElement('thead');
        cabecalhoDom.innerHTML = cabecalhoSalvo;
        const primeiraColunaCabecalho = cabecalhoDom.querySelector('th, td');
        if (primeiraColunaCabecalho) {
            primeiraColunaCabecalho.innerHTML = '<input type="checkbox" id="checkTodos" style="cursor:pointer; width:18px; height:18px;"> ' + primeiraColunaCabecalho.innerHTML;
        }

        const corpoDom = document.createElement('tbody');
        corpoDom.innerHTML = todosResultados.join('');
        corpoDom.querySelectorAll('tr').forEach(tr => {
            const primeiraColuna = tr.querySelector('td, th');
            if (primeiraColuna) {
                // A CORREÇÃO ESTÁ AQUI: Concatenamos o checkbox com o texto original (innerHTML)
                const textoOriginal = primeiraColuna.innerHTML;
                primeiraColuna.innerHTML = '<input type="checkbox" class="check-reserva" style="cursor:pointer; width:18px; height:18px; margin-right:8px;">' + textoOriginal;
            }
        });

        domLoading.style.display = 'none';
        document.getElementById('tabelaContainer').style.display = 'block';
        document.getElementById('btnNotificar').style.display = 'block';
        document.getElementById('tabelaCabecalho').innerHTML = cabecalhoDom.innerHTML;
        document.getElementById('tabelaCorpo').innerHTML = corpoDom.innerHTML;

        document.title = "(✅ PRONTO!) Relatório Funpass";

        // Eventos
        const checkTodos = document.getElementById('checkTodos');
        if (checkTodos) {
            checkTodos.addEventListener('change', (e) => {
                document.querySelectorAll('.check-reserva').forEach(c => c.checked = e.target.checked);
            });
        }

        // =====================================
        // DISPARO VIA WEBMAIL (PRESERVANDO DADOS)
        // =====================================
        document.getElementById('btnNotificar').onclick = () => {
            const selecionados = Array.from(document.querySelectorAll('.check-reserva:checked'));
            
            if (selecionados.length === 0) {
                alert("⚠️ Por favor, selecione pelo menos uma reserva na tabela!");
                return;
            }

            let corpoTxt = `Olá equipe Funpass,\n\nSeguem os detalhes das ${selecionados.length} reservas captadas no dia de hoje (${data}):\n\n`;

            selecionados.forEach((chk, idx) => {
                const linha = chk.closest('tr');
                const todasColunas = Array.from(linha.querySelectorAll('td'));
                
                // Primeira coluna (index 0) que agora contém o Checkbox + O texto do código
                const colunaCodigo = todasColunas[0];
                
                // Garante pegar apenas o primeiro "pedaço" do texto antes de qualquer espaço ou quebra de linha
                const codigoReserva = colunaCodigo.innerText.trim().split(/\s+/)[0];
                
                // Pega as colunas restantes (data, nome, etc)
                const restoLinha = todasColunas.slice(1).map(c => c.innerText.trim().replace(/\s+/g, ' ')).filter(t => t !== "").join(' | ');
                
                corpoTxt += `(${idx + 1}) [Reserva: ${codigoReserva}] | ${restoLinha}\n`;
            });

            corpoTxt += `\nQualquer dúvida estamos à disposição!`;

            const destinatario = "colaborador@funpassclub.com.br";
            const assunto = `Relatório Funpass - ${data}`;
            const urlWebmail = `https://webmail-seguro.com.br/?_task=mail&_action=compose&_to=${encodeURIComponent(destinatario)}&_subject=${encodeURIComponent(assunto)}&_body=${encodeURIComponent(corpoTxt)}`;

            window.open(urlWebmail, '_blank');
        };

    } catch (erro) {
        console.error(erro);
        domLoading.innerHTML = "❌ Erro ao processar dados.";
    }
});