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
