-- BI nézetek és a bi_reader read-only szerepkör (3. fázis — lásd spec 3.6 és 7.1)
--
-- A nézetek kiszolgálják a /reports képernyőt ÉS a külső BI eszközöket (Power BI,
-- Looker Studio, Metabase) egyszerre. `security_invoker = true`: az alkalmazásból
-- (PostgREST-en, authenticated userrel) hívva rajtuk is érvényesül az RLS, tehát
-- mindenki csak a saját adatát látja. A bi_reader szerepkör viszont BYPASSRLS-t
-- kap, mert direkt Postgres-kapcsolatnál nincs JWT/auth.uid() kontextus — enélkül
-- egyetlen sort sem látna.

-- ===================================================================
-- v_transactions_flat — a BI fő nézete, egy sor = egy tranzakció
-- ===================================================================
create view public.v_transactions_flat
  with (security_invoker = true) as
select
  t.id,
  t.occurred_at,
  extract(year from t.occurred_at)::int as year,
  extract(month from t.occurred_at)::int as month,
  t.direction,
  t.amount,
  case
    when t.direction = 'expense' then -t.amount
    when t.direction = 'income' then t.amount
    else 0
  end as signed_amount,
  a.name as account_name,
  a.type as account_type,
  ta.name as to_account_name,
  c.name as category_name,
  pc.name as parent_category_name,
  case
    when c.id is null then null
    when pc.id is null then c.name
    else pc.name || ' › ' || c.name
  end as category_path,
  t.payee,
  t.note,
  t.created_at
from public.transactions t
join public.accounts a on a.id = t.account_id
left join public.accounts ta on ta.id = t.to_account_id
left join public.categories c on c.id = t.category_id
left join public.categories pc on pc.id = c.parent_id;

-- ===================================================================
-- v_account_balances — számlánkénti nyitó/be/ki/átvezetés/aktuális egyenleg
-- ===================================================================
create view public.v_account_balances
  with (security_invoker = true) as
select
  a.id as account_id,
  a.name as account_name,
  a.type as account_type,
  a.currency,
  a.is_archived,
  a.opening_balance,
  coalesce(sum(case when t.direction = 'income' and t.account_id = a.id then t.amount end), 0) as income_total,
  coalesce(sum(case when t.direction = 'expense' and t.account_id = a.id then t.amount end), 0) as expense_total,
  coalesce(sum(case when t.direction = 'transfer' and t.account_id = a.id then t.amount end), 0) as transfer_out_total,
  coalesce(sum(case when t.direction = 'transfer' and t.to_account_id = a.id then t.amount end), 0) as transfer_in_total,
  a.opening_balance
    + coalesce(sum(case when t.direction = 'income' and t.account_id = a.id then t.amount end), 0)
    - coalesce(sum(case when t.direction = 'expense' and t.account_id = a.id then t.amount end), 0)
    - coalesce(sum(case when t.direction = 'transfer' and t.account_id = a.id then t.amount end), 0)
    + coalesce(sum(case when t.direction = 'transfer' and t.to_account_id = a.id then t.amount end), 0)
    as current_balance
from public.accounts a
left join public.transactions t
  on t.account_id = a.id or t.to_account_id = a.id
group by a.id, a.name, a.type, a.currency, a.is_archived, a.opening_balance;

-- ===================================================================
-- v_monthly_category_totals — hónap × kategória × alkategória összegek
-- ===================================================================
create view public.v_monthly_category_totals
  with (security_invoker = true) as
select
  extract(year from t.occurred_at)::int as year,
  extract(month from t.occurred_at)::int as month,
  t.direction,
  coalesce(pc.id, c.id) as category_id,
  coalesce(pc.name, c.name) as category_name,
  case when pc.id is not null then c.id end as subcategory_id,
  case when pc.id is not null then c.name end as subcategory_name,
  sum(t.amount) as total_amount,
  count(*) as transaction_count
from public.transactions t
join public.categories c on c.id = t.category_id
left join public.categories pc on pc.id = c.parent_id
where t.direction in ('expense', 'income')
group by
  year, month, t.direction,
  coalesce(pc.id, c.id), coalesce(pc.name, c.name),
  case when pc.id is not null then c.id end,
  case when pc.id is not null then c.name end;

-- ===================================================================
-- v_budget_status — aktuális hónap keret / elköltött / maradék / kihasználtság %
-- ===================================================================
create view public.v_budget_status
  with (security_invoker = true) as
with current_month as (
  select
    date_trunc('month', current_date)::date as month_start,
    (date_trunc('month', current_date) + interval '1 month - 1 day')::date as month_end
),
spent as (
  select t.category_id, sum(t.amount) as spent_amount
  from public.transactions t, current_month cm
  where t.direction = 'expense'
    and t.occurred_at between cm.month_start and cm.month_end
  group by t.category_id
)
select
  b.id as budget_id,
  c.id as category_id,
  c.name as category_name,
  cm.month_start,
  b.amount as budget_amount,
  coalesce(s.spent_amount, 0) as spent_amount,
  b.amount - coalesce(s.spent_amount, 0) as remaining_amount,
  case
    when b.amount > 0 then round((coalesce(s.spent_amount, 0) / b.amount) * 100, 1)
    else null
  end as utilization_pct
from public.budgets b
join public.categories c on c.id = b.category_id
cross join current_month cm
left join spent s on s.category_id = b.category_id
where b.valid_from <= cm.month_end
  and (b.valid_to is null or b.valid_to >= cm.month_start);

-- ===================================================================
-- bi_reader — read-only Postgres szerepkör külső BI eszközöknek
-- ===================================================================
-- Jelszót nem tartalmaz a migráció (nincs titok verziózva). Első használat
-- előtt állítsd be az SQL Editorban:
--   alter role bi_reader with password 'ide-egy-erős-jelszó';
-- Lásd docs/bi-access.md a teljes beüzemeléshez és a rotáláshoz.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'bi_reader') then
    create role bi_reader login bypassrls;
  end if;
end
$$;

comment on role bi_reader is
  'Read-only BI/reporting szerepkör külső eszközöknek (Power BI, Looker Studio, Metabase). '
  'BYPASSRLS, mert direkt Postgres-kapcsolatnál nincs auth.uid() kontextus. Csak SELECT joga van. '
  'Jelszó beállítás/rotálás: lásd docs/bi-access.md.';

grant usage on schema public to bi_reader;

grant select on
  public.v_transactions_flat,
  public.v_account_balances,
  public.v_monthly_category_totals,
  public.v_budget_status
to bi_reader;

grant select on
  public.accounts,
  public.categories,
  public.transactions,
  public.budgets,
  public.recurring_rules
to bi_reader;

alter default privileges in schema public grant select on tables to bi_reader;
