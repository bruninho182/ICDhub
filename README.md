# 🚀 ICD Hub - Integrador Universal v3.0

O **ICD Hub** é uma extensão de alta performance iniclamente para Google Chrome porém hoje funciona em diversos navegadores, desenvolvida exclusivamente para otimizar o ecossistema de operações da **Ingresso com Desconto**. A ferramenta atua como o "cérebro" da operação, integrando plataformas de turismo, comunicação via WhatsApp e gestão de e-mails em um único fluxo automatizado.

---

## 📸 Demonstração
<img src="./screenshot/banner.jpg" alt="Banner do Projeto" width="100%">
*Central de Automação e Produtividade para Operadores de Turismo.*

---

## ✨ Funcionalidades de Elite

### 🧮 1. Calculadora de Cotação (WhatsApp)
Uma das ferramentas mais poderosas da versão 2.5. Permite que o operador realize orçamentos complexos sem sair da conversa com o cliente.
* **Cálculo em Tempo Real:** Selecione o passeio e ajuste as quantidades; o total é atualizado instantaneamente.
* **Formatador de Orçamento:** Gera automaticamente um texto formatado com negritos e marcadores pronto para ser colado no WhatsApp.
* **Interface Adaptável:** No modo "Topo", a calculadora e a busca se organizam horizontalmente para não obstruir a visão.

### 🟢 2. WhatsApp Sidebar Hub (Smart UI)
Barra lateral injetada no WhatsApp Web com controle total de layout.
* **Atalhos Rápidos:** Disparo de textos padronizados (PIX, Cartão, Reagendamento).
* **Sistema Drag & Drop (Base64):** Arraste imagens de vouchers e informativos diretamente para o chat.
* **Layout Dinâmico:** Posicionamento em **Esquerda**, **Direita** ou **Topo** com ajuste automático de grade (Grid) para os botões.

### 📧 3. Automação de E-mail (Locaweb)
Integração profunda com o Webmail Locaweb.
* **Preenchimento Inteligente:** Dados capturados das plataformas de reserva preenchem destinatário, assunto e corpo.
* **Preservação de Assinatura:** O script detecta a assinatura oficial do operador e a mantém no final do corpo do e-mail, injetando o texto no topo.
* **Disparo em Massa (CCO):** Preenchimento automático de múltiplos e-mails em Cópia Oculta a partir do relatório de visitas.

### 🌉 4. Bridge Multiplataformas & Sniper MUI
Ponte de dados entre sistemas internacionais e o sistema ICD.
* **Auto-fill Inteligente (Sniper MUI):** Bypassa o Virtual DOM do React (setNativeValue) no novo painel da ICD, forçando o preenchimento automático de campos dinâmicos e selecionando opções em dropdowns (Material-UI) automaticamente.
* **Smart Rename:** Renomeia automaticamente o título da aba do navegador com o `Código da Venda - Nome do Cliente`, facilitando a organização e o salvamento de PDFs.
* **Sincronização de Operador:** O nome do operador configurado é replicado em todos os registros de venda e logs.
* **Navio Ingressos Bridge:** Extrai dados de reservas do painel Navio e injeta automaticamente os dados via listener, sem necessidade de cliques adicionais no destino.
* **TicketGo Bridge:** Caça e extrai de forma inteligente telefones em campos dinâmicos (Order-Level Requirements), nomes, emails e Order Numbers.
* **Smart Rename & Vouchers:** Renomeia automaticamente o título da aba do navegador com o Código da Venda - Nome do Cliente, facilitando o salvamento de PDFs e localizando Vouchers pelo MuiChip-label.

### ⚙️ 5. Painel de Gestão (CRUD)
Área administrativa completa dentro das opções da extensão.
* **Gestão de Tarifários:** Adicione, exclua e **edite** passeios e categorias de preços (Adulto, Criança, etc.).
* **Configurador de Atalhos:** Personalize as mensagens e links de fotos que aparecem na barra do WhatsApp com suporte a Reordenação (Drag & Drop).
* **Gerador de Recibo PDF:** Motor nativo usando jsPDF para gerar recibos de pagamento formatados, com conversão de datas (BR) e cores padrão da marca.
* **CSistema de Backup Global:** Importe e exporte arquivos .json com todas as suas configurações (tarifários, e-mails, atalhos), blindando a operação contra perdas de dados.

---

## 🛠️ Tecnologias Utilizadas
* **Engine:** JavaScript (ES6+) e Chrome Extension API (v3).
* **Bypass de Frameworks:** Manipulação direta de protótipos (`Object.getOwnPropertyDescriptor`) para preenchimento forçado em React/Material-UI.
* **Storage & Listeners:** `chrome.storage.local` com `onChanged.addListener` para comunicação em tempo real entre diferentes abas.
* **UI/UX:** CSS Grid, Flexbox e componentes dinâmicos de interface limpa.
* **Bibliotecas Externas:** `jsPDF` para geração de relatórios e recibos client-side.
---

## 📁 Estrutura do Projeto
```text
ICDhub-main/
├── manifest.json            # Manifesto V3 (Permissões e Rotas)
├── options.html             # Painel Administrativo em Abas
├── options.js               # Gestão CRUD, PDF, Backup e Preferências
├── scripts/
│   ├── whatsapp_tool.js     # Sidebar, Calculadora e Lógica de Chat
│   ├── ingresso_master.js   # O "Cérebro": Automação, Sniper MUI e Bridge GYG/Grayline
│   ├── ticketgo_bridge.js   # Extrator inteligente para a plataforma TicketGo
│   ├── navio_bridge.js      # Extrator de dados para pré-venda Navio
│   ├── mail_tool.js         # Integração e Concatenação de Assinatura
│   ├── relatorio_tool.js    # Lógica de CCO e Relatórios
│   ├── enviar_voucher.js    # Script isolado para página de Voucher
│   └── jspdf.umd.min.js     # Biblioteca de processamento de PDFs
└── styles/
    ├── whatsapp.css         # Design responsivo e estados (aberto/fechado)
    └── options.css          # Estilização do Painel Administrativo


  Bruno Ferreira - Especialista em Automação de Processos e Desenvolvimento Web.

Este software é de uso exclusivo interno. Todos os direitos reservados à equipe de desenvolvimento e ICD.
