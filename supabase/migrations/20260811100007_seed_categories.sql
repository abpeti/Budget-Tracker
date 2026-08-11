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
