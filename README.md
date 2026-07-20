<div align="center">

<img src="./screenshots/banner.png" alt="ICD Hub Banner" width="100%">

# 🚀 ICD Hub

### Universal Integrator for Google Chrome

Automação Inteligente para Operações da **Ingresso com Desconto**

<br>

<p>

<img src="https://img.shields.io/badge/Version-3.1-2563EB?style=for-the-badge">

<img src="https://img.shields.io/badge/Chrome-Extension-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white">

<img src="https://img.shields.io/badge/Manifest-V3-16A34A?style=for-the-badge">

<img src="https://img.shields.io/badge/JavaScript-ES6+-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black">

<img src="https://img.shields.io/badge/Supabase-Integrated-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white">

<img src="https://img.shields.io/badge/Status-Active-success?style=for-the-badge">

</p>

<p>

Automatize processos • Ganhe produtividade • Centralize ferramentas • Reduza tarefas repetitivas

</p>

</div>

---

# 📚 Índice

- [✨ Sobre o Projeto](#-sobre-o-projeto)
- [🎥 Demonstração](#-demonstração)
- [⭐ Principais Recursos](#-principais-recursos)
- [🏗 Arquitetura](#-arquitetura)
- [⚙ Funcionalidades](#-funcionalidades)
- [📊 Dashboard](#-dashboard)
- [🛠 Tecnologias](#-tecnologias)
- [🚀 Instalação](#-instalação)
- [📂 Estrutura do Projeto](#-estrutura-do-projeto)
- [📈 Roadmap](#-roadmap)
- [📝 Changelog](#-changelog)
- [👨‍💻 Desenvolvedor](#-desenvolvedor)

---

# ✨ Sobre o Projeto

O **ICD Hub** é uma extensão desenvolvida para o **Google Chrome** com o objetivo de centralizar e automatizar diversos processos internos da **Ingresso com Desconto**.

Ela integra diferentes plataformas utilizadas pela operação em um único ambiente inteligente, reduzindo tarefas repetitivas, minimizando erros operacionais e aumentando significativamente a produtividade da equipe.

## 🎯 Objetivos

- Automatizar tarefas repetitivas
- Padronizar processos internos
- Integrar sistemas diferentes
- Reduzir tempo operacional
- Melhorar a experiência dos operadores
- Centralizar ferramentas em um único ambiente

---

# 🎥 Demonstração

<p align="center">

<img src="./screenshots/app1.gif" width="48%">

<img src="./screenshots/app2.gif" width="48%">

</p>

> 💡 **Dica:** Grave GIFs específicos para cada módulo (WhatsApp, Dashboard, Bridge e Vouchers). Isso deixa o projeto muito mais profissional.

---

# ⭐ Principais Recursos

| Módulo | Descrição |
|---------|-----------|
| 💬 WhatsApp Hub | Sidebar inteligente integrada ao WhatsApp Web |
| 🧮 Calculadora | Cotação automática em tempo real |
| 📧 Email Automation | Preenchimento inteligente do Webmail |
| 🌉 Bridge | Integração entre plataformas de turismo |
| 🎟 Voucher Manager | Geração e envio automatizado |
| 📊 Dashboard | Monitoramento da equipe em tempo real |
| ⚙ Painel Administrativo | Configuração completa da extensão |

---

# 🏗 Arquitetura

```text
                     Google Chrome
                           │
                 Chrome Extension (MV3)
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        │                  │                  │
 Background.js      Popup / Options      Content Scripts
        │                                   │
        │                                   │
        │          ┌────────────────────────┼─────────────────────┐
        │          │                        │                     │
        ▼          ▼                        ▼                     ▼

 WhatsApp Web   Webmail Locaweb     Plataformas      Dashboard Admin
                                      Turismo

        │
        ▼

     Supabase API

        │
        ▼

 Banco de Dados + Métricas + Dashboard
```

---

# 📊 O que o ICD Hub automatiza?

✅ Atendimento via WhatsApp

✅ Envio de e-mails

✅ Criação de vouchers

✅ Geração de relatórios

✅ Cálculo de orçamentos

✅ Integração entre plataformas

✅ Monitoramento da equipe

✅ Dashboard em tempo real

---

# 🚀 Destaques da versão 3.1

| Novidade | Status |
|-----------|--------|
| Dashboard em Tempo Real | ✅ |
| Integração Supabase | ✅ |
| Multi Navegador | ✅ |
| Sistema de Alertas | ✅ |
| Gestão de Operadores | ✅ |
| Exportação CSV | ✅ |
| Melhor desempenho | ✅ |
| Nova interface | ✅ |

---

# ⚙ Funcionalidades

---

# 💬 WhatsApp Smart Hub

<p align="center">
<img src="./screenshots/whatsapp.gif" width="90%">
</p>

Transforme o **WhatsApp Web** em uma poderosa central de atendimento integrada às ferramentas da empresa.

## ✨ Recursos

- ✅ Sidebar inteligente
- ✅ Atalhos personalizados
- ✅ Mensagens prontas
- ✅ Links rápidos
- ✅ Sistema Drag & Drop
- ✅ Upload automático de imagens
- ✅ Interface reposicionável
- ✅ Layout responsivo
- ✅ Organização automática

### Benefícios

✔ Atendimento muito mais rápido

✔ Menos cliques

✔ Padronização das respostas

✔ Maior produtividade

---

# 🧮 Calculadora Inteligente

<p align="center">
<img src="./screenshots/calculator.gif" width="90%">
</p>

Realize orçamentos completos diretamente pela conversa do WhatsApp sem trocar de tela.

## Recursos

- 💲 Cálculo automático
- ⚡ Atualização instantânea
- 📦 Diversas categorias
- 📋 Formatação automática
- 💬 Texto pronto para WhatsApp
- 📊 Total em tempo real

### Benefícios

✔ Agilidade no atendimento

✔ Menos erros

✔ Padronização dos orçamentos

✔ Economia de tempo

---

# 📧 Automação de E-mails

<p align="center">
<img src="./screenshots/email.gif" width="90%">
</p>

Integração completa com o **Webmail Locaweb** para automatizar o envio de e-mails operacionais.

## Recursos

- 📧 Destinatário automático
- 📝 Assunto automático
- 📄 Corpo do e-mail preenchido
- 🖋 Preservação da assinatura
- 👥 Envio em massa (CCO)
- 📎 Integração com relatórios
- 📁 Envio de vouchers

### Benefícios

✔ Elimina preenchimento manual

✔ Evita erros

✔ Mais rapidez

✔ Comunicação padronizada

---

# 🌉 Bridge de Dados

<p align="center">
<img src="./screenshots/bridge.gif" width="90%">
</p>

O Bridge conecta diversas plataformas de turismo permitindo copiar e converter informações automaticamente.

## Plataformas Integradas

| Plataforma | Status |
|------------|--------|
| 🌍 TourCMS | ✅ |
| 🌍 Headout | ✅ |
| 🌍 GetYourGuide | ✅ |
| 🌍 Civitatis | ✅ |
| 🌍 TicketGO | ✅ |
| 🚢 Navios | ✅ |

## Recursos

- Auto Fill
- Conversão automática
- Sincronização de operador
- Smart Rename
- Organização automática de abas
- Copiar e colar inteligente

### Benefícios

✔ Menos retrabalho

✔ Integração entre sistemas

✔ Dados padronizados

✔ Economia de tempo

---

# 🎟 Gestão Inteligente de Vouchers

<p align="center">
<img src="./screenshots/voucher.gif" width="90%">
</p>

Ferramentas desenvolvidas para geração, organização e envio automático de vouchers.

## Recursos

- 📄 Geração automática
- 🏷 Renomeação inteligente
- 📤 Envio para WhatsApp
- 📧 Envio por E-mail
- 📂 Organização automática
- ⚡ Processamento rápido

### Benefícios

✔ Menos trabalho manual

✔ Organização dos arquivos

✔ Redução de erros

✔ Rapidez operacional

---

# ⚙ Painel Administrativo

<p align="center">
<img src="./screenshots/admin.gif" width="90%">
</p>

Central completa de gerenciamento da extensão.

## Permite

- Cadastro de tarifários
- Cadastro de produtos
- Configuração de mensagens
- Configuração de atalhos
- Links personalizados
- Preferências da extensão
- Atualizações em tempo real

---

# 📊 Dashboard de Desempenho

<p align="center">
<img src="./screenshots/dashboard.png" width="100%">
</p>

> **Novidade da versão 3.1**

O Dashboard fornece uma visão completa da operação em tempo real utilizando integração com **Supabase**.

## Principais Recursos

| Funcionalidade | Descrição |
|----------------|-----------|
| 👥 Operadores Online | Visualização em tempo real |
| 💬 WhatsApp | Quantidade de atendimentos |
| 📧 E-mails | Total enviado |
| 🎟 Vouchers | Total emitido |
| 🔔 Alertas | Funcionários inativos |
| 📊 Gráficos | Estatísticas em tempo real |
| 📅 Filtros | Hoje, Semana, Mês |
| 📥 Exportação | CSV |

---

## Alertas Inteligentes

🟡 Atenção

Operador parado há mais de **30 minutos**

🔴 Crítico

Operador parado há mais de **60 minutos**

---

## Estatísticas Disponíveis

- Operadores ativos
- Tempo médio de atendimento
- Quantidade de mensagens
- Quantidade de e-mails
- Vouchers emitidos
- Histórico diário
- Histórico semanal
- Histórico mensal

---

## Segurança

- Login protegido
- Sessão persistente
- Integração Supabase
- Identificação por operador
- Compatível com Chrome, Edge e Brave

---

# 📈 Benefícios Gerais

| Benefício | Resultado |
|-----------|-----------|
| 🚀 Automação | Redução de tarefas repetitivas |
| ⚡ Agilidade | Atendimento mais rápido |
| 📊 Gestão | Monitoramento em tempo real |
| 🔒 Segurança | Controle dos operadores |
| 🌐 Integração | Todas as plataformas em um só lugar |
| 📈 Produtividade | Maior rendimento da equipe |

---

# 🛠 Tecnologias

Este projeto foi desenvolvido utilizando tecnologias modernas para garantir desempenho, estabilidade e facilidade de manutenção.

<div align="center">

| Tecnologia | Utilização |
|------------|------------|
| <img src="https://skillicons.dev/icons?i=js" height="20"> JavaScript ES6+ | Lógica da aplicação |
| <img src="https://skillicons.dev/icons?i=html" height="20"> HTML5 | Interface |
| <img src="https://skillicons.dev/icons?i=css" height="20"> CSS3 | Estilização |
| Chrome Extension API | APIs do navegador |
| Manifest V3 | Arquitetura da extensão |
| Canvas API | Processamento de imagens |
| chrome.storage | Persistência local |
| <img src="https://skillicons.dev/icons?i=supabase" height="20"> Supabase | Banco de Dados |
| REST API | Comunicação entre sistemas |

</div>

---

# 🚀 Instalação

## 1️⃣ Clone o projeto

```bash
git clone https://github.com/SEU-USUARIO/ICD-Hub.git
```

---

## 2️⃣ Abra o Chrome

```
chrome://extensions
```

---

## 3️⃣ Ative

✅ Developer Mode (Modo Desenvolvedor)

---

## 4️⃣ Clique

```
Load unpacked
```

---

## 5️⃣ Selecione

```
ICD-Hub/
```

Pronto!

A extensão estará instalada.

---

# 📂 Estrutura do Projeto

```text
📦 ICD Hub
│
├── 📄 manifest.json
├── 📄 background.js
├── 📄 popup.html
├── 📄 popup.js
├── 📄 options.html
├── 📄 options.js
│
├── 📂 dashboard
│   ├── dashboard.html
│   ├── dashboard.js
│   ├── dashboard.css
│   └── components
│
├── 📂 scripts
│   │
│   ├── whatsapp
│   │      whatsapp_tool.js
│   │      mensagens.js
│   │
│   ├── email
│   │      mail_tool.js
│   │
│   ├── voucher
│   │      voucher.js
│   │      rename.js
│   │
│   ├── bridge
│   │      ingresso_master.js
│   │      plataformas.js
│   │
│   ├── dashboard
│   │      contador.js
│   │      metricas.js
│   │
│   └── utils
│          storage.js
│          format.js
│          dom.js
│
├── 📂 assets
│
├── 📂 screenshots
│
├── 📂 styles
│
└── README.md
```

---

# 🏛 Arquitetura do Projeto

```text
                Google Chrome

                     │

          Chrome Extension (Manifest V3)

                     │

      ┌──────────────┼──────────────┐

      │              │              │

 Background      Popup UI      Content Scripts

      │              │              │

      └──────────────┼──────────────┘

                     │

          Camada de Automação

                     │

    ┌────────┬────────┬────────┬─────────┐

 WhatsApp  Webmail  Bridge  Dashboard

                     │

               REST API

                     │

               Supabase Cloud
```

---

# 📈 Estatísticas do Projeto

<div align="center">

| 📊 Informação | Quantidade |
|--------------|-----------|
| Módulos | 15+ |
| Plataformas Integradas | 6 |
| Sistemas Automatizados | 8 |
| Scripts JavaScript | 20+ |
| APIs Utilizadas | 5 |
| Dashboard | Tempo Real |
| Navegadores Compatíveis | Chrome, Edge, Brave |

</div>

---

# 🌍 Plataformas Compatíveis

| Plataforma | Compatível |
|------------|-----------|
| Google Chrome | ✅ |
| Microsoft Edge | ✅ |
| Brave | ✅ |
| Opera | ✅ |

---

# ⚡ Performance

## Melhorias da versão 3.1

✅ Cache otimizado

✅ Processamento assíncrono

✅ Menor consumo de memória

✅ Carregamento mais rápido

✅ Dashboard otimizado

✅ Consultas Supabase melhoradas

---

# 📊 Roadmap

## ✅ Concluído

- [x] WhatsApp Hub
- [x] Automação de Emails
- [x] Dashboard
- [x] Integração Supabase
- [x] Multi Navegador
- [x] Sistema de Alertas
- [x] Gestão de Operadores
- [x] Exportação CSV

---

# 🔒 Segurança

✔ Login protegido

✔ Sessão persistente

✔ Dados criptografados

✔ Controle de operadores

✔ Permissões por usuário

✔ Integração segura com Supabase

✔ Manifest V3

---

# 🤝 Contribuição

Este projeto é destinado ao uso interno da **Ingresso com Desconto**.

Caso participe do desenvolvimento:

1. Faça um Fork

2. Crie uma Branch

3. Faça seus commits

4. Abra um Pull Request

---

# 💬 Suporte

Encontrou algum problema?

Abra uma Issue ou entre em contato com o desenvolvedor.

---

# 📝 Changelog

## 🚀 Versão 3.1 (Atual)

### ✨ Novidades

- 📊 Dashboard de Desempenho em tempo real
- 🆔 Sistema Multi-Navegador
- 🔔 Alertas inteligentes de inatividade
- 👥 Gestão de operadores
- 📈 Gráficos interativos
- 📥 Exportação de relatórios em CSV
- 🔐 Novo sistema de autenticação
- ⚡ Melhorias de desempenho
- 🌉 Bridge otimizada
- 📧 Nova automação de e-mails
- 🎟 Melhor gerenciamento de vouchers

---

## 🚀 Versão 3.0

- Novo WhatsApp Hub
- Calculadora Inteligente
- Novo sistema de atalhos
- Interface totalmente reformulada

---

## 🚀 Versão 2.0

- Automação de E-mails
- Integração com Webmail Locaweb
- Organização automática de vouchers

---

## 🚀 Versão 1.0

Primeira versão da extensão.

---

# 📈 Estatísticas

<div align="center">

| 📊 Métrica | Valor |
|------------|-------|
| 🚀 Versão | **3.1** |
| 🧩 Módulos | **15+** |
| 📄 Scripts | **20+** |
| 🌍 Plataformas Integradas | **6** |
| ⚡ Automações | **50+** |
| 📊 Dashboard | **Tempo Real** |
| 🔒 Segurança | **Manifest V3** |

</div>

---

# 🏆 Destaques

<div align="center">

| 🚀 | Recurso |
|---|----------|
| 💬 | WhatsApp Smart Hub |
| 📧 | Automação de E-mails |
| 🌉 | Bridge entre Plataformas |
| 🎟 | Gestão Inteligente de Vouchers |
| 📊 | Dashboard em Tempo Real |
| 👥 | Gestão de Operadores |
| 🔔 | Alertas Inteligentes |
| 🧮 | Calculadora Integrada |

</div>

---

# 🎯 Objetivos do Projeto

O ICD Hub foi desenvolvido para:

- 🚀 Automatizar processos internos
- ⚡ Aumentar a produtividade
- 📊 Facilitar o acompanhamento da equipe
- 🧩 Integrar diferentes plataformas
- 📧 Reduzir tarefas repetitivas
- 🎟 Padronizar o envio de vouchers
- 💬 Melhorar o atendimento ao cliente

---

# 📌 Próximas Atualizações

- 🤖 Inteligência Artificial para respostas
- 📄 Exportação em PDF
- 📱 Dashboard Mobile
- ☁ Backup automático
- 🔔 Notificações Push
- 📈 Mais indicadores de desempenho
- 🌎 Novas integrações

---

# 👨‍💻 Desenvolvedor

<div align="center">

## Bruno Ferreira

**Frontend Developer • JavaScript Developer • Chrome Extension Developer • Automação de Processos**

<br>

<a href="https://github.com/bruninho182">
<img src="https://img.shields.io/badge/GitHub-bruninho182-181717?style=for-the-badge&logo=github">
</a>

<a href="https://www.linkedin.com/in/bruno-ferreira-6361b016b/">
<img src="https://img.shields.io/badge/LinkedIn-Bruno%20Ferreira-0077B5?style=for-the-badge&logo=linkedin">
</a>

</div>

---

# ❤️ Agradecimentos

Este projeto evoluiu através da experiência diária da equipe operacional da **Ingresso com Desconto**.

Cada funcionalidade foi criada para resolver problemas reais e tornar o atendimento mais rápido, eficiente e organizado.

Obrigado a todos que contribuíram com ideias, testes e sugestões.

Obrigado DEUS!

---

# ⭐ Gostou do projeto?

Se este projeto foi útil ou serviu como inspiração, considere deixar uma ⭐ no repositório.

Isso ajuda a divulgar o trabalho e incentiva novas melhorias.

---

# 📄 Licença

Este projeto é de uso interno da **Ingresso com Desconto**.

Sua redistribuição ou utilização sem autorização não é permitida.

---

<div align="center">

# 🚀 ICD Hub

### Universal Integrator for Google Chrome

<img src="https://img.shields.io/badge/Version-3.1-blue?style=for-the-badge">

<img src="https://img.shields.io/badge/Made%20with-JavaScript-yellow?style=for-the-badge&logo=javascript">

<img src="https://img.shields.io/badge/Chrome-Extension-success?style=for-the-badge">

<img src="https://img.shields.io/badge/Powered%20by-Supabase-3ECF8E?style=for-the-badge&logo=supabase">

<br>

**Desenvolvido por Bruno Ferreira**

### © 2026 • Todos os direitos reservados

</div>
