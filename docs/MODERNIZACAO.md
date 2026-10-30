# Modernização do ICDHub

## Diagnóstico inicial — 30/10/2026

Extensão Manifest V3, versão 3.6, em JavaScript, HTML e CSS, sem etapa de build.
O README anterior descreve a versão 3.1 e contém uma estrutura de diretórios ilustrativa que não corresponde ao checkout.
Não há políticas SQL do Supabase, esquema do banco ou testes de navegador neste repositório.

## Mapa dos fluxos existentes

| Fluxo | Arquivos principais | Dependências |
| --- | --- | --- |
| Atendimento e cotação | scripts/whatsapp_tool.js, styles/whatsapp.css | DOM do WhatsApp, tarifários e atalhos locais |
| Captura de fornecedores | src/gyg.ts, scripts/generated/gyg.js, scripts/*_extract.js, scripts/*_bridge.js | DOM das plataformas; PDF no Civitatis |
| Preenchimento ICD | scripts/ingresso_master.js, background.js | Mensagens entre abas, formulários antigos e React |
| Vouchers | scripts/voucher_tracker.js, scripts/enviar_voucher.js, background.js | DOM, downloads e nome compartilhado no storage |
| E-mail e relatórios | scripts/mail_tool.js, scripts/relatorio_tool.js | Webmail Locaweb e relatórios ICD |
| Remarcação | scripts/remarcacao_tool.js | Formulários e navegação do ICD Grupo |
| Registro de estornos | scripts/icd_sheet_*.js, scripts/icd_pagarme_hook.js, apps-script/Code.gs | Pagar.me, ICD Grupo e Apps Script configurado localmente |
| Configurações | popup.js, scripts/options.js | chrome.storage.local e backup JSON |
| Métricas e alertas | scripts/metrics.js, scripts/metrics_queue.js, background.js, dashboard/dashboard.js | Supabase REST e alarmes do Chrome |

## Primeira entrega: estabilização das métricas

- Content scripts solicitam registro; apenas o background modifica a fila.
- Gravação e envio são serializados. Chamadas simultâneas de envio compartilham a mesma operação.
- Fila mantida em metricsQueue, compatível com eventos já armazenados.
- Eventos novos recebem detalhes.evento_id, sem exigir uma coluna nova no banco.
- Lotes de até 100 eventos, timeout de rede de 15 segundos, retentativa no alarme de um minuto.
- Monitor de atividade usa alarme de cinco minutos. Alarmes ausentes são recriados ao carregar o worker e ao iniciar o navegador.
- Falha na consulta de atividade não produz novos alertas de ausência de atividade.
- Backup de configurações exclui a fila operacional; restauração não substitui a fila ativa.

Limites: a entrega é pelo menos uma vez após persistência local. Se o servidor aceitar um lote e a resposta se perder, ou o worker encerrar antes da limpeza local, uma retentativa pode duplicar eventos. O ID prepara uma futura deduplicação no servidor, mas ainda não a implementa. Se a mensagem de registro falhar antes da persistência, o evento não está garantido.

Após atualizar a extensão, recarregar as abas integradas: scripts antigos já injetados continuam capazes de escrever na fila até o recarregamento.

## Próximas entregas

### Segunda entrega: piloto Headout em TypeScript

Implementado em `src/headout.ts`, com modo strict e saída em `scripts/generated/headout.js`.
O piloto foi compilado e testado, mas desativado no manifesto após a confirmação de que Headout saiu da operação. A fonte e a saída ficam como referência para reaproveitamento. O arquivo antigo `scripts/headout_extract.js` permanece como referência e não é mais carregado.

Contrato inicial: `versao`, `origem`, `bookingId`, `nome` e `email`. Não são inventados produto, data, valor ou passageiros.
O botão CONFERIR abre um diálogo isolado por Shadow DOM, permite correções e exige código, nome e e-mail válidos.
Cancelar ou pressionar Escape não publica a captura. Somente a confirmação grava `bridgeData`, consumido pelo fluxo existente no ICD.
A leitura usa os cabeçalhos da tabela da própria linha, remove o botão injetado antes de ler a célula e apresenta diagnóstico se as colunas esperadas desaparecerem.
O monitor de linhas usa MutationObserver com agendamento, substituindo a varredura periódica do piloto anterior.
O preenchimento no novo ICD preserva o nome Headout revisado, sem a limpeza agressiva que removia sequências longas em maiúsculas.

Preparação: `npm ci`. Compilação: `npm run build`. Tipos: `npm run typecheck`. Testes: `npm test` (compila antes de testar).
A saída compilada faz parte da entrega: o Chrome continua carregando a pasta diretamente, sem Node instalado no computador dos operadores.
As dependências são apenas de desenvolvimento. Não editar a saída gerada; editar a fonte TypeScript e recompilar.

Validação automatizada: dez testes, incluindo os cinco da fila, executados sem serviços de produção. Os testes DOM usam jsdom; não validam aparência, foco nativo ou compatibilidade com o HTML real atual dos fornecedores.
Validação manual pendente: recarregar extensão e abas; abrir uma reserva Headout de teste; cancelar e confirmar capturas; conferir os campos no ICD antigo e novo. O fluxo não clica em salvar a reserva no ICD.

Limites: a revisão ocorre na origem, antes de disponibilizar os dados; ainda não há comparação com campos já preenchidos no destino. bridgeData continua global entre abas e pode substituir uma captura anterior. O piloto não muda os dados já pendentes nem as outras integrações. A eliminação de dados fictícios legados (como nascimento padrão) e o controle por aba/reserva devem ser tratados na refatoração do preenchimento de destino.

1. Validar Supabase: esquema, autenticação e políticas RLS por usuário/equipe; adicionar deduplicação por evento. Chave anon no cliente não comprova acesso indevido. isChefe é preferência local de notificações, não autorização.
2. Definir contrato de reserva e migrar uma integração piloto para TypeScript: capturar, normalizar, validar, revisar e preencher. GetYourGuide passa a ser o candidato para a próxima migração, pois está em uso e já possui extrator. Headout saiu da operação.
3. Separar adaptadores por plataforma e funções puras para datas, dinheiro e passageiros; adicionar fixtures sem dados pessoais reais.
4. Entregar conferência de reserva com campos ausentes e divergências antes do preenchimento.
5. Centralizar tarifários e mensagens com vigência e histórico; depois pendências e histórico por reserva.
6. Filtrar e agregar dashboard no servidor; diferenciar eventos de uso, resultados de processo e disponibilidade declarada do operador.

## Validação

Testes locais, sem rede: `node --test tests/metrics_queue.test.cjs`.

Validação no Chrome ainda necessária: recarregar a extensão e as abas; registrar ações em duas abas; verificar envio e fila; simular indisponibilidade de rede e recuperação; verificar alarmes após suspensão do service worker. Executar em ambiente de teste para não criar métricas artificiais de produção.

Esta entrega não altera schema do banco nem publica uma versão. O checkout recebido não contém metadados Git.

## Plataformas atuais — informação confirmada pelo responsável

| Plataforma | Situação no repositório | Próximo passo |
| --- | --- | --- |
| GetYourGuide (Get) | src/gyg.ts e scripts/generated/gyg.js | Captura TypeScript e conferência implementadas; validação real pendente |
| Grayline / TourCMS | scripts/grayline_extract.js | Migrar após consolidar o contrato comum |
| Civitatis | scripts/civitatis_bridge.js | Preservar leitura PDF e conferência existentes |
| Ticket GO | scripts/ticketgo_bridge.js | Migrar captura para contrato comum |
| Viator | Não foi localizada integração específica | Obter URL do portal e conhecer o fluxo utilizado |
| Trekzy | Não foi localizada integração específica | Obter URL do portal e conhecer o fluxo utilizado |
| Headout | Fora de uso; scripts preservados como referência | Injeção e permissão do domínio removidas do manifesto |

As funcionalidades internas de navios, remarcação, estornos, e-mail e vouchers permanecem fora desta mudança de fornecedores.

## Terceira entrega: GetYourGuide em TypeScript

O manifesto carrega `scripts/generated/reserva_review.js` e `scripts/generated/gyg.js`. A fonte está em `src/reserva_review.ts` e `src/gyg.ts`; `scripts/gyg_extract.js` permanece apenas como referência histórica, sem carregamento.

- O botão CONFERIR RESERVA abre revisão de código GYG, nome completo, e-mail e telefone.
- Código e nome são obrigatórios. Contatos podem ficar vazios; valores preenchidos são validados.
- Sem código único na página, o campo fica vazio com aviso para correção manual. Nomes são capturados apenas a partir de rótulos conhecidos, sem busca genérica por palavras que possam parecer nomes.
- Nomes longos, acentos, apóstrofos e hífens são preservados. O novo ICD ignora a limpeza agressiva para reservas GYG com contrato versão 1. Dados legados continuam com o comportamento anterior.
- E-mail relay customer-* é priorizado. Havendo vários candidatos, não se escolhe um arbitrariamente. Telefone é lido do href tel:, mesmo quando o link só diz “Ligar”.
- Nenhuma gravação ocorre antes de confirmar. Cancelamento preserva os dados anteriormente pendentes. Falha ao gravar mantém a revisão aberta com opção de tentar novamente.
- Gravação em `dadosPedido` mantém compatibilidade com ICD antigo e novo. Não há envio adicional por mensagem; os destinos já observam mudanças no storage.
- O diálogo compartilhado isola estilos por Shadow DOM e usa dialog nativo para navegação por teclado. Dados capturados entram via value/textContent, sem interpolação HTML.

Verificações: compilação strict e 17 testes automatizados, incluindo revisão, ambiguidade, contatos ausentes, cancelamento, retentativa e compatibilidade dos campos de destino. Fixtures sintéticas, sem reservas reais.

Validação manual pendente: recarregar extensão e abas; abrir detalhes de uma reserva GYG de teste; conferir extração; cancelar; corrigir e confirmar; verificar o preenchimento no ICD. Produto, data e valores continuam fora da captura. O armazenamento continua compartilhado entre abas, e o fluxo legado de destino ainda usa um nascimento padrão: estes pontos exigem uma próxima etapa própria.

Viator e Trekzy estão adiadas por solicitação do responsável. As próximas integrações ativas são Grayline, Civitatis e Ticket GO.

## Quarta entrega: preparação da primeira etapa de reserva no ICD

Implementada após receber HTML da reserva GYG e dos quatro controles MUI no ICD.

- A captura prioriza os data-testid de nome, e-mail e telefone fornecidos no exemplo real. Passeio e modalidade vêm do bloco do produto associado a conduction-time.
- Data é convertida explicitamente para YYYY-MM-DD, sem parsing dependente de locale ou fuso. Formatos suportados: ISO, DD/MM/YYYY, mês inglês e datas textuais em português. Datas impossíveis são rejeitadas.
- A conferência GYG inclui passeio, modalidade, data e fornecedor. Fornecedor é um nome exato do cadastro ICD informado pelo operador: não foi fornecida uma associação confirmada para Sugarloaf Cable Car e não se presume uma.
- Na rota /apps/sales/bookings/new, o botão PREPARAR RESERVA OTA usa a reserva confirmada em dadosPedido para escolher OTA's, 000 GetYourGuide, fornecedor e data, nessa ordem. O piloto está limitado a GetYourGuide.
- Seleções usam rótulos e componentes MUI, sem depender dos IDs numéricos ou classes jss. Autocomplete exige uma opção de texto exato e confirmação de fechamento do menu. Falhas restauram o texto anterior e interrompem a sequência.
- O calendário usa o bloco Data da visita, navega até o mês alvo e confirma a classe de seleção do dia. Dias ocultos/desabilitados e datas a mais de 24 meses do calendário exibido não são clicados.
- Horário não é capturado nem alterado. Nenhuma reserva é salva ou confirmada automaticamente no ICD. Seleções anteriores bem-sucedidas não são desfeitas se uma etapa posterior falhar; o painel informa onde parou.
- Sem fornecedor, prepara apenas canal e distribuidora e pede seleção manual. Sem data, prepara os três primeiros campos e pede seleção manual. Não altera a fila de dados nem remove a reserva após preparar a primeira tela.

Uso: recarregar extensão e abas; conferir uma reserva GYG; revisar passeio/data e informar o nome exato do fornecedor no ICD; confirmar; abrir nova reserva no ICD e clicar PREPARAR RESERVA OTA; revisar os campos e escolher o horário manualmente antes de continuar.

Validação: 24 testes locais, cobrindo extração estruturada, persistência dos novos campos, datas inválidas, navegação do calendário, correspondência exata de opções, dias indisponíveis e preservação do horário. Validação no site real permanece pendente: os testes simulam componentes e não executam o aplicativo React do ICD. Os HTMLs pessoais enviados não foram incorporados como fixtures; os testes usam dados sintéticos.

### Correção após gravação de teste: associação de fornecedor

A gravação mostrou passeio e data capturados corretamente, mas fornecedor vazio: faltava a associação entre o título comercial e o cadastro interno. A associação exata `Rio de Janeiro: Sugarloaf Cable Car` → `Bondinho Pão de Açúcar` foi incluída em `src/fornecedor_map.ts`, compartilhada pela captura GYG e pela preparação ICD.

A conferência apresenta o fornecedor associado preenchido e editável. A preparação resolve a mesma associação para capturas já confirmadas com passeio e fornecedor vazio, sem exigir uma nova captura. Um fornecedor explicitamente informado mantém prioridade. Combos ou títulos diferentes não recebem a associação por semelhança; precisam de cadastro próprio ou correção manual.

O fluxo continua aguardando a seleção do fornecedor antes de acessar o calendário. Adicionados testes de regressão para calendário disponibilizado apenas depois dessa seleção e para correspondência por título completo. Total: 26 testes. A gravação confirma os nomes usados, mas a correção ainda requer reteste no React real do ICD.

### Etapas da reserva e regras por atração

Nova gravação mostra que Bondinho, Saveiros e Maracanã podem apresentar uma etapa adicional “Selecione o passeio”, enquanto outros fornecedores seguem direto ao calendário. As regras completas ainda serão fornecidas pelo responsável. Não automatizar modalidade, produtos ou quantidades por suposição.

Corrigido o preenchimento GYG versão 1 na tela seguinte: aguarda campos exatos de nome e e-mail na rota de nova reserva, observa inserção tardia dos controles sem depender da janela inicial de tentativas e só consome os dados após conferir todos os valores disponíveis. Campos não vazios divergentes impedem o preenchimento, preservando edições manuais. Não altera nascimento, país ou sexo neste fluxo. O comportamento legado de outras integrações permanece separado.

O vídeo mostra a segunda etapa com campos em branco e um nascimento padrão. Antes, qualquer campo parcialmente reconhecido podia disparar a limpeza da reserva após cinco segundos. Esse critério foi removido para o piloto GYG. Testes atualizados para primeira etapa sem cliente, transição aos campos do cliente, preservação de nome manual e ausência de nascimento inventado. Verificação real do fluxo completo ainda pendente.

### Correspondências confirmadas pelo responsável

| Passeio na GetYourGuide | Fornecedor no ICD |
| --- | --- |
| Christ the Redeemer Entry Ticket by Corcovado Train | Trem do Corcovado |
| Rio de Janeiro: Sugarloaf Cable Car | Bondinho Pão de Açúcar |
| Rio de Janeiro Aquarium: AquaRio Entrance Ticket | AquaRio Porto Maravilha |
| Rio de Janeiro: Maracanã Stadium Entrance Ticket | Tour Maracanã |

As quatro associações estão disponíveis na conferência e na preparação do ICD. O reconhecimento ignora diferenças de maiúsculas, acentos e espaços repetidos, mas exige o título completo. As associações identificam o fornecedor; não definem modalidade interna, produtos, quantidades ou regras de cada atração. Total de testes: 27.

### Regra Bondinho e leitura da data

Regra informada pelo responsável: a modalidade GYG `Skip the Line Ticket | Skip-the-Line Cable Car Ticket` seleciona o passeio ICD `Acesso rápido e amanhecer`. As demais modalidades selecionam `Bilhete Normal`. Textos das opções informados pelo responsável em resposta à pergunta sobre os nomes no ICD.

O Bondinho aguarda o campo “Selecione o passeio” e confirma a opção antes de acessar o calendário. Para outras atrações com esse campo e sem regra cadastrada, a extensão solicita a seleção manual antes de continuar. O horário permanece manual.

A leitura de conduction-time passa a aceitar data acompanhada de horário, dia da semana e elemento time com datetime. Duplicações desktop/mobile com a mesma data são aceitas; datas divergentes continuam exigindo revisão. A procura do título/modalidade tolera níveis intermediários no bloco do produto. Não procura datas arbitrárias no corpo da página.

No calendário, aguarda o dia ficar disponível após carregamento e ignora dias de animações de saída. Os testes incluem passagem pela modalidade Bondinho antes de disponibilizar o calendário e leitura sintética de Maracanã com data e horário. Total: 32 testes. O HTML específico da reserva Maracanã com falha ainda não foi fornecido; portanto a causa real da captura vazia e o resultado no site precisam de confirmação.

### Modalidade Maracanã

Após confirmação do responsável de que o fluxo anterior está funcionando, adicionada a regra: `Rio de Janeiro: Maracanã Stadium Entrance Ticket` → `Tour Regular`; `Monitored Tour | Rio de Janeiro: Maracanã Stadium Entrance Ticket` → `Tour Guiado`. A indicação guiada tem prioridade e é reconhecida no título ou no campo de modalidade. A opção do passeio é selecionada antes da data. Horário continua manual. Teste de integração local cobre as duas opções e título guiado completo. Total: 33 testes.

## Painel de configurações, WhatsApp e cotações

Painel: resumo de cadastros, buscas por conteúdo e categorias, prévia textual das mensagens, cancelamento de edição de passeio, navegação de abas por teclado e rótulos acessíveis. Mantém configMaster, listaPastas e listaPasseios. Validação de tarifas rejeita categorias duplicadas, preços negativos e mais de duas casas decimais; aceita categoria gratuita com valor zero. As buscas preservam os índices de edição. A renderização de atalhos não acrescenta metadados aos registros persistidos.

WhatsApp: busca por nome, mensagem e pasta sem depender de acentuação. Atalho para configurações. Calculadora em `src/cotacao_ui.ts`, com cálculo compartilhado em `src/cotacao.ts`: reúne vários passeios, mostra prévia e remove itens; trabalha em centavos e valida quantidades inteiras. Minimizar mantém os itens; fechar descarta a cotação em memória. Mudança de tarifários bloqueia a cópia e oferece atualização que limpa os itens antigos. Falha no clipboard permite copiar manualmente pela prévia.

### Correções após gravação do WhatsApp

A gravação mostrou CSS aplicado, mas texto escuro e fonte padrão em partes da calculadora. O reset `all:initial` no elemento hospedeiro prevalecia sobre a regra :host. Fonte, cor e alinhamento agora são definidos no painel interno, com cor explícita no título e total, preservando o isolamento do Shadow DOM.

Abrir opções diretamente pelo content script falhava. Os botões Configurações e Editar tarifários usam `ABRIR_CONFIGURACOES`; o background trata a mensagem em `scripts/options_bridge.js`, abre a página e retorna sucesso ou falha. A prévia local simula a mesma mensagem.

Validação: compilação TypeScript e 44 testes, incluindo abertura pelo background e mensagem de erro no botão da calculadora. Layout verificado pela gravação fornecida e análise das regras CSS; reteste visual da correção no WhatsApp real ainda necessário. Recarregar a extensão e a aba do WhatsApp após atualizar, pois a mudança inclui o background.

Prévia com dados fictícios: `npm run preview`, em http://127.0.0.1:4178/options.html e http://127.0.0.1:4178/cotacao. Não usa dados reais do navegador; cadastros de demonstração ficam em memória.

## Importação assistida de tarifários do ICD

Baseada no HTML da tabela Produtos fornecido pelo responsável. Novo módulo `src/tarifario_import.ts`, carregado na tela de nova reserva junto de cotacao e reserva_date.

O botão IMPORTAR TARIFÁRIO aparece quando a tabela com Produto, Tipo de produto e Preço unitário está disponível. Exige canal, fornecedor e data selecionados; captura distribuidora, modalidade e horário quando presentes. Não altera qualquer campo do formulário, quantidades ou carrinho, e não cria reservas nem faz autenticação. Usa somente o conteúdo da sessão já aberta pelo operador.

Uma prévia lista as categorias, valores unitários e o contexto; Cancelar não grava nada. Confirmar revalida preços e seleções antes de salvar em listaPasseios. Mesmo produto/canal/distribuidora/fornecedor/modalidade/data/horário atualiza a consulta importada anterior; contextos diferentes criam registros separados. Cadastros manuais são preservados. Não se presume que os preços sejam válidos para outras datas ou horários.

A calculadora identifica canal/distribuidora no seletor e mostra origem, consulta, data e horário em uma nota. O nome do tarifário contém produto, modalidade, data e horário, para diferenciar consultas. Canal e distribuidora não são acrescentados à mensagem do cliente. O painel mostra a origem; edição manual posterior é identificada e não é apresentada como uma nova consulta ao ICD.

Limites: não consulta datas automaticamente e não sincroniza navegadores ou operadores. O salvamento usa leitura e escrita do storage como os cadastros existentes; evitar edição simultânea de tarifários em abas diferentes. Validação automatizada: 52 testes, incluindo contexto na calculadora, edição manual de origem importada, seis categorias do exemplo, valores brasileiros, atualização por contexto, preservação de cadastros manuais, bloqueio de preços alterados e cancelamento. Reteste visual e funcional no ICD real pendente.

Uso: recarregar extensão e a aba ICD, selecionar o passeio e a data, aguardar a tabela, clicar IMPORTAR TARIFÁRIO e revisar antes de confirmar. Se a calculadora estiver aberta, ela avisará da mudança; atualizar os tarifários nela limpa os itens da cotação em andamento.

### Apresentação simplificada e importação de disponibilidade

Por solicitação do responsável, os tarifários exibem ingresso/modalidade e valores, sem datas, horários ou disponibilidade. O nome visível é derivado do produto original, inclusive para importações antigas; metadados da consulta continuam armazenados internamente e não entram na mensagem da cotação.

Adicionado IMPORTAR DISPONIBILIDADE acima de IMPORTAR TARIFÁRIO. Lê o texto completo das opções de Hora da visita, incluindo opções desabilitadas, sem selecionar um horário. Suporta select nativo e menu MUI renderizado em portal. Listas que declaram virtualização parcial são recusadas para evitar importar apenas uma parte. Precisará de validação no menu real do ICD, cujo HTML ainda não foi fornecido.

Prévia separada exige confirmação para gravar em disponibilidadesICD. Registra fornecedor, modalidade, canal, distribuidora, data da visita e instante da consulta; atualiza apenas a consulta do mesmo contexto. A calculadora oferece Ver disponibilidade, separado dos ingressos/preços, mostrando as opções e identificando a data e a consulta pontual. Não reserva vagas e não promete disponibilidade em tempo real. Não interpreta nem calcula vagas a partir de um formato textual presumido.

Validação: 56 testes, incluindo leitura integral de select e portal MUI, preservação do horário selecionado, bloqueio de gravação após troca de data e consulta separada no WhatsApp. Recarregar extensão e abas ICD/WhatsApp para testar a nova versão.

### Disponibilidade destinada ao cliente

Correção de escopo solicitada pelo responsável: disponibilidade removida da calculadora. IMPORTAR DISPONIBILIDADE agora abre uma prévia com mensagem pronta e botão Copiar disponibilidade. A mensagem inclui atração/modalidade, data da visita, texto completo das opções e instante da consulta; omite canal e distribuidora internos. Nenhuma mensagem é enviada automaticamente. O novo fluxo apenas copia, sem gravar a consulta no storage; consultas já salvas anteriormente são preservadas, mas não aparecem na calculadora. Falha no clipboard seleciona a prévia para cópia manual. Total: 58 testes.

## Vouchers, e-mails, remarcações e registros de estorno — primeira entrega

Conferência compartilhada em `src/operacao_review.ts`, com resumo dos dados e cancelamento sem executar a ação. Os valores são exibidos como texto, isolados por Shadow DOM.

Webmail: `src/email_compose.ts` substitui o preenchimento automático por REVISAR E PREENCHER E-MAIL. Mostra destinatário (ou lista CCO), assunto e mensagem; confirma a presença dos campos e do editor antes de aplicar. Preserva assinatura, evita duplicar a mensagem e não transforma texto da mensagem em HTML. Rascunhos com destinatário ou assunto divergentes não são sobrescritos. Dados pendentes são consumidos somente depois de conferir o preenchimento; outro payload novo não é removido ao terminar o anterior. Envio e anexos permanecem manuais. Mantido suporte a textarea e editor em iframe acessível.

O monitor de métricas de e-mail é iniciado apenas uma vez e deixa de usar a classe genérica .lm-btn-dark como evidência de envio. Métricas ainda representam cliques, sem comprovar entrega do e-mail.

Vouchers: removida a reaplicação de dados de reservas pendentes no script da página de voucher. Renomeação limitada a PDFs com origem/referrer nos domínios ICD. Nomes são saneados para caracteres de arquivo, caminhos, nomes reservados do Windows e tamanho máximo. A extensão não implementa anexo automático nesta entrega.

Remarcação: mantém regras existentes de unidade e pagamento; mostra voucher de origem, e-mail, regra e referência antes de gravar remarcacaoDados. Data, horário e produtos da nova reserva continuam sob escolha do operador.

Estornos: revisão antes de enviar a linha PIX ao Apps Script ou a linha combinada ICD/Pagar.me. Mantidas validações de voucher, transação e divergência de e-mail. Isso registra informações na planilha; não executa reembolso financeiro. Não houve alteração nas regras do Apps Script ou no banco.

Verificações: compilação e 68 testes locais, incluindo assinatura, editor HTML/texto, CCO, editor ausente, rascunho divergente, payload substituído, cancelamento da remarcação, confirmação PIX e nomes de arquivo. Sintaxe dos scripts legados e ordem das dependências no manifesto também verificadas. Validação nas telas reais de webmail, ICD e Pagar.me ainda pendente; os testes não enviam e-mails nem acessam serviços externos.

Uso: recarregar extensão e as abas envolvidas. Ao abrir a composição do webmail, clicar REVISAR E PREENCHER E-MAIL. Na remarcação e no registro de estorno, conferir o resumo antes de continuar.

## E-mails por relatório

Novo fluxo TypeScript em `src/relatorio_email.ts`, substituindo o carregamento de scripts/relatorio_tool.js. Preserva emailAssunto e emailCorpo, inclusive modelos antigos sem variáveis. O painel E-mail oferece inserção de {{operador}}, {{passeio}}, {{data_visita}} e {{horario}}, prévia com exemplos e validação antes de salvar.

No relatório, há seleção individual, busca por texto da linha, selecionar encontrados, limpar seleção e contagem de linhas/e-mails únicos. Endereços são deduplicados sem diferenciar maiúsculas e minúsculas. Linhas com mais de um endereço distinto não recebem seleção automática, para evitar escolher o contato errado. Releitura da tabela não duplica controles e descarta a seleção se o endereço da linha mudar.

O operador preenche os dados do aviso quando o modelo os utiliza. Revisar e abrir webmail mostra lista CCO, assunto e corpo completos antes de gravar dadosParaEmail e abrir a composição. Campos usados pelo modelo e não preenchidos bloqueiam a preparação. O envio final permanece manual; o webmail usa a conferência já implementada. Não personaliza nome de cliente em mensagens CCO e não presume regras/limites de envio do provedor.

Validação: 72 testes locais, incluindo deduplicação, variáveis, cancelamento, ausência de dados, seleção por busca e tabela atualizada. Testes não enviam mensagens nem usam clientes reais. Reteste no relatório e webmail reais pendente. Recarregar extensão, painel e relatório depois da atualização.

### Seleção por passeio e faixa de horário

Adicionados passeio com sugestões dos produtos do relatório, data opcional, início e fim inclusivo. “Marcar somente esta faixa” substitui a seleção anterior pelos registros correspondentes. Fim vazio significa a partir do início até 23:59; sem data, considera todos os dias presentes. Intervalos invertidos são rejeitados sem alterar a seleção.

A leitura procura os cabeçalhos Data prevista e Produto / Promoção (ou Produto/Passeio) e usa somente essas colunas originais, excluindo os controles adicionados pela extensão. Não usa validade do produto como data de visita. Cabeçalhos repetidos por grupo são tratados. Passeio exige correspondência completa sem depender de acentos ou maiúsculas. Linhas não reconhecidas ficam de fora; se nenhuma linha puder ser interpretada, a seleção anterior é preservada e é exibida uma explicação.

O passeio, a data opcional e o período selecionados também preenchem os campos do modelo. A deduplicação de e-mails e a prévia anterior ao webmail permanecem. Testes de limites 09:00–11:00, horário em diante, datas distintas, validade do produto e intervalo inválido. Total: 74 testes locais; interpretação do relatório real precisa de reteste após recarregar a extensão e a página.

### Seleção pelo título do bloco

Ajustado conforme o HTML visível no print: linhas de título com célula colspan e span.style8 centralizado (ou fundo #999999) delimitam grupos. O título, como 0TREM DO CORCOVADO, tem prioridade sobre o texto dos produtos nas linhas. Cada título vale até o próximo título dentro da mesma tabela; não atravessa tabelas. Cabeçalhos e subtotais não são destinatários.

O filtro agora usa uma lista de títulos, sem exigir digitação do nome. Reservas com produtos/promocões diferentes dentro do mesmo grupo são selecionadas pelo horário da Data prevista. Em relatórios sem títulos reconhecidos, mantém a leitura por produto como compatibilidade. Adicionado teste com vários grupos, tabelas e produtos distintos. Total: 75 testes; os sete testes do relatório foram executados após essa alteração.

## E-mails por relatório em lotes de até 100

Limite por mensagem informado pelo responsável: 100 destinatários. O background divide os endereços únicos em lotes de até 100, congela assunto/mensagem para a campanha e salva o acompanhamento em icdCampanhaEmail. O serviço scripts/email_batches.js serializa atualizações entre abas e valida ID e índice, impedindo que duas confirmações simultâneas avancem dois lotes.

Fluxo: selecionar destinatários → revisar primeiro lote → preparar no webmail → enviar manualmente → voltar ao relatório → Marcar lote como enviado → preparar próximo lote. Cada lote tem revisão própria. Abrir/preencher o webmail não avança o acompanhamento. Reabrir o mesmo lote prepara os mesmos destinatários e pede revisão explícita; não deve ser usado se a mensagem já foi enviada.

O painel retoma o progresso salvo ao carregar e oferece Atualizar progresso e Encerrar acompanhamento. Só uma campanha ativa é permitida por navegador. Encerrar não fecha nem cancela rascunhos já abertos no webmail. Campanha e rascunho pendente são excluídos de exportação/restauração de configurações para não ressuscitar lotes antigos. O controle depende da confirmação do operador e não comprova entrega nem aplica limites por hora/dia do provedor.

Testes incluem 235 destinatários em 100/100/35, deduplicação, retomada, reabertura sem avanço, conflito entre abas, preservação de outro e-mail pendente e avanço manual no painel. Total: 80 testes locais. Nenhum e-mail real foi enviado. Recarregar extensão (incluindo background), relatório e webmail antes do teste de operação.

## Atalhos com idiomas e busca unificada

O texto original em configMaster.texto continua sendo usado em português. Versões opcionais ficam em traducoes.es e traducoes.en no mesmo registro; editar, organizar e exportar preservam os campos. A edição permite remover uma versão deixando o campo vazio. Não há serviço de tradução ou novas dependências.

No WhatsApp, o seletor junto ao botão oferece apenas versões cadastradas. Escolher o idioma não insere a mensagem; clicar no botão insere a versão escolhida pelo fluxo existente. Atalhos antigos continuam funcionando. A busca procura nome, pasta e textos dos três idiomas, ignora acentos e consulta todas as pastas mesmo a partir de uma pasta aberta. Resultados exibem a pasta de origem; limpar a busca retorna à pasta anterior.

Validação: 85 testes passaram, incluindo cadastro/edição/remoção de versões, prévia como texto literal, seleção de idioma e busca global a partir de outra pasta. Recarregar extensão, configurações e WhatsApp Web para carregar os scripts novos. Validação em uma sessão real de WhatsApp ainda depende do teste operacional.

### Correção do editor de idiomas

O seletor agora escolhe o campo editável da mensagem, além da prévia. Apenas o texto do idioma ativo aparece; alternar mantém os rascunhos dos outros idiomas. Salvar mantém o registro e o idioma ativos para permitir cadastrar PT, salvar, escolher ES e salvar no mesmo botão. Novo atalho / sair da edição limpa o formulário. O WhatsApp preserva a escolha de idioma durante buscas e mudanças de pasta nesta aba e dispõe o seletor em uma linha própria. Testes de regressão cobrem o cadastro sequencial sem sobrescrever português ou duplicar o atalho.

### Idiomas compactos no WhatsApp

O seletor permanente foi substituído por bandeiras sob demanda. Atalhos com mais de uma versão mostram um indicador de idiomas; clicar abre as versões cadastradas sem inserir texto. Escolher PT, ES ou EN insere a versão correspondente pelo fluxo existente e recolhe as opções. As bandeiras usam SVG local inline, com sigla e rótulo acessível. Escape, clique fora, novo clique no botão ou uma nova busca fecham as opções; atalhos de idioma único mantêm o clique direto. O editor das configurações continua com o seletor de idioma para cadastrar as mensagens.

## Preferências de funcionalidades por navegador

A aba Funcionalidades oferece dez chaves independentes para exibir atalhos WhatsApp, calculadora, importação de plataformas, tarifário, disponibilidade, remarcações, coleta PIX, navio, relatório de e-mails e voucher/webmail. Preferências em icdFuncionalidades no chrome.storage.local; ausente ou diferente de false mantém o comportamento anterior. Os cadastros não são apagados. A preferência acompanha o backup geral de configurações.

Um script comum no document_start de cada frame isolado aplica apenas CSS aos elementos da extensão, com atualização via storage.onChanged (sem observador do DOM adicional). Os módulos TypeScript de relatório, GYG, preparação OTA, tarifário, disponibilidade e revisão de e-mail aguardam as preferências antes de iniciar; se desativados, iniciam apenas ao reativar. Cada inicialização acontece uma vez por página. Desativar durante a execução oculta o painel, mas não encerra os observadores já iniciados: recarregar a página é necessário para evitar essa inicialização. Ferramentas legadas são controladas pela visibilidade dos botões, sem interromper operações já iniciadas.

Chaves com rótulos acessíveis, estado textual, salvamento automático e aviso em falha. Escritas sequenciais preservam outras chaves. Validação: 91 testes passaram, incluindo defaults, atualização entre contextos, preservação de dados, reativação e falha de armazenamento; manifesto verificado quanto aos arquivos referenciados. Falta a validação operacional nas páginas autenticadas.

## Conferência de vouchers, pendências, backup seletivo e diagnóstico

O botão Conferir voucher e preparar e-mail está disponível no voucher antigo e nos detalhes de reservas do novo ICD; acompanha mudanças de rota sem aparecer em Nova Reserva. A captura usa rótulos exatos e deixa campos ambíguos vazios. Cliente, e-mail e reserva são obrigatórios; passeio/data são opcionais. O operador revisa antes de salvar uma nova preparação e abrir o webmail. Uma pendência existente é explicitada e mudanças durante a revisão impedem sobrescrita. Texto pendente com mesmo destinatário/assunto é preservado. O contexto do voucher acompanha a revisão no webmail. Anexar e enviar continuam manuais.

Remarcação e estornos usam um quadro de pendências para dados obrigatórios ausentes ou e-mail inválido, sem mudar as regras de negócio e sem transmitir dados ao fechar esse quadro.

Backup: categorias de atalhos/pastas, tarifas, anotações, modelos de e-mail e preferências/funcionalidades. Apenas essas chaves são exportadas/restauradas; tokens, identidades de operador, reservas, filas e campanhas não são importados. Arquivos antigos com essas chaves continuam aceitos. Modo padrão acrescenta itens novos mantendo os existentes por nome/pasta, chave de importação/nome de passeio ou texto da nota; conflitos de ID recebem um novo identificador. Modo substituir afeta só as chaves presentes nas categorias selecionadas. Revisão mostra contagens, validação rejeita formatos inválidos e alterações concorrentes bloqueiam restauração. O painel pede recarregamento após importar.

Diagnóstico: nova aba, execução manual, consulta controles nas abas compatíveis por mensagens locais da extensão. O texto copiado contém versão, estado de configuração e nomes de sites/controles, sem nomes de clientes, conteúdo, códigos ou tokens. Ausência de controles é um indício a conferir, não prova de mudança do site. Não foram adicionadas permissões nem serviço externo.

Validação: suíte de 99 testes passou, mais um teste de navegação do botão de voucher (100 testes no total), TypeScript e sintaxe dos scripts alterados verificados; referências do manifesto e options conferidas. Sem envio real de e-mail ou registro de estorno. Captura e disposição visual ainda precisam do teste operacional nas páginas autenticadas. Recarregar extensão, painel e páginas de atendimento para aplicar.
