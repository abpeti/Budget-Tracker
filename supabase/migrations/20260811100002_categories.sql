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
