# 🚀 ICD Hub - Integrador Universal v2.5

O **ICD Hub** é uma extensão de alta performance para Google Chrome, desenvolvida exclusivamente para otimizar o ecossistema de operações da **Ingresso com Desconto**. A ferramenta atua como o "cérebro" da operação, integrando plataformas de turismo, comunicação via WhatsApp e gestão de e-mails em um único fluxo automatizado.

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

### 🌉 4. Bridge & Automação de Dados
Ponte de dados entre sistemas internacionais e o sistema ICD.
* **Auto-fill Multiplataforma:** Extração de dados do **TourCMS (Grayline)**, **Headout** e **GetYourGuide**.
* **Smart Rename:** Renomeia automaticamente o título da aba do navegador com o `Código da Venda - Nome do Cliente`, facilitando a organização e o salvamento de PDFs.
* **Sincronização de Operador:** O nome do operador configurado é replicado em todos os registros de venda e logs.

### ⚙️ 5. Painel de Gestão (CRUD)
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

## 📁 Estrutura do Projeto
```text
ICD-Hub/
├── manifest.json         # Manifesto V3 (Permissões e Rotas)
├── options.html          # Painel de Controle e Gestão de Tarifários
├── scripts/
│   ├── whatsapp_tool.js  # Sidebar, Calculadora e Lógica de Chat
│   ├── ingresso_master.js# Automação de preenchimento e "Bridge"
│   ├── mail_tool.js      # Integração e Concatenação de Assinatura
│   ├── relatorio_tool.js # Lógica de CCO e Relatórios
│   └── enviar_voucher.js # Script isolado para página de Voucher
└── styles/
    ├── whatsapp.css      # Design responsivo e estados (aberto/fechado)
    └── options.css       # Estilização do Painel Administrativo


    Bruno Ferreira Especialista em Automação de Processos e Desenvolvimento Web.

Este software é de uso exclusivo interno. Todos os direitos reservados à equipe de desenvolvimento e ICD.