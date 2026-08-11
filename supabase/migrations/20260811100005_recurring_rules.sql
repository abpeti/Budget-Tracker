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
