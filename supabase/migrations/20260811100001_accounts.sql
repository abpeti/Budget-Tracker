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
