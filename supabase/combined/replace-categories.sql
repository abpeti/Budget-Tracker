-- Egyedi kategórialista beültetése — lecseréli a meglévő kategóriákat.
-- Futtasd le a Supabase SQL Editorban (Dashboard → SQL Editor → New query).
--
-- Egyfelhasználós app, ezért a v_user_id-t automatikusan az egyetlen
-- auth.users sorból veszi. Ha egy régi kategóriát már használ egy
-- rögzített tranzakció, a törlés hibával leáll (nem töröl semmit sem —
-- az egész script egy tranzakcióban fut), és az error üzenet megmondja,
-- melyik kategória blokkolja.

do $$
declare
  v_user_id uuid;

  v_bevasarlas   uuid;
  v_szorakozas   uuid;
  v_oktatas      uuid;
  v_utazas       uuid;
  v_auto         uuid;
  v_orvos        uuid;
  v_lakhatas     uuid;
  v_elofizetesek uuid;
  v_egyeb_kiadas uuid;

  v_fizetes      uuid;
  v_befektetes   uuid;
begin
  select id into v_user_id from auth.users limit 1;

  if v_user_id is null then
    raise exception 'Nincs egyetlen felhasználó sem az auth.users táblában.';
  end if;

  -- Régi kategóriák törlése (előbb az alkategóriák a parent_id restrict miatt).
  delete from public.categories where user_id = v_user_id and parent_id is not null;
  delete from public.categories where user_id = v_user_id and parent_id is null;

  -- ===================== KIADÁSOK =====================

  insert into public.categories (user_id, name, kind, sort_order) values (v_user_id, 'Bevásárlás', 'expense', 1) returning id into v_bevasarlas;
  insert into public.categories (user_id, parent_id, name, kind, sort_order) values
    (v_user_id, v_bevasarlas, 'Élelmiszer', 'expense', 1),
    (v_user_id, v_bevasarlas, 'Háztartás', 'expense', 2),
    (v_user_id, v_bevasarlas, 'Alkohol', 'expense', 3),
    (v_user_id, v_bevasarlas, 'Ruha', 'expense', 4),
    (v_user_id, v_bevasarlas, 'Kozmetikum', 'expense', 5),
    (v_user_id, v_bevasarlas, 'Személyes elektronika', 'expense', 6);

  insert into public.categories (user_id, name, kind, sort_order) values (v_user_id, 'Szórakozás', 'expense', 2) returning id into v_szorakozas;
  insert into public.categories (user_id, parent_id, name, kind, sort_order) values
    (v_user_id, v_szorakozas, 'Dohány/vape', 'expense', 1),
    (v_user_id, v_szorakozas, 'Travel', 'expense', 2),
    (v_user_id, v_szorakozas, 'Party', 'expense', 3),
    (v_user_id, v_szorakozas, 'Könyv', 'expense', 4),
    (v_user_id, v_szorakozas, 'Sport', 'expense', 5),
    (v_user_id, v_szorakozas, 'Egyéb', 'expense', 6);

  insert into public.categories (user_id, name, kind, sort_order) values (v_user_id, 'Oktatás', 'expense', 3) returning id into v_oktatas;
  insert into public.categories (user_id, parent_id, name, kind, sort_order) values
    (v_user_id, v_oktatas, 'Kurzusok', 'expense', 1),
    (v_user_id, v_oktatas, 'Különóra', 'expense', 2);

  insert into public.categories (user_id, name, kind, sort_order) values (v_user_id, 'Utazás', 'expense', 4) returning id into v_utazas;
  insert into public.categories (user_id, parent_id, name, kind, sort_order) values
    (v_user_id, v_utazas, 'Busz', 'expense', 1),
    (v_user_id, v_utazas, 'Vonat', 'expense', 2),
    (v_user_id, v_utazas, 'Taxi', 'expense', 3),
    (v_user_id, v_utazas, 'Bérlet', 'expense', 4);

  insert into public.categories (user_id, name, kind, sort_order) values (v_user_id, 'Autó', 'expense', 5) returning id into v_auto;
  insert into public.categories (user_id, parent_id, name, kind, sort_order) values
    (v_user_id, v_auto, 'Üzemanyag', 'expense', 1),
    (v_user_id, v_auto, 'Adó', 'expense', 2),
    (v_user_id, v_auto, 'Parkolás', 'expense', 3),
    (v_user_id, v_auto, 'Biztosítás', 'expense', 4),
    (v_user_id, v_auto, 'Szerviz/karbantartás', 'expense', 5),
    (v_user_id, v_auto, 'Takarítás', 'expense', 6),
    (v_user_id, v_auto, 'Kiegészítők', 'expense', 7),
    (v_user_id, v_auto, 'Egyéb', 'expense', 8);

  insert into public.categories (user_id, name, kind, sort_order) values (v_user_id, 'Orvos', 'expense', 6) returning id into v_orvos;
  insert into public.categories (user_id, parent_id, name, kind, sort_order) values
    (v_user_id, v_orvos, 'Magánorvos', 'expense', 1),
    (v_user_id, v_orvos, 'Gyógyszer', 'expense', 2),
    (v_user_id, v_orvos, 'Vitamin', 'expense', 3),
    (v_user_id, v_orvos, 'Szemüveg', 'expense', 4),
    (v_user_id, v_orvos, 'Mentális egészség', 'expense', 5),
    (v_user_id, v_orvos, 'Fogorvos', 'expense', 6);

  insert into public.categories (user_id, name, kind, sort_order) values (v_user_id, 'Lakhatás', 'expense', 7) returning id into v_lakhatas;
  insert into public.categories (user_id, parent_id, name, kind, sort_order) values
    (v_user_id, v_lakhatas, 'Bérleti díj', 'expense', 1),
    (v_user_id, v_lakhatas, 'Rezsi', 'expense', 2);

  insert into public.categories (user_id, name, kind, sort_order) values (v_user_id, 'Előfizetések', 'expense', 8) returning id into v_elofizetesek;
  insert into public.categories (user_id, parent_id, name, kind, sort_order) values
    (v_user_id, v_elofizetesek, 'Telefon', 'expense', 1),
    (v_user_id, v_elofizetesek, 'Internet', 'expense', 2),
    (v_user_id, v_elofizetesek, 'Egyéb', 'expense', 3);

  insert into public.categories (user_id, name, kind, sort_order) values (v_user_id, 'Egyéb', 'expense', 9) returning id into v_egyeb_kiadas;
  insert into public.categories (user_id, parent_id, name, kind, sort_order) values
    (v_user_id, v_egyeb_kiadas, 'Ajándék', 'expense', 1),
    (v_user_id, v_egyeb_kiadas, 'Véletlen költség', 'expense', 2),
    (v_user_id, v_egyeb_kiadas, 'Szerencsejáték', 'expense', 3),
    (v_user_id, v_egyeb_kiadas, 'Munkahellyel kapcsolatos', 'expense', 4);

  -- ===================== BEVÉTEL =====================

  insert into public.categories (user_id, name, kind, sort_order) values (v_user_id, 'Fizetés', 'income', 1) returning id into v_fizetes;
  insert into public.categories (user_id, parent_id, name, kind, sort_order) values
    (v_user_id, v_fizetes, 'Munkabér', 'income', 1),
    (v_user_id, v_fizetes, 'Mellékállás', 'income', 2),
    (v_user_id, v_fizetes, 'Segély', 'income', 3),
    (v_user_id, v_fizetes, 'Egyéb', 'income', 4);

  insert into public.categories (user_id, name, kind, sort_order) values (v_user_id, 'Befektetés', 'income', 2) returning id into v_befektetes;
  insert into public.categories (user_id, parent_id, name, kind, sort_order) values
    (v_user_id, v_befektetes, 'Kamat', 'income', 1),
    (v_user_id, v_befektetes, 'Tőke', 'income', 2);

  insert into public.categories (user_id, name, kind, sort_order) values (v_user_id, 'Egyéb', 'income', 3);
end $$;
