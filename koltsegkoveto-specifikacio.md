# Személyes költségkövető alkalmazás — fejlesztési specifikáció

> Ez a dokumentum egy Claude Code munkamenet indító briefje. Olvasd végig, mielőtt bármit kódolnál.
> Ahol a spec nem dönt el valamit, kérdezz rá, ne találj ki új funkciót.

---

## 1. Kontextus és cél

Egyfelhasználós, személyes költségkövető alkalmazást építünk, ami az AndroMoney nevű Android-app leváltására készül. A fő fájdalompont, amit meg kell oldani: **a rögzítés legyen villámgyors és egy kézzel elvégezhető**, mert jellemzően a bolt előtt, állva, telefont egy kézben tartva történik.

**Az alkalmazás sikerének mércéje:** a bolt elhagyásától a rögzített tranzakcióig eltelt idő 10 másodperc alatt legyen, a képernyő alsó harmadában elérhető gombokkal.

### Alapdöntések (ezek adottak, ne térj el tőlük)

| Kérdés | Döntés |
|---|---|
| Platform | **PWA** (telepíthető webalkalmazás). Nincs natív Android app, nincs Play Store, nincs Android Studio. |
| Backend | **Supabase** (Postgres + Auth + RLS + Storage). Nincs saját backend szerver. |
| Felhasználók | **Egy felhasználó** (a fejlesztő maga). Nincs megosztás, nincs csapatfunkció. |
| Offline mód | **Nem kell.** Az app online működik. Ne építs service worker alapú szinkronizációt, IndexedDB queue-t, konfliktuskezelést. |
| Adatmigráció | **Nincs.** Tiszta adatbázissal indulunk, nem kell AndroMoney importer. |
| Deviza | **HUF** az egyetlen deviza az MVP-ben. A séma készüljön fel többre, de a UI ne foglalkozzon vele. |

---

## 2. Technológiai stack

```
Frontend:   React 19 + TypeScript + Vite
Styling:    Tailwind CSS v4
Komponensek: shadcn/ui (csak amit tényleg használunk, ne húzd be az egészet)
Routing:    React Router
Adatréteg:  @supabase/supabase-js + TanStack Query (cache, optimistic update)
Űrlapok:    react-hook-form + zod
Grafikonok: Recharts
Dátum:      date-fns (hu locale)
PWA:        vite-plugin-pwa (csak telepíthetőség és app shell cache — nem offline szinkron)
Backend:    Supabase (Postgres 15+, Auth, Row Level Security)
Hosting:    Vercel vagy Cloudflare Pages (statikus build)
```

**Fontos megkötések:**
- Ne írj saját Node/Express backendet. A frontend közvetlenül a Supabase kliensen keresztül kommunikál.
- Ne tegyél `service_role` kulcsot a frontendbe. Csak az `anon` kulcs kerülhet a kliensbe, minden hozzáférést RLS szabályoz.
- A projekt legyen mobile-first. A desktop nézet másodlagos, de legyen használható (riportok nézegetésére).

---

## 3. Adatmodell

Minden tábla tartalmaz `user_id uuid` oszlopot `auth.users(id)`-ra hivatkozva, és minden táblán RLS van bekapcsolva `user_id = auth.uid()` feltétellel. Egyfelhasználós app, de ez a jövőt nem zárja le és a Supabase-nél ez az alapértelmezett helyes minta.

### 3.1 `accounts` — számlák

```sql
create table accounts (
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
```

- A számla **aktuális egyenlege számított érték**, nem tárolt oszlop: `opening_balance` + a tranzakciók hatása. Erre készíts view-t (lásd 3.6).
- Archiválás van, törlés csak akkor, ha nincs rá hivatkozó tranzakció (különben blokkoló hibaüzenet, nem néma bukás).

### 3.2 `categories` — kategóriák és alkategóriák

```sql
create table categories (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  parent_id    uuid references categories(id) on delete restrict,
  name         text not null,
  kind         text not null check (kind in ('expense','income')),
  icon         text,
  color        text,
  is_archived  boolean not null default false,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now()
);
```

- **Pontosan két szint.** A `parent_id` nélküli sor a főkategória, a `parent_id`-vel rendelkező az alkategória. Adatbázis-szintű constraint akadályozza meg a harmadik szintet (trigger vagy check a parent parent_id-jén).
- Az alkategória `kind`-ja meg kell egyezzen a szülőével.
- Tranzakcióhoz **alkategória is rendelhető, de nem kötelező** — lehet csak főkategóriára rögzíteni.
- Kezdeti seed adat: adj egy értelmes magyar alapkategória-készletet (Élelmiszer, Lakhatás, Közlekedés, Egészség, Szórakozás, Ruházat, Előfizetések, Egyéb; bevétel oldalon Fizetés, Egyéb bevétel), alkategóriákkal. A felhasználó ezt utána szabadon átírhatja.

### 3.3 `transactions` — tranzakciók

```sql
create table transactions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  occurred_at   date not null default current_date,
  direction     text not null check (direction in ('expense','income','transfer')),
  amount        numeric(14,2) not null check (amount > 0),
  account_id    uuid not null references accounts(id) on delete restrict,
  to_account_id uuid references accounts(id) on delete restrict,
  category_id   uuid references categories(id) on delete restrict,
  payee         text,
  note          text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
```

**Szabályok, constraint-ekkel kikényszerítve:**
- Az `amount` **mindig pozitív**. Az előjelet a `direction` hordozza. Ez sokkal kevesebb hibát okoz, mint az előjeles tárolás.
- `direction = 'transfer'` esetén: `to_account_id` kötelező, `category_id` kötelezően NULL, és `to_account_id <> account_id`. Az átvezetés **egyetlen sor**, nem két sor — a nézetek bontják ki két lábra.
- `direction in ('expense','income')` esetén: `to_account_id` kötelezően NULL.
- A `category_id` kindja egyezzen a `direction`-nel (kiadás kategória kiadáshoz).
- `occurred_at` **date**, nem timestamp. A pontos időpont nem érdekes, és a dátum-only kezelés jóval kevesebb időzóna-hibát okoz.
- Index: `(user_id, occurred_at desc)`, `(user_id, category_id)`, `(user_id, account_id)`.

### 3.4 `budgets` — havi keretek

```sql
create table budgets (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  category_id  uuid not null references categories(id) on delete cascade,
  amount       numeric(14,2) not null check (amount > 0),
  valid_from   date not null,   -- hónap első napja
  valid_to     date,            -- null = határozatlan
  created_at   timestamptz not null default now()
);
```

Főkategóriára állítható havi keret. A felhasználás a kategória és összes alkategóriája együttes költése.

### 3.5 `recurring_rules` — ismétlődő tételek

```sql
create table recurring_rules (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  name           text,            -- opcionális megnevezés (pl. "Albérlet")
  template       jsonb not null,  -- direction, amount, account_id, category_id, payee, note
  frequency      text not null check (frequency in ('daily','weekly','monthly','yearly')),
  interval_count int not null default 1 check (interval_count between 1 and 99),
  day_of_period  int not null,
  next_run       date not null,
  end_date       date,            -- null = határozatlan
  last_run       date,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now()
);
```

A `frequency` és az `interval_count` együtt adja ki az ütemezést: `monthly`+1 =
havonta, `monthly`+3 = negyedévente, `monthly`+6 = félévente, `yearly`+1 = évente,
`weekly`+2 = kéthetente. A `day_of_period` a horgony: havi/éves ismétlődésnél a
hónap napja (31 = a hónap utolsó napja a rövidebb hónapokban is), hetinél az ISO
hétnap. A következő esedékesség mindig a horgonyból számolódik, nem az előző
dátum eltolásával — így egy február nem csúsztatja el a sorozat többi tagját.

A generált tranzakció a `transactions.source_rule_id` mezőben őrzi, melyik
szabályból született; ugyanaz a szabály ugyanarra a napra csak egyszer könyvel.

A generálás **ne** cron legyen: az app indulásakor ellenőrzi, van-e lejárt
`next_run`, és felajánlja a rögzítést. Ez egyszerűbb és átláthatóbb, mint egy
háttérfolyamat, ami a tudtod nélkül könyvel. Az elmaradt előfordulások
egyesével jönnek vissza, mindegyik külön rögzíthető vagy kihagyható.

### 3.6 Nézetek (view-k)

Ezek szolgálják ki a riportokat **és** a BI eszközt egyszerre. Legyenek `security_invoker = true` beállítással, hogy az RLS érvényesüljön rajtuk.

- **`v_transactions_flat`** — a BI-hoz készült denormalizált fő nézet, egy sor = egy tranzakció:
  `id, occurred_at, year, month, direction, amount, signed_amount, account_name, account_type, to_account_name, category_name, parent_category_name, category_path, payee, note, created_at`
  A `signed_amount` kiadásnál negatív, bevételnél pozitív, átvezetésnél 0.
- **`v_account_balances`** — számlánként: nyitó egyenleg, bejövő, kimenő, átvezetések, aktuális egyenleg.
- **`v_monthly_category_totals`** — hónap × kategória × alkategória bontású összegek.
- **`v_budget_status`** — aktuális hónap keret / elköltött / maradék / kihasználtság %.

---

## 4. Autentikáció

- Supabase Auth, **email + jelszó**. Nincs magic link, nincs OAuth — felesleges bonyolítás egy felhasználóhoz.
- **A publikus regisztráció legyen letiltva** a Supabase projekt beállításaiban. Az egyetlen felhasználót kézzel hozzuk létre a Supabase konzolon. A dokumentációban írd le, hogyan.
- A session maradjon meg hosszan (persist session), hogy ne kelljen naponta bejelentkezni. Ez a napi használat szempontjából kritikus.
- Az app útvonalai védettek, bejelentkezés nélkül csak a login képernyő érhető el.

---

## 5. Felhasználói felület

### 5.1 Alapelvek — ezek nem díszítés, ezekből következik minden

1. **Hüvelykujj-zóna.** Minden gyakran használt interaktív elem a képernyő **alsó 60%-ában** legyen. A felső sáv csak információt jelenít meg, nem tartalmaz gombot, amit menet közben kell nyomni.
2. **Egykezes használat.** Semmi olyan gesztus, ami két kezet igényel. Semmi apró célpont: a minimális érintési felület 48×48 px.
3. **A rögzítés az alapállapot.** Az app megnyitása után azonnal az összeg beírásánál vagyunk, nem egy dashboardon, ahonnan még el kell navigálni.
4. **Nulla kötelező mező az összegen és a kategórián kívül.** Dátum = ma, számla = az utoljára használt. Ezek egy koppintással felülírhatók, de alapból nem kérdez rá semmire.

### 5.2 Gyorsrögzítő képernyő (`/` — ez a nyitóképernyő)

Ez az app szíve. Ezt kell a legjobban megcsinálni.

**Felépítés fentről lefelé:**

```
┌─────────────────────────────┐
│  Kiadás | Bevétel | Átvez.  │  ← szegmentált kapcsoló, kiadás az alapértelmezett
├─────────────────────────────┤
│                             │
│        12 450 Ft            │  ← nagy, jól olvasható összegkijelző
│      Élelmiszer › Bolt      │  ← kiválasztott kategória, koppintásra módosítható
│      Készpénz · ma          │  ← számla és dátum, koppintásra módosítható
│                             │
├─────────────────────────────┤
│  [gyakori kategória chipek] │  ← vízszintesen görgethető, 6-8 db
├─────────────────────────────┤
│   1     2     3      ⌫      │
│   4     5     6      000    │  ← saját numpad, NEM a rendszerbillentyűzet
│   7     8     9      +      │
│   .     0    Kat.   MENTÉS  │
└─────────────────────────────┘
```

**Részletek:**
- **Saját numerikus billentyűzet**, nem `<input type="number">`. A rendszerbillentyűzet lassú, ugrál, és elveszi a képernyő felét. A saját numpad mindig ugyanott van, azonnal reagál.
- A **`000` gomb** magyar viszonylatban aranyat ér (12 000 Ft = négy koppintás).
- A **`+` gomb** összeadás módba vált, hogy több tétel összegét egyben lehessen bepötyögni anélkül, hogy fejben kellene számolni.
- A **gyakori kategória chipek** dinamikusak: az elmúlt 30 nap leggyakrabban használt kategóriái, használati gyakoriság szerint rendezve. Egy koppintás a chipre = kategória kiválasztva. Ez az, amitől a rögzítés 10 másodperc alá megy.
- A **MENTÉS gomb a jobb alsó sarokban** van (jobbkezes hüvelykujjnak ez a legkönnyebb pont). Legyen beállítás a bal oldalra helyezéshez.
- Mentés után: rövid haptikus visszajelzés (`navigator.vibrate`), toast „Rögzítve · Visszavonás" gombbal (5 másodperc), és a form azonnal ürül a következő tételhez. **Ne navigálj el máshová.**
- A kategóriaválasztó egy alulról felcsúszó lap (bottom sheet), amiben a főkategóriák nagy csempéken jelennek meg; a főkategóriára koppintva nyílnak az alkategóriák. Legyen benne kereső, de ne az legyen fókuszban (különben felugrik a billentyűzet).

### 5.3 További képernyők

| Útvonal | Tartalom |
|---|---|
| `/transactions` | Tranzakciólista, dátum szerint csoportosítva, végtelen görgetéssel. Szűrés: időszak, számla, kategória, irány, szabadszavas keresés. Sorra koppintva szerkesztés, balra húzva törlés (megerősítéssel). |
| `/reports` | Riportok (lásd 6. fejezet). |
| `/accounts` | Számlák listája aktuális egyenleggel, összesített vagyonnal. Hozzáadás, szerkesztés, archiválás, sorrend. |
| `/categories` | Kategóriafa. Hozzáadás, átnevezés, ikon és szín, archiválás, drag-and-drop sorrend, alkategória áthelyezése másik főkategória alá. |
| `/settings` | Devizajelölés, hét kezdőnapja, mentés gomb oldala, adatexport (CSV), biztonsági mentés és visszaállítás (JSON), BI hozzáférés adatai, kijelentkezés. |

Alsó navigációs sáv 5 elemmel: **Rögzítés · Tételek · Számlák · Riportok · Beállítások**. A Számlák középen, hüvelykujj-közelben van, hogy az egyenlegek és az összvagyon egyetlen koppintással elérhetők legyenek.

### 5.4 Vizuális irány

Nem kérünk „vállalati fintech" kinézetet és nem kérünk játékos, illusztrációkkal teli felületet sem. A cél egy **csendes, magas kontrasztú, tipográfia-vezérelt** felület, ahol a számok a főszereplők:

- Az összegek **tabuláris számokkal** (`font-variant-numeric: tabular-nums`) jelenjenek meg, hogy a listákban a számjegyek oszlopba rendeződjenek. Ez az egyetlen tipográfiai döntés, ami egy pénzügyi appot azonnal komolyabbá tesz.
- Sötét mód **alapértelmezettként**, mert az esti rögzítés a gyakori, és világos módban is legyen jól olvasható.
- A színek szemantikusak legyenek, ne dekoratívak: kiadás, bevétel, átvezetés kap egy-egy visszafogott árnyalatot; a kategóriaszínek csak apró jelzőpontként jelennek meg, ne fessék be az egész sort.
- Animáció minimálisan: a bottom sheet nyitása és a mentés visszajelzése. Semmi más. Tiszteld a `prefers-reduced-motion` beállítást.

---

## 6. Riportok

Minden riport tetején egy közös időszakválasztó: *Ez a hónap · Előző hónap · Ez az év · Egyedi tartomány*.

1. **Havi áttekintés** — bevétel, kiadás, egyenleg három nagy számként; alattuk a napi költés oszlopdiagramja.
2. **Kategóriabontás** — donut vagy vízszintes sávdiagram főkategóriánként; egy szeletre koppintva lefúrás az alkategóriákra, onnan a konkrét tranzakciókra.
3. **Trend** — havi kiadás és bevétel vonaldiagram az elmúlt 12 hónapra, opcionálisan egy kategóriára szűrve.
4. **Keretek** — az aktuális havi budget-ek állapota progress barokkal, túllépés kiemelve.
5. **Számlaegyenlegek** — számlánkénti egyenleg és az összvagyon alakulása.

Minden riport képernyőn legyen „Adatok CSV-be" gomb.

---

## 7. BI hozzáférés — kiemelt követelmény

Az adatbázisnak **kívülről, programozottan elérhetőnek kell lennie**, hogy egy BI eszköz (Power BI, Metabase, Grafana, Looker Studio) rá tudjon csatlakozni. Ehhez három utat készíts elő, és mindhármat dokumentáld:

### 7.1 Közvetlen Postgres kapcsolat (ez a fő út, ezt használja majd a Power BI)

- Hozz létre migrációban egy **`bi_reader` read-only Postgres szerepkört**, aminek `SELECT` joga van a `v_*` nézetekre és a nyers táblákra, de `INSERT/UPDATE/DELETE` joga nincs semmire.
- A Supabase **connection pooler** (Session mode) connection stringjét dokumentáld, mert a legtöbb BI eszköz ezt igényli.
- Írd le, hogyan kell a `bi_reader` jelszavát beállítani és rotálni.

### 7.2 REST API (PostgREST)

A Supabase automatikusan publikálja a táblákat és nézeteket REST végponton. Dokumentáld:
- a végpontok alakját (`GET /rest/v1/v_transactions_flat?occurred_at=gte.2026-01-01`),
- a szükséges fejléceket,
- a szűrés, rendezés, lapozás szintaxisát,
- **és külön hangsúlyosan azt, hogy melyik kulcsot hol szabad használni.** A `service_role` kulcs kizárólag szerveroldali vagy asztali BI eszközbe kerülhet, böngészőbe soha.

### 7.3 CSV export és biztonsági mentés

Az adatok soha ne ragadjanak be az appba. A Beállítások képernyő „Adataid” kártyája három műveletet ad:

- **Minden tranzakció CSV-be** — egy gombnyomással letölthető teljes tranzakcióexport, a `v_transactions_flat` szerkezetében (nevekkel, nem id-kkal; előjeles összeggel; kategória-útvonallal), UTF-8 BOM-mal (hogy az Excel ne rontsa el az ékezeteket) és ISO dátumformátummal. A táblát lapozva olvassuk, hogy az 1000 soros PostgREST-limit ne csonkolja.
- **Biztonsági mentés (JSON)** — veszteségmentes mentés minden tábláról (számlák, kategóriák, ismétlődő szabályok, tranzakciók, keretek) az eredeti id-kkal. A fájl fejléce: `format: "koltsegkoveto-backup"`, `version`, `exported_at`. A `user_id` nincs a fájlban.
- **Visszaállítás mentésből** — a felhasználó kiválaszt egy JSON mentést; az app validálja (zod séma, formátum- és verzióellenőrzés), megerősítő dialógusban összegzi a tartalmát, majd **id szerint összefésüli** a meglévő adatokkal: a mentésben szereplő sorok felülírják az azonos id-júakat, a többi megmarad, semmi nem törlődik. Idegen kulcs szerinti sorrendben ír (számlák → fő- → alkategóriák → ismétlődő szabályok → tranzakciók → keretek), az adatbázis triggerei minden sorra lefutnak. Ugyanaz a mentés többször is visszaállítható, az eredmény ugyanaz. Használati esetek: véletlen törlés visszahozása, költözés új Supabase-projektbe.

> **Megjegyzés a nézetekhez:** a `v_*` nézetek a BI szerződéses felülete. Ha később változtatod a nyers táblák szerkezetét, a nézetek maradjanak stabilak, hogy a BI riportok ne törjenek el.

---

## 8. Nem funkcionális követelmények

- **PWA:** manifest, ikonok (192/512, maskable), `display: standalone`, telepíthető Android Chrome-ból. Az app shell legyen cache-elve a gyors indulásért — de **adatszinkron logikát ne írj**.
- **Teljesítmény:** a gyorsrögzítő képernyő interaktív legyen 1,5 másodpercen belül 4G-n. A mentés legyen optimistic update-tel azonnali a UI-on.
- **Hibakezelés:** ha a mentés elbukik, a felhasználó azt lássa, hogy mi bukott el és mit tehet — az adat maradjon a formban, ne vesszen el. Az üres állapotok (nincs tranzakció, nincs riportadat) mondják meg, mi a következő lépés.
- **Pénzösszegek:** kliensoldalon soha ne számolj `float`-tal. Egész fillérben (integer) vagy decimális könyvtárral dolgozz, a Postgres oldalon `numeric`.
- **Lokalizáció:** magyar felület, magyar számformátum (szóközös ezreselválasztó), `hu` locale a dátumoknál.
- **Akadálymentesség:** látható fókuszjelölés, értelmes `aria-label`-ek a numpad gombokon, kontrasztarány min. 4.5:1.

---

## 9. Fejlesztési fázisok

Fázisonként állj meg, és mutasd meg, mi készült el, mielőtt a következőbe kezdesz.

**1. fázis — Alapok**
Projekt felállítás, Supabase séma migrációkkal, RLS policy-k, seed kategóriák, auth és védett útvonalak, alsó navigáció csontváza.

**2. fázis — A rögzítés**
Gyorsrögzítő képernyő teljes egészében: saját numpad, kategóriaválasztó sheet, gyakori kategória chipek, számla- és dátumválasztó, mentés visszavonással. Tranzakciólista szűréssel és szerkesztéssel. Számla- és kategóriakezelő képernyők.
*A 2. fázis végén az app már napi használatra alkalmas.*

**3. fázis — Riportok és BI**
A 6. fejezet riportjai, a `v_*` nézetek, a `bi_reader` szerepkör, CSV export, BI dokumentáció.

**4. fázis — Kényelem**
Budget-ek és keretfigyelés, ismétlődő tételek, beállítások finomhangolása, PWA telepítési polírozás.

---

## 10. Amit kifejezetten ne csinálj

- Ne építs offline szinkronizációt, IndexedDB write queue-t, konfliktuskezelést.
- Ne írj natív Android wrappert (Capacitor, Cordova, TWA) — kifejezett cél, hogy ez kimaradjon.
- Ne építs többfelhasználós megosztást, meghívókat, jogosultsági szinteket.
- Ne köss be banki adatimportot (GoCardless, Plaid, SMS-parsing).
- Ne tegyél bele AI kategorizálót, OCR-t, blokkfotó-elemzést.
- Ne generálj tucatnyi ki nem használt shadcn komponenst.
- Ne tárolj titkos kulcsot a repóban. `.env.example` legyen, `.env` ne.

---

## 11. Elfogadási kritériumok

- [ ] Telefonon, egy kézzel, a hüvelykujjammal rögzíthető egy kiadás **10 másodperc alatt**, a rendszerbillentyűzet megjelenése nélkül.
- [ ] A mentés után azonnal rögzíthető a következő tétel, navigáció nélkül.
- [ ] Új kategória, alkategória és számla létrehozható és szerkeszthető a felületről, kódmódosítás nélkül.
- [ ] Két számla közti átvezetés rögzíthető, és **nem jelenik meg kiadásként vagy bevételként** a riportokban.
- [ ] Egy Power BI / Metabase példány rá tud csatlakozni a `v_transactions_flat` nézetre a `bi_reader` szerepkörrel, és látja az összes tranzakciót.
- [ ] A `bi_reader` szerepkörrel megkísérelt írás **hibára fut**.
- [ ] Bejelentkezés nélkül semmilyen adat nem érhető el, sem a felületen, sem a REST API-n keresztül.
- [ ] Az app telepíthető Android Chrome-ból a kezdőképernyőre, és onnan indítva nincs böngésző-címsor.

---

## 12. Amit a végén adj át

- Futó alkalmazás és deploy leírás.
- `README.md`: helyi fejlesztés indítása, környezeti változók, Supabase projekt felállítása lépésről lépésre, az egyetlen felhasználó létrehozása.
- `docs/bi-access.md`: connection string, `bi_reader` beállítása, nézetek oszlopleírása, példa lekérdezések.
- Verziózott SQL migrációk a `supabase/migrations` könyvtárban — a séma legyen egy paranccsal újraépíthető.
