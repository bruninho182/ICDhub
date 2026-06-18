# 🚀 ICD Hub - Integrador Universal v3.0

O **ICD Hub** é uma extensão de alta performance para Google Chrome, desenvolvida exclusivamente para otimizar o ecossistema de operações da **Ingresso com Desconto**. A ferramenta atua como o "cérebro" da operação, integrando plataformas de turismo, comunicação via WhatsApp e gestão de e-mails em um único fluxo automatizado.

---

## 📸 Demonstração
<img src="./screenshots/banner.png" alt="Banner do Projeto" width="100%">
*Central de Automação e Produtividade para Operadores de Turismo.*

---

## ✨ Funcionalidades de Elite

### 🧮 1. Calculadora de Cotação (WhatsApp)
Uma das ferramentas mais poderosas da versão 2.6. Permite que o operador realize orçamentos complexos sem sair da conversa com o cliente.
* **Cálculo em Tempo Real:** Selecione o passeio e ajuste as quantidades; o total é atualizado instantaneamente.
* **Formatador de Orçamento:** Gera automaticamente um texto formatado com negritos e marcadores pronto para ser colado no WhatsApp.
* **Interface Adaptável:** No modo "Topo", a calculadora e a busca se organizam horizontalmente para não obstruir a visão.

### 🟢 2. WhatsApp Sidebar Hub (Smart UI)
Barra lateral injetada no WhatsApp Web com controle total de layout.
* **Atalhos Rápidos:** Disparo de textos padronizados (PIX, Cartão, Reagendamento).
* **Sistema Drag & Drop (Base64):** Arraste imagens de vouchers e informativos diretamente para o chat. Funcionalidade aprimorada para maior estabilidade.
* **Layout Dinâmico:** Posicionamento em **Esquerda**, **Direita** ou **Topo** com ajuste automático de grade (Grid) para os botões.
* **Interface Otimizada:** Correções de estilo e posicionamento para melhor adaptação em diferentes resoluções de tela.

### 📧 3. Automação de E-mail (Locaweb)
Integração profunda com o Webmail Locaweb.
* **Preenchimento Inteligente:** Dados capturados das plataformas de reserva preenchem destinatário, assunto e corpo.
* **Preservação de Assinatura:** O script detecta a assinatura oficial do operador e a mantém no final do corpo do e-mail, injetando o texto no topo.
* **Disparo em Massa (CCO):** Preenchimento automático de múltiplos e-mails em Cópia Oculta a partir do relatório de visitas.

### 🌉 4. Bridge & Automação de Dados
Ponte de dados entre sistemas internacionais e o sistema ICD.
* **Auto-fill Multiplataforma:** Extração de dados do **TourCMS (Grayline)** , **Headout** e **GetYourGuide**.
* **Smart Rename:** Renomeia automaticamente o título da aba do navegador com o `Código da Venda - Nome do Cliente`, facilitando a organização e o salvamento de PDFs.
* **Sincronização de Operador:** O nome do operador configurado é replicado em todos os registros de venda e logs.

### 🎟️ 5. Gestão e Envio de Vouchers
Sistema dedicado para agilizar a criação, renomeação e envio de vouchers.
* **Geração Rápida:** Módulo isolado (`funpass_result.html`) para gerar vouchers de forma eficiente a partir dos dados da reserva.
* **Renomeação Inteligente de Arquivos:** O nome do voucher gerado é padronizado automaticamente com o padrão `Código da Venda - Nome do Cliente`, facilitando a localização e o arquivamento.
* **Pronto para Envio:** O voucher é formatado e preparado para ser anexado ou compartilhado diretamente no WhatsApp ou E-mail.

### ⚙️ 6. Painel de Gestão (CRUD)
Área administrativa completa dentro das opções da extensão.
* **Gestão de Tarifários:** Adicione, exclua e **edite** passeios e categorias de preços (Adulto, Criança, etc.).
* **Configurador de Atalhos:** Personalize as mensagens e links de fotos que aparecem na barra do WhatsApp.

---

## 🛠️ Tecnologias Utilizadas
* **Engine:** JavaScript (ES6+) e Chrome Extension API (v3).
* **Storage:** `chrome.storage.local` para persistência de tarifários e preferências.
* **UI/UX:** CSS Grid e Flexbox dinâmico para interfaces responsivas sobre o WhatsApp Web.
* **Graphics:** HTML5 Canvas para processamento de imagens em tempo real.

---

## 📁 Estrutura Completa do Projeto

```text
ICD-Hub/
├── manifest.json              # Manifesto V3 (Permissões e Rotas)
├── options.html               # Painel de Controle e Gestão de Tarifários
├── popup.html                 # Popup da extensão
├── funpass_result.html        # Página dedicada para resultado e gestão de vouchers
├── background.js              # Service Worker (Background) para gerenciar eventos da extensão
├── popup.js                   # Lógica do popup da extensão
├── icon.png                   # Ícone principal da extensão
├── iconnn.png                 # Ícone alternativo
├── screenshots/
│   └── banner.png             # Banner de demonstração do projeto
├── scripts/
│   ├── whatsapp_tool.js       # Sidebar, Calculadora e Lógica de Chat
│   ├── ingresso_master.js     # Automação de preenchimento e "Bridge"
│   ├── mail_tool.js           # Integração e Concatenação de Assinatura
│   ├── relatorio_tool.js      # Lógica de CCO e Relatórios
│   ├── enviar_voucher.js      # Script isolado para página de Voucher
│   ├── contador.js            # Script de contador/controle de tempo
│   ├── dom_utils.js           # Utilitários para manipulação do DOM
│   ├── format_utils.js        # Utilitários de formatação de dados
│   ├── storage_utils.js       # Utilitários para gerenciamento de storage
│   └── whatsapp_api.js        # API de integração com WhatsApp
└── styles/
    ├── whatsapp.css           # Design responsivo e estados (aberto/fechado)
    └── options.css            # Estilização do Painel Administrativo

Bruno Ferreira - Especialista em Automação de Processos e Desenvolvimento Web.

Este software é de uso exclusivo interno. Todos os direitos reservados ao Dev.
