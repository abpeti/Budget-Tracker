-- Költségkövető — teljes séma egyben (supabase/migrations tartalma, sorrendben)
-- Futtasd le egyszerre a Supabase SQL Editorban (Dashboard → SQL Editor → New query).

-- ===================================================================
-- 20260811100001_accounts.sql
-- ===================================================================
-- Accounts (számlák)

create table public.accounts (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  name             text not null,
  type             text not null check (type in ('cash','bank','card','savings','credit','other')),
  currency         char(3) not null default 'HUF',
  opening_balance  numeric(14,2) not null default 0,
  icon             text,
  color            text,
  is_archived      boolean not null default false,
  sort_order       int not null default 0,
  created_at       timestamptz not null default now()
);

create index accounts_user_id_idx on public.accounts (user_id);

-- ===================================================================
-- 20260811100002_categories.sql
-- ===================================================================
-- Categories (kategóriák és alkategóriák) — pontosan két szint

create table public.categories (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  parent_id    uuid references public.categories(id) on delete restrict,
  name         text not null,
  kind         text not null check (kind in ('expense','income')),
  icon         text,
  color        text,
  is_archived  boolean not null default false,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now()
);

create index categories_user_id_idx on public.categories (user_id);
create index categories_parent_id_idx on public.categories (parent_id);

-- Kikényszeríti: pontosan két szint, az alkategória kind-ja egyezzen a szülőével,
-- és a szülő ugyanahhoz a felhasználóhoz tartozzon.
create or replace function public.enforce_category_hierarchy()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  parent_row public.categories%rowtype;
begin
  if new.parent_id is not null then
    select * into parent_row from public.categories where id = new.parent_id;

    if not found then
      raise exception 'A megadott szülőkategória nem létezik.';
    end if;

    if parent_row.user_id <> new.user_id then
      raise exception 'A szülőkategória másik felhasználóhoz tartozik.';
    end if;

    if parent_row.parent_id is not null then
      raise exception 'Csak két szint engedélyezett: alkategóriának nem lehet alkategóriája.';
    end if;

    if parent_row.kind <> new.kind then
      raise exception 'Az alkategória típusának (kiadás/bevétel) meg kell egyeznie a főkategóriáéval.';
    end if;
  end if;

  -- Ha ennek a kategóriának már vannak alkategóriái, nem válhat maga is alkategóriává.
  if new.parent_id is not null and exists (
    select 1 from public.categories where parent_id = new.id
  ) then
    raise exception 'Ennek a kategóriának már vannak alkategóriái, nem tehető alkategóriává.';
  end if;

  return new;
end;
$$;

create trigger categories_hierarchy_check
  before insert or update of parent_id, kind, user_id on public.categories
  for each row execute function public.enforce_category_hierarchy();

-- ===================================================================
-- 20260811100003_transactions.sql
-- ===================================================================
-- Transactions (tranzakciók)

create table public.transactions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  occurred_at   date not null default current_date,
  direction     text not null check (direction in ('expense','income','transfer')),
  amount        numeric(14,2) not null check (amount > 0),
  account_id    uuid not null references public.accounts(id) on delete restrict,
  to_account_id uuid references public.accounts(id) on delete restrict,
  category_id   uuid references public.categories(id) on delete restrict,
  payee         text,
  note          text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint transactions_transfer_shape check (
    (direction = 'transfer' and to_account_id is not null and category_id is null and to_account_id <> account_id)
    or
    (direction in ('expense', 'income') and to_account_id is null)
  )
);

create index transactions_user_occurred_idx on public.transactions (user_id, occurred_at desc);
create index transactions_user_category_idx on public.transactions (user_id, category_id);
create index transactions_user_account_idx on public.transactions (user_id, account_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger transactions_set_updated_at
  before update on public.transactions
  for each row execute function public.set_updated_at();

-- A kategória kind-ja egyezzen a tranzakció irányával, és a hivatkozott
-- kategória / számla(k) ugyanahhoz a felhasználóhoz tartozzanak.
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

  return new;
end;
$$;

create trigger transactions_category_check
  before insert or update on public.transactions
  for each row execute function public.enforce_transaction_category();

-- ===================================================================
-- 20260811100004_budgets.sql
-- ===================================================================
-- Budgets (havi keretek) — csak főkategóriára állítható

create table public.budgets (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  category_id  uuid not null references public.categories(id) on delete cascade,
  amount       numeric(14,2) not null check (amount > 0),
  valid_from   date not null,
  valid_to     date,
  created_at   timestamptz not null default now(),

  constraint budgets_valid_range check (valid_to is null or valid_to >= valid_from)
);

create index budgets_user_id_idx on public.budgets (user_id);
create index budgets_category_id_idx on public.budgets (category_id);

create or replace function public.enforce_budget_category()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  category_row public.categories%rowtype;
begin
  select * into category_row from public.categories where id = new.category_id;

  if not found then
    raise exception 'A megadott kategória nem létezik.';
  end if;

  if category_row.user_id <> new.user_id then
    raise exception 'A kategória másik felhasználóhoz tartozik.';
  end if;

  if category_row.parent_id is not null then
    raise exception 'Keret csak főkategóriára állítható, alkategóriára nem.';
  end if;

  return new;
end;
$$;

create trigger budgets_category_check
  before insert or update on public.budgets
  for each row execute function public.enforce_budget_category();

-- ===================================================================
-- 20260811100005_recurring_rules.sql
-- ===================================================================
-- Recurring rules (ismétlődő tételek) — 4. fázisban kap UI-t, a tábla most jön létre

create table public.recurring_rules (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  template      jsonb not null,
  frequency     text not null check (frequency in ('monthly','weekly','yearly')),
  day_of_period int not null,
  next_run      date not null,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),

  constraint recurring_rules_day_of_period_range check (day_of_period between 1 and 31)
);

create index recurring_rules_user_id_idx on public.recurring_rules (user_id);
create index recurring_rules_next_run_idx on public.recurring_rules (user_id, next_run) where is_active;

-- ===================================================================
-- 20260811100006_rls_policies.sql
-- ===================================================================
-- Row Level Security — minden táblán user_id = auth.uid()

alter table public.accounts enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.budgets enable row level security;
alter table public.recurring_rules enable row level security;

-- accounts
create policy "accounts_select_own" on public.accounts
  for select using (user_id = auth.uid());
create policy "accounts_insert_own" on public.accounts
  for insert with check (user_id = auth.uid());
create policy "accounts_update_own" on public.accounts
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "accounts_delete_own" on public.accounts
  for delete using (user_id = auth.uid());

-- categories
create policy "categories_select_own" on public.categories
  for select using (user_id = auth.uid());
create policy "categories_insert_own" on public.categories
  for insert with check (user_id = auth.uid());
create policy "categories_update_own" on public.categories
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "categories_delete_own" on public.categories
  for delete using (user_id = auth.uid());

-- transactions
create policy "transactions_select_own" on public.transactions
  for select using (user_id = auth.uid());
create policy "transactions_insert_own" on public.transactions
  for insert with check (user_id = auth.uid());
create policy "transactions_update_own" on public.transactions
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "transactions_delete_own" on public.transactions
  for delete using (user_id = auth.uid());

-- budgets
create policy "budgets_select_own" on public.budgets
  for select using (user_id = auth.uid());
create policy "budgets_insert_own" on public.budgets
  for insert with check (user_id = auth.uid());
create policy "budgets_update_own" on public.budgets
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "budgets_delete_own" on public.budgets
  for delete using (user_id = auth.uid());

-- recurring_rules
create policy "recurring_rules_select_own" on public.recurring_rules
  for select using (user_id = auth.uid());
create policy "recurring_rules_insert_own" on public.recurring_rules
  for insert with check (user_id = auth.uid());
create policy "recurring_rules_update_own" on public.recurring_rules
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "recurring_rules_delete_own" on public.recurring_rules
  for delete using (user_id = auth.uid());

-- ===================================================================
-- 20260811100007_seed_categories.sql
-- ===================================================================
-- Alapértelmezett magyar kategória-készlet automatikus létrehozása minden új
-- felhasználóhoz. Mivel a regisztráció le van tiltva és az egyetlen usert a
-- Supabase konzolon hozzuk létre kézzel, ez a trigger biztosítja, hogy első
-- bejelentkezéskor már legyen értelmes kategórialista, kódfuttatás nélkül.

create or replace function public.seed_default_categories(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_elelmiszer     uuid;
  v_lakhatas       uuid;
  v_kozlekedes     uuid;
  v_egeszseg       uuid;
  v_szorakozas     uuid;
  v_ruhazat        uuid;
  v_elofizetesek   uuid;
  v_egyeb_kiadas   uuid;
  v_fizetes        uuid;
  v_egyeb_bevetel  uuid;
begin
  if exists (select 1 from public.categories where user_id = p_user_id) then
    return;
  end if;

  insert into public.categories (user_id, name, kind, sort_order) values (p_user_id, 'Élelmiszer', 'expense', 1) returning id into v_elelmiszer;
  insert into public.categories (user_id, name, kind, sort_order) values (p_user_id, 'Lakhatás', 'expense', 2) returning id into v_lakhatas;
  insert into public.categories (user_id, name, kind, sort_order) values (p_user_id, 'Közlekedés', 'expense', 3) returning id into v_kozlekedes;
  insert into public.categories (user_id, name, kind, sort_order) values (p_user_id, 'Egészség', 'expense', 4) returning id into v_egeszseg;
  insert into public.categories (user_id, name, kind, sort_order) values (p_user_id, 'Szórakozás', 'expense', 5) returning id into v_szorakozas;
  insert into public.categories (user_id, name, kind, sort_order) values (p_user_id, 'Ruházat', 'expense', 6) returning id into v_ruhazat;
  insert into public.categories (user_id, name, kind, sort_order) values (p_user_id, 'Előfizetések', 'expense', 7) returning id into v_elofizetesek;
  insert into public.categories (user_id, name, kind, sort_order) values (p_user_id, 'Egyéb', 'expense', 8) returning id into v_egyeb_kiadas;

  insert into public.categories (user_id, name, kind, sort_order) values (p_user_id, 'Fizetés', 'income', 1) returning id into v_fizetes;
  insert into public.categories (user_id, name, kind, sort_order) values (p_user_id, 'Egyéb bevétel', 'income', 2) returning id into v_egyeb_bevetel;

  insert into public.categories (user_id, parent_id, name, kind, sort_order) values
    (p_user_id, v_elelmiszer, 'Bolt', 'expense', 1),
    (p_user_id, v_elelmiszer, 'Étterem', 'expense', 2),
    (p_user_id, v_elelmiszer, 'Kávé', 'expense', 3);

  insert into public.categories (user_id, parent_id, name, kind, sort_order) values
    (p_user_id, v_lakhatas, 'Rezsi', 'expense', 1),
    (p_user_id, v_lakhatas, 'Lakbér / Törlesztés', 'expense', 2),
    (p_user_id, v_lakhatas, 'Karbantartás', 'expense', 3);

  insert into public.categories (user_id, parent_id, name, kind, sort_order) values
    (p_user_id, v_kozlekedes, 'Tömegközlekedés', 'expense', 1),
    (p_user_id, v_kozlekedes, 'Üzemanyag', 'expense', 2),
    (p_user_id, v_kozlekedes, 'Parkolás', 'expense', 3),
    (p_user_id, v_kozlekedes, 'Szerviz', 'expense', 4);

  insert into public.categories (user_id, parent_id, name, kind, sort_order) values
    (p_user_id, v_egeszseg, 'Gyógyszer', 'expense', 1),
    (p_user_id, v_egeszseg, 'Orvos', 'expense', 2),
    (p_user_id, v_egeszseg, 'Sport', 'expense', 3);

  insert into public.categories (user_id, parent_id, name, kind, sort_order) values
    (p_user_id, v_szorakozas, 'Kikapcsolódás', 'expense', 1),
    (p_user_id, v_szorakozas, 'Utazás', 'expense', 2),
    (p_user_id, v_szorakozas, 'Hobbi', 'expense', 3);

  insert into public.categories (user_id, parent_id, name, kind, sort_order) values
    (p_user_id, v_ruhazat, 'Ruha', 'expense', 1),
    (p_user_id, v_ruhazat, 'Cipő', 'expense', 2);

  insert into public.categories (user_id, parent_id, name, kind, sort_order) values
    (p_user_id, v_elofizetesek, 'Streaming', 'expense', 1),
    (p_user_id, v_elofizetesek, 'Szoftver', 'expense', 2),
    (p_user_id, v_elofizetesek, 'Telefon / Internet', 'expense', 3);

  insert into public.categories (user_id, parent_id, name, kind, sort_order) values
    (p_user_id, v_egyeb_kiadas, 'Ajándék', 'expense', 1),
    (p_user_id, v_egyeb_kiadas, 'Egyéb', 'expense', 2);

  insert into public.categories (user_id, parent_id, name, kind, sort_order) values
    (p_user_id, v_fizetes, 'Munkabér', 'income', 1),
    (p_user_id, v_fizetes, 'Prémium', 'income', 2);

  insert into public.categories (user_id, parent_id, name, kind, sort_order) values
    (p_user_id, v_egyeb_bevetel, 'Kamat', 'income', 1),
    (p_user_id, v_egyeb_bevetel, 'Ajándék', 'income', 2),
    (p_user_id, v_egyeb_bevetel, 'Egyéb', 'income', 3);
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.seed_default_categories(new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ===================================================================
-- 20260820100001_lock_down_seed_function.sql
-- ===================================================================
-- A seed_default_categories kizárólag az on_auth_user_created triggeren
-- keresztül hívódjon (SECURITY DEFINER kontextusban) — ne legyen közvetlenül
-- hívható PostgREST RPC végpontként, ahol egy authenticated user tetszőleges
-- p_user_id-t adhatna meg.
revoke execute on function public.seed_default_categories(uuid) from public;
revoke execute on function public.seed_default_categories(uuid) from anon;
revoke execute on function public.seed_default_categories(uuid) from authenticated;

-- ===================================================================
-- 20260903100001_bi_views_and_reader_role.sql
-- ===================================================================
-- BI nézetek és a bi_reader read-only szerepkör (3. fázis — lásd spec 3.6 és 7.1)
--
-- A nézetek kiszolgálják a /reports képernyőt ÉS a külső BI eszközöket (Power BI,
-- Looker Studio, Metabase) egyszerre. `security_invoker = true`: az alkalmazásból
-- (PostgREST-en, authenticated userrel) hívva rajtuk is érvényesül az RLS, tehát
-- mindenki csak a saját adatát látja. A bi_reader szerepkör viszont BYPASSRLS-t
-- kap, mert direkt Postgres-kapcsolatnál nincs JWT/auth.uid() kontextus — enélkül
-- egyetlen sort sem látna.

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

