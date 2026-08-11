# Költségkövető

Egyfelhasználós, személyes költségkövető PWA. Részletes termékspecifikáció:
[koltsegkoveto-specifikacio.md](./koltsegkoveto-specifikacio.md).

**Fejlesztési állapot: 2. fázis — A rögzítés, kész.**
Az app már napi használatra alkalmas: gyorsrögzítő képernyő saját numpaddal,
kategória-/számla-/dátumválasztóval, gyakori kategória chipekkel, visszavonható
mentéssel; tranzakciólista szűréssel, végtelen görgetéssel és szerkesztéssel;
számla- és kategóriakezelő képernyők. A riportok, a `v_*` nézetek és a BI
hozzáférés a 3. fázisban készülnek el.

## Technológia

React 19 + TypeScript + Vite · Tailwind CSS v4 · shadcn/ui (kézzel felvett
komponensek) · React Router · Supabase (`@supabase/supabase-js`) · TanStack
Query · react-hook-form + zod · date-fns · vite-plugin-pwa.

## Helyi fejlesztés indítása

```bash
npm install
cp .env.example .env   # töltsd ki a Supabase URL-t és anon kulcsot (lásd lent)
npm run dev
```

Az app a `http://localhost:5173` címen fut.

```bash
npm run build      # production build (tsc -b && vite build)
npm run preview    # a build kipróbálása lokálisan
npm run lint        # oxlint
```

## Környezeti változók

A `.env` fájl (soha ne kerüljön verziókezelésbe — a `.gitignore` már kizárja):

```
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

Csak az **anon** (public) kulcs kerülhet ide. A `service_role` kulcs sosem
kerülhet a frontendbe vagy verziókezelésbe — az adatbiztonságot a Postgres
Row Level Security (RLS) szabályok adják, `user_id = auth.uid()` alapon.

Mindkét érték a Supabase projekt **Settings → API** oldalán található.

## Supabase projekt felállítása lépésről lépésre

1. **Hozz létre egy új Supabase projektet** a [supabase.com](https://supabase.com)
   konzolon (Postgres 15+).

2. **Futtasd le a migrációkat.** A `supabase/migrations` mappa tartalmazza a
   teljes sémát (számlák, kategóriák, tranzakciók, keretek, ismétlődő
   szabályok, RLS szabályok, automatikus kategória-seedelés). Két lehetőség:

   **a) Supabase CLI-vel (ajánlott):**
   ```bash
   npx supabase login
   npx supabase link --project-ref <a-projekted-ref-je>
   npx supabase db push
   ```

   **b) Kézzel, az SQL Editorban:** nyisd meg a Supabase konzol SQL Editorát,
   és futtasd le a `supabase/migrations` mappa fájljait **név szerinti
   sorrendben** (a fájlnevek időbélyeggel kezdődnek, ez adja a sorrendet).

3. **Tiltsd le a publikus regisztrációt.** Authentication → Providers → Email
   → kapcsold ki az "Allow new users to sign up" opciót. Ez egy egyfelhasználós
   app — a regisztrációs felület szándékosan nem létezik a UI-ban sem.

4. **Hozd létre az egyetlen felhasználót kézzel.** Authentication → Users →
   "Add user" → "Create new user". Add meg az email címed és egy jelszót,
   és pipáld be az "Auto Confirm User" opciót (nincs email-visszaigazolási
   flow). A user létrehozásakor egy adatbázis-trigger (`on_auth_user_created`)
   automatikusan létrehozza a magyar alapkategória-készletet
   (Élelmiszer, Lakhatás, Közlekedés, stb. alkategóriákkal) — nincs szükség
   külön seed script futtatására.

5. **Másold ki a projekt URL-t és anon kulcsot** (Settings → API) a `.env`
   fájlba.

6. **Jelentkezz be** a most létrehozott email/jelszó párral az app
   `/login` oldalán.

### Séma áttekintés

| Tábla | Tartalom |
|---|---|
| `accounts` | Számlák (készpénz, bank, kártya, stb.), az egyenleg számított érték |
| `categories` | Kategóriák, pontosan két szint (fő- és alkategória), adatbázis-szinten kikényszerítve |
| `transactions` | Tranzakciók (kiadás/bevétel/átvezetés), az összeg mindig pozitív, az irányt a `direction` mező hordozza |
| `budgets` | Havi keretek főkategóriánként |
| `recurring_rules` | Ismétlődő tételek sablonjai (UI a 4. fázisban) |

A riportokhoz és a BI hozzáféréshez szükséges `v_*` nézetek és a `bi_reader`
szerepkör a 3. fázisban készülnek el, a specifikáció 3.6 és 7. fejezete
szerint.

## Deploy

A build statikus kimenet (`dist/`), ezért bármelyik statikus hosting
megfelel:

- **Vercel:** `vercel --prod` vagy GitHub-integráció, build parancs
  `npm run build`, kimeneti mappa `dist`.
- **Cloudflare Pages:** build parancs `npm run build`, kimeneti mappa `dist`.

A környezeti változókat (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) a
hosting felületén kell beállítani, ugyanazokkal az értékekkel, mint a
lokális `.env`-ben.

## Fejlesztési fázisok

A teljes ütemterv a specifikáció 9. fejezetében. Röviden:

1. **Alapok** — ✅ kész
2. **A rögzítés** — ✅ kész (ez a README ezt az állapotot írja le)
3. **Riportok és BI** — `v_*` nézetek, `bi_reader` szerepkör, riportok, CSV export
4. **Kényelem** — keretfigyelés, ismétlődő tételek, beállítások, PWA polírozás
