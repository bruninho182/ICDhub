"use strict";
var ICDDiagnostico;
(function (ICDDiagnostico) {
    function verificar(url, doc) {
        const u = new URL(url);
        const itens = [];
        const testar = (nome, seletor) => { itens.push({ nome, estado: doc.querySelector(seletor) ? 'Localizado' : 'Não localizado nesta tela — aguarde o carregamento ou confira a função ativada' }); };
        if (u.hostname === 'web.whatsapp.com') {
            testar('Painel ICD Hub', '#menu-automacao-hub');
            testar('Caixa de mensagem', 'div[contenteditable="true"][data-tab="10"]');
        }
        else if (/relatorio_/i.test(u.pathname)) {
            testar('Tabelas do relatório', 'table');
            testar('Painel de e-mails', '#icd-relatorio-email');
        }
        else if (u.hostname === 'app.icdgrupo.com.br' && u.pathname.includes('/bookings/')) {
            testar('Campos da reserva', 'input');
            testar('Títulos dos campos', 'label');
        }
        else if (u.hostname.includes('webmail')) {
            testar('Campo de assunto (abra uma nova mensagem)', 'input[name="_subject"],#compose-subject');
            testar('Revisão ICD Hub', '#icd-revisar-email');
        }
        else if (u.hostname === 'supplier.getyourguide.com') {
            testar('Importação GetYourGuide', '#btn-copy-gyg');
        }
        else if (u.pathname.includes('voucher.asp'))
            testar('Conferência do voucher', '#btn-abrir-mail');
        return itens;
    }
    ICDDiagnostico.verificar = verificar;
    if (typeof document !== 'undefined' && typeof chrome !== 'undefined') {
        chrome.runtime?.onMessage?.addListener((msg, _sender, responder) => { if (msg.acao === 'ICD_DIAGNOSTICO') {
            responder({ itens: verificar(location.href, document) });
        } });
        const iniciar = () => {
            const btn = document.getElementById('diagnostico-atualizar');
            if (!btn)
                return;
            const saida = document.getElementById('diagnostico-resultado');
            btn.onclick = async () => {
                btn.disabled = true;
                saida.textContent = 'Verificando as páginas abertas…';
                try {
                    const dados = await chrome.storage.local.get(['icdAppsScriptUrl', 'icdAppsScriptToken', 'emailAssunto', 'emailCorpo']);
                    const linhas = [`ICD Hub ${chrome.runtime.getManifest().version}`, `Planilha de estornos: ${dados.icdAppsScriptUrl && dados.icdAppsScriptToken ? 'configurada' : 'configuração incompleta'}`, `Modelo de e-mail: ${dados.emailAssunto && dados.emailCorpo ? 'configurado' : 'configuração incompleta'}`];
                    const abas = (await chrome.tabs.query({})).filter(aba => {
                        try {
                            return /(^|\.)(ingressocomdesconto\.com\.br|icdgrupo\.com\.br|whatsapp\.com|webmail-seguro\.com\.br|webmail\.locaweb\.com\.br|supplier\.getyourguide\.com)$/.test(new URL(aba.url || '').hostname);
                        }
                        catch {
                            return false;
                        }
                    });
                    const resultados = await Promise.all(abas.map(async (aba) => {
                        const host = new URL(aba.url).hostname;
                        let timer;
                        try {
                            const resposta = await Promise.race([chrome.tabs.sendMessage(aba.id, { acao: 'ICD_DIAGNOSTICO' }, { frameId: 0 }), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error()), 2000); })]);
                            return resposta.itens.length ? host + '\n' + resposta.itens.map(i => '• ' + i.nome + ': ' + i.estado).join('\n') : host + ' — sem verificação específica para esta tela.';
                        }
                        catch {
                            return host + ' — recarregue a página para conectar o diagnóstico.';
                        }
                        finally {
                            clearTimeout(timer);
                        }
                    }));
                    saida.textContent = [...linhas, ...resultados].join('\n\n') + (abas.length ? '' : '\n\nAbra uma página de atendimento para verificar os campos.');
                }
                catch {
                    saida.textContent = 'Não foi possível concluir a verificação. Recarregue o painel e tente novamente.';
                }
                finally {
                    btn.disabled = false;
                }
            };
            document.getElementById('diagnostico-copiar').onclick = async () => {
                try {
                    await navigator.clipboard.writeText(saida.textContent || '');
                    document.getElementById('diagnostico-status').textContent = 'Diagnóstico copiado.';
                }
                catch {
                    document.getElementById('diagnostico-status').textContent = 'Não foi possível copiar. Selecione o texto do diagnóstico e copie manualmente.';
                }
            };
        };
        if (document.readyState === 'loading')
            document.addEventListener('DOMContentLoaded', iniciar);
        else
            iniciar();
    }
})(ICDDiagnostico || (ICDDiagnostico = {}));
