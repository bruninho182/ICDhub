# Publicação do ICD Hub 3.7.2 na Chrome Web Store

## Arquivo para enviar

Gere o pacote com `npm run package`. O arquivo fica em `dist/ICD-Hub-3.7.2.zip`, com o manifesto na raiz. O gerador inclui apenas os arquivos usados pela extensão e uma cópia da política de privacidade; não inclui dependências de desenvolvimento, Git, testes, vídeos ou screenshots do repositório. O checksum SHA-256 acompanha o ZIP.

## Política pública

URL: https://bruninho182.github.io/pp-ICDHUB/

As métricas ficam desligadas até o operador ativá-las na aba Funcionalidades, após o aviso sobre os dados enviados ao Supabase. Backups não importam essa autorização.

A política descreve o comportamento da versão 3.7, inclusive os dados pessoais processados localmente, as métricas identificadas por operador, as integrações com Supabase e Google Apps Script/Sheets e as limitações de exclusão/retencão. Os dados já enviados por versões anteriores não foram apagados.

## Declarações no painel da loja

A URL da política já pode ser mantida. Revise e atualize as categorias de tratamento, inclusive quando a operação é somente local:

- Informações de identificação pessoal: nome do operador, dados de contato e documentos de clientes usados nos fluxos.
- Comunicações pessoais: textos preparados/inseridos em WhatsApp, assunto/corpo e destinatários de e-mail.
- Informações financeiras e de pagamento: valores, métodos, códigos de transação/NSU tratados nas solicitações de estorno.
- Informações de autenticação: token configurado localmente para autenticar o endpoint da planilha. A extensão não solicita senhas dos clientes.
- Atividade do usuário: eventos operacionais, datas/horários e nome do operador nas métricas.
- Conteúdo do site: dados das reservas e relatórios lidos nas páginas compatíveis.

O diagnóstico consulta URLs das abas abertas para identificar as páginas compatíveis, sem guardar um histórico de navegação. Considere esse uso ao responder às perguntas de acesso a navegação no formulário da loja. Não declare ausência de tratamento de dados pessoais apenas porque parte dos dados permanece no navegador.

Finalidade única sugerida: apoiar o atendimento e a operação da Ingresso com Desconto, reunindo atalhos de comunicação, conferência e transferência de dados de reservas, cotações e registros operacionais nas plataformas utilizadas pela equipe.

## Permissões e revisão

- storage: configurações, cadastros e dados temporários dos fluxos, filas e campanhas.
- downloads: sugestão de nomes dos arquivos PDF dos vouchers.
- activeTab/scripting: extração solicitada pelo operador no fluxo Funpass.
- tabs: abertura das ferramentas, comunicação com páginas e diagnóstico sob demanda.
- alarms/notifications: envios periódicos de métricas, avisos operacionais e alertas de períodos sem eventos.
- host_permissions: acesso aos sistemas declarados e às integrações necessárias; o acesso Supabase foi restrito ao projeto utilizado.

A extensão usa bibliotecas JavaScript incluídas no ZIP. O leitor de PDF usa o worker local, sem alternativa de carregamento de JavaScript de CDN. Fontes e CSS externos ainda são usados em telas e estão descritos na política; isso não é carregamento remoto de JavaScript.

Forneça instruções de teste para telas que exigem login, usando um ambiente de demonstração com dados fictícios quando necessário. Atualize a descrição e capturas da loja para descrever a revisão de e-mails e o envio manual. A senha do dashboard é uma barreira de interface; o acesso ao banco depende das políticas do Supabase. As regras reais do banco e da planilha precisam ser verificadas pelo responsável pela infraestrutura.

A atualização de texto e os testes locais não substituem a avaliação da Chrome Web Store ou a validação das práticas da organização e das permissões nos serviços externos. Este trabalho não altera a publicação na Chrome Web Store nem os dados já existentes no Supabase/Sheets.
