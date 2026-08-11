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
