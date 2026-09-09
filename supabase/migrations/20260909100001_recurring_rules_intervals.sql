-- Ismétlődő tételek (4. fázis) — a recurring_rules tábla kiegészítése:
--   * tetszőleges intervallum (frequency + interval_count): havi, kéthavi,
--     negyedéves, féléves, éves, heti, kétheti, napi...
--   * saját név, opcionális végdátum, utolsó rögzítés dátuma
--   * a generált tranzakciók visszakövethetők a szabályra (source_rule_id)
--
-- A generálás továbbra sem cron: az app indulásakor ellenőrzi a lejárt
-- next_run értékeket és felajánlja a rögzítést (spec 3.5).

-- ===================================================================
-- recurring_rules bővítés
-- ===================================================================

-- A napi ismétlődés is engedett legyen a heti/havi/éves mellett. A régi CHECK-et
-- a definíciója alapján keressük meg, nem a (generált, ezért nem garantált nevű)
-- constraint-néven.
do $$
declare
  old_constraint text;
begin
  for old_constraint in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'recurring_rules'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) like '%frequency%'
  loop
    execute format('alter table public.recurring_rules drop constraint %I', old_constraint);
  end loop;
end
$$;

alter table public.recurring_rules
  add constraint recurring_rules_frequency_check
  check (frequency in ('daily','weekly','monthly','yearly'));

alter table public.recurring_rules
  add column if not exists interval_count int not null default 1,
  add column if not exists name text,
  add column if not exists end_date date,
  add column if not exists last_run date;

alter table public.recurring_rules
  drop constraint if exists recurring_rules_interval_count_range;

alter table public.recurring_rules
  add constraint recurring_rules_interval_count_range
  check (interval_count between 1 and 99);

comment on column public.recurring_rules.interval_count is
  'Hány periódusonként ismétlődik: 1 = minden hónapban, 3 = negyedévente, stb.';
comment on column public.recurring_rules.day_of_period is
  'monthly/yearly: a hónap napja (31 = a hónap utolsó napja a rövidebb hónapokban is). '
  'weekly: ISO hét napja (1 = hétfő). daily esetén nincs jelentése.';
comment on column public.recurring_rules.next_run is
  'A következő esedékes előfordulás dátuma. Rögzítés vagy kihagyás után lép tovább, '
  'ezért az end_date-tel nem hasonlítható össze CHECK-ben — a lejáratot az app kezeli.';

-- ===================================================================
-- transactions.source_rule_id — melyik szabályból született a tétel
-- ===================================================================

alter table public.transactions
  add column if not exists source_rule_id uuid
    references public.recurring_rules(id) on delete set null;

create index if not exists transactions_source_rule_idx
  on public.transactions (source_rule_id, occurred_at)
  where source_rule_id is not null;

comment on column public.transactions.source_rule_id is
  'Az ismétlődő szabály, amelyből a tétel készült. Kézzel rögzített tételnél null.';

-- A meglévő ellenőrző trigger kiegészítése: a hivatkozott szabály is a
-- tranzakciót rögzítő felhasználóé legyen.
create or replace function public.enforce_transaction_category()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  category_row public.categories%rowtype;
begin
  if new.category_id is not null then
    select * into category_row from public.categories where id = new.category_id;

    if not found then
      raise exception 'A megadott kategória nem létezik.';
    end if;

    if category_row.user_id <> new.user_id then
      raise exception 'A kategória másik felhasználóhoz tartozik.';
    end if;

    if category_row.kind <> new.direction then
      raise exception 'A kategória típusa (kiadás/bevétel) nem egyezik a tranzakció irányával.';
    end if;
  end if;

  if not exists (
    select 1 from public.accounts where id = new.account_id and user_id = new.user_id
  ) then
    raise exception 'A számla másik felhasználóhoz tartozik vagy nem létezik.';
  end if;

  if new.to_account_id is not null and not exists (
    select 1 from public.accounts where id = new.to_account_id and user_id = new.user_id
  ) then
    raise exception 'A cél számla másik felhasználóhoz tartozik vagy nem létezik.';
  end if;

  if new.source_rule_id is not null and not exists (
    select 1 from public.recurring_rules where id = new.source_rule_id and user_id = new.user_id
  ) then
    raise exception 'Az ismétlődő szabály másik felhasználóhoz tartozik vagy nem létezik.';
  end if;

  return new;
end;
$$;

-- ===================================================================
-- v_transactions_flat — additív bővítés (a meglévő oszlopok sorrendje és
-- típusa változatlan, a BI riportok nem törnek el)
-- ===================================================================
create or replace view public.v_transactions_flat
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
  t.created_at,
  t.source_rule_id as recurring_rule_id,
  rr.name as recurring_name
from public.transactions t
join public.accounts a on a.id = t.account_id
left join public.accounts ta on ta.id = t.to_account_id
left join public.categories c on c.id = t.category_id
left join public.categories pc on pc.id = c.parent_id
left join public.recurring_rules rr on rr.id = t.source_rule_id;
