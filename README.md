# ICD Hub

Extensão para Google Chrome que reúne ferramentas de atendimento e operação da **Ingresso com Desconto**. Criada por Bruno Ferreira a partir da experiência na equipe de atendimento, para simplificar tarefas recorrentes e reduzir erros no dia a dia.

## Recursos

- **WhatsApp:** atalhos por pasta, busca unificada e mensagens em português, espanhol e inglês.
- **Reservas e cotações:** integração com plataformas, calculadora e importação de tarifas e disponibilidade.
- **Operação:** conferência de vouchers, apoio a remarcações e coleta de dados para estornos.
- **E-mail:** revisão de mensagens e organização de destinatários em lotes de até 100.
- **Personalização:** chaves de funcionalidades, backup seletivo e diagnóstico da extensão.

Os envios de e-mail e as confirmações operacionais permanecem sob controle do operador. As integrações dependem de acesso aos sistemas utilizados pela equipe.

## Desenvolvimento e instalação

Requer Node.js com npm e Google Chrome.

```bash
git clone https://github.com/bruninho182/ICDhub.git
cd ICDhub
npm ci
npm run build
```

Em `chrome://extensions`, ative o **Modo do desenvolvedor**, clique em **Carregar sem compactação** e selecione a pasta do projeto. Abra as configurações da extensão para cadastrar os atalhos e ajustar as funcionalidades.

```bash
npm run typecheck
npm test
```

**Tecnologias:** Chrome Manifest V3, TypeScript, JavaScript, HTML e CSS. Os arquivos TypeScript estão em `src/`; o build gera os scripts utilizados pela extensão em `scripts/generated/`.

Consulte o [histórico de modernização](docs/MODERNIZACAO.md) para detalhes técnicos e limitações das integrações. Tokens e credenciais devem ser configurados localmente, sem inclusão no repositório.

Desenvolvido por [Bruno Ferreira](https://github.com/bruninho182).
