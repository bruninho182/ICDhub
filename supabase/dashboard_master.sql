begin;

create table if not exists public.icd_dashboard_masters (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.icd_dashboard_masters enable row level security;
revoke all on public.icd_dashboard_masters from public, anon, authenticated;

alter table public.metricas add column if not exists icd_recebido_em timestamptz;
alter table public.metricas alter column icd_recebido_em set default statement_timestamp();

create or replace function public.icd_dashboard_metricas(p_inicio date, p_fim_exclusivo date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  resultado jsonb;
begin
  if not exists (
    select 1 from public.icd_dashboard_masters where user_id = auth.uid()
  ) then
    raise insufficient_privilege using message = 'Acesso master necessário';
  end if;

  if p_inicio is null or p_fim_exclusivo is null
    or p_fim_exclusivo - p_inicio not between 1 and 366 then
    raise exception 'Intervalo inválido' using errcode = '22023';
  end if;

  select coalesce(jsonb_agg(to_jsonb(resumo) order by resumo.timestamp desc), '[]'::jsonb)
  into resultado
  from (
    select
      m.operador,
      m.operador_id,
      (m.timestamp::timestamptz at time zone 'America/Sao_Paulo')::date as dia,
      max(m.timestamp::timestamptz) as timestamp,
      max(m.icd_recebido_em) as recebido_em,
      count(distinct nullif(m.detalhes->>'evento_id', '')) filter (where m.tipo = 'whatsapp')
        + count(*) filter (where m.tipo = 'whatsapp' and nullif(m.detalhes->>'evento_id', '') is null) as whatsapp,
      count(distinct nullif(m.detalhes->>'evento_id', '')) filter (where m.tipo = 'email')
        + count(*) filter (where m.tipo = 'email' and nullif(m.detalhes->>'evento_id', '') is null) as email,
      count(distinct nullif(m.detalhes->>'evento_id', '')) filter (where m.tipo = 'voucher')
        + count(*) filter (where m.tipo = 'voucher' and nullif(m.detalhes->>'evento_id', '') is null) as voucher
    from public.metricas m
    where m.timestamp::timestamptz >= (p_inicio::timestamp at time zone 'America/Sao_Paulo')
      and m.timestamp::timestamptz < (p_fim_exclusivo::timestamp at time zone 'America/Sao_Paulo')
      and m.tipo in ('whatsapp', 'email', 'voucher')
    group by m.operador, m.operador_id, (m.timestamp::timestamptz at time zone 'America/Sao_Paulo')::date
  ) resumo;

  return resultado;
end;
$$;

revoke all on function public.icd_dashboard_metricas(date, date) from public, anon, authenticated;
grant execute on function public.icd_dashboard_metricas(date, date) to authenticated;

-- A coleta existente continua usando suas permissões de INSERT.
revoke select on public.metricas from public, anon, authenticated;
notify pgrst, 'reload schema';

commit;
