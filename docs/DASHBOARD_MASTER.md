# Dashboard master

1. No Supabase, crie ou confirme a conta individual do master em Authentication → Users.
2. No SQL Editor do mesmo projeto, aplique `supabase/dashboard_master.sql`. A migração restringe a leitura direta de métricas a contas administrativas do banco. Versões antigas do dashboard precisam ser atualizadas.
3. Autorize cada conta master pelo UUID copiado de Authentication → Users.

```sql
insert into public.icd_dashboard_masters (user_id)
values ('UUID_DA_CONTA_MASTER')
on conflict do nothing;
```

Depois de recarregar a extensão, abra o dashboard e entre com o e-mail e a senha dessa conta. A sessão permanece em memória enquanto o painel estiver aberto. Quando o token expirar, entre novamente. Para revogar acesso, exclua a linha correspondente da tabela de masters.

A consulta agrega métricas no banco e usa o fuso America/Sao_Paulo. Semana atual começa na segunda-feira. Mês e ano começam no primeiro dia do período. No filtro personalizado, ambas as datas são inclusivas e o intervalo pode ter até 366 dias.

Cada operador precisa ativar Métricas de produtividade na aba Funcionalidades. A atualização conta ações de envio de texto do WhatsApp pelo botão e pela tecla Enter. Eventos já registrados permanecem no histórico. Os alertas de inatividade ficam no painel master aberto, pois a leitura anônima é bloqueada pela migração.

Se o painel master já estiver configurado, execute novamente o SQL para atualizar a função de consulta. A lista de contas master permanece cadastrada. A consulta conta cada identificador de evento uma vez por tipo, operador e dia. Eventos antigos sem identificador são contabilizados individualmente.
