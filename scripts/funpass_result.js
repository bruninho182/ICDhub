chrome.storage.local.get(['funpassParams'], async (res) => {
    if (!res.funpassParams) return;

    const { data, keyword } = res.funpassParams;
    document.getElementById('tituloRelatorio').innerText = `Relatório Funpass - ${data}`;
    const domLoading = document.getElementById('loadingMensagem');

    const paramKeyword = keyword ? `&keyword=${keyword}` : "";
    const cacheBuster = `&nocache=${new Date().getTime()}`;

    // Determina o domínio base (hoje = www, senão report)
    const partesData = data.split('/');
    const dataObj = new Date(partesData[2], partesData[1] - 1, partesData[0]);
    const hoje = new Date();
    const isHoje = (hoje.getFullYear() === dataObj.getFullYear() &&
                    hoje.getMonth() === dataObj.getMonth() &&
                    hoje.getDate() === dataObj.getDate());

    const dominioBase = isHoje
        ? 'https://www.ingressocomdesconto.com.br'
        : 'https://report.ingressocomdesconto.com.br';

    const urlBase = `${dominioBase}/adm/paginas/relatorio_passaportesE.asp?emp=&tipoConvenio=&dataI=${data}&dataF=${data}&dataT=V&sta=T&can=0&pag=T&ord=D&prm=&for=`;
    const urlTodos = `${urlBase}TODOS&usu=TODOS${paramKeyword}${cacheBuster}`;
    const urlTrem = `${urlBase}8587&usu=TODOS${paramKeyword}${cacheBuster}`;

    // Função para extrair HTML de uma aba real
    async function extrairHtmlDeAba(url) {
        return new Promise((resolve, reject) => {
            chrome.tabs.create({ url, active: false }, (tab) => {
                const timeout = setTimeout(() => {
                    chrome.tabs.onUpdated.removeListener(listener);
                    chrome.tabs.remove(tab.id);
                    reject(new Error('Timeout ao carregar o relatório.'));
                }, 25000);

                const listener = (tabId, changeInfo) => {
                    if (tabId === tab.id && changeInfo.status === 'complete') {
                        clearTimeout(timeout);
                        chrome.tabs.onUpdated.removeListener(listener);

                        setTimeout(() => {
                            chrome.scripting.executeScript(
                                {
                                    target: { tabId: tab.id },
                                    func: () => document.documentElement.outerHTML
                                },
                                (results) => {
                                    chrome.tabs.remove(tab.id);
                                    if (chrome.runtime.lastError || !results || !results[0]) {
                                        reject(new Error('Falha ao extrair HTML.'));
                                    } else {
                                        resolve(results[0].result);
                                    }
                                }
                            );
                        }, 2000);
                    }
                };
                chrome.tabs.onUpdated.addListener(listener);
            });
        });
    }

    try {
        domLoading.innerText = "⏳ Buscando Relatório Geral (TODOS)...";
        const respTodos = await extrairHtmlDeAba(urlTodos);

        domLoading.innerText = "⏳ Buscando Relatório do TREM...";
        const respTrem = await extrairHtmlDeAba(urlTrem);

        if (respTodos.includes("senha") || respTrem.includes("senha") || respTodos.includes("Login")) {
            domLoading.innerHTML = "⚠️ <b>Erro:</b> O sistema bloqueou a busca pedindo login! Mantenha a aba administrativa ativa e tente de novo.";
            return;
        }

        // Extração das linhas (mantida exatamente como estava)
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

        const checkTodos = document.getElementById('checkTodos');
        if (checkTodos) {
            checkTodos.addEventListener('change', (e) => {
                document.querySelectorAll('.check-reserva').forEach(c => c.checked = e.target.checked);
            });
        }

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
                const colunaCodigo = todasColunas[0];
                const codigoReserva = colunaCodigo.innerText.trim().split(/\s+/)[0];
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
        domLoading.innerHTML = `❌ Erro ao processar: ${erro.message}`;
    }
});