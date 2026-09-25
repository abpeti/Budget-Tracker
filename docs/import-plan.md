# CSV import bankkivonatból, duplikátum-szűréssel

> **MOSTANI LÉPÉS (a felhasználó döntése):** a fejlesztés még NEM indul. A jóváhagyás után kizárólag ez történik:
> 1. Ennek a tervnek a tartalma (ezt a keretes megjegyzést kivéve) bemásolódik a repóba: `docs/plans/csv-import-terv.md`.
> 2. Egy memória-jegyzet rögzíti, hogy a terv ott van, és később innen indul a megvalósítás.
>
> Semmilyen forráskód, migráció, package.json vagy spec nem módosul. Commit nem készül.
> Későbbi indítás: „Valósítsd meg a docs/plans/csv-import-terv.md tervet.”

## Kontextus

A tranzakciók ma kizárólag a numpados gyorsrögzítővel kerülnek be. Egy bankkivonat CSV-jének beolvasása sok manuális bevitelt spórol, de csak akkor használható, ha az ismételt import és a kézzel már rögzített tételek nem duplázódnak.

Felhasználói döntések (megbeszélve, nem újratárgyalandók):
1. **Általános oszlop-hozzárendelő** — bármely bank CSV-je; elválasztó és kódolás automatikus, az oszlopokat a felhasználó párosítja, a beállítás számlánként megjegyzésre kerül.
2. **Duplikátum-szűrés korábbi importok ÉS kézi tételek ellen** — ujjlenyomat (`import_hash`) DB-oszlop + részleges unique index, plusz heurisztika (számla + irány+összeg + ±1 nap) az előnézetben jelölve.
3. **Kulcsszavas kategóriajavaslat** — korábbi tételek `payee → category_id` párosaiból, egyszerű szövegegyezés (nem AI); előnézetben felülírható; találat nélkül kategória nélkül kerül be (a lista és riportok már kezelik: "Nincs kategória").
4. **A spec frissül** — 7.3 negyedik művelet, 10. pont pontosítva (élő banki integráció tilos, fájl-import nem).

**v1 korlát (a tervben kimondva):** csak kiadás/bevétel importálható. Saját számlák közti átvezetést a felhasználó az előnézetben kiveszi (a szerkesztő sheet nem enged irányt váltani).

## Kódbázis-tények, amikre építünk

- Pénz: kizárólag egész fillér, `src/lib/money.ts` (`toCents`, `centsToAmount`, `formatCentsAsHuf`). Float parse tilos (spec §8).
- `transactions` táblán nincs unique constraint és nincs import-azonosító. Oszlop+index hozzáadás mintája: `supabase/migrations/20260909100001_recurring_rules_intervals.sql:63-74`. A migrációk kézzel vannak összefűzve a `supabase/combined/full-schema.sql`-ben (`-- ===` szekciófejlécek), oda is be kell kerülnie.
- `src/lib/database.types.ts` kézzel karbantartott (transactions blokk :82-115).
- Létező előzmény-ellenőrzés beszúrás előtt: `src/lib/queries/recurring-rules.ts:166-176`.
- Cache-invalidálás: `transactionRelatedQueryKeys()` — `src/lib/queries/transactions.ts:39-46` (a `["report-transactions", userId]` kulcsot nem tartalmazza, azt külön kell).
- Lapozott olvasás: `fetchAllPages` — `src/lib/queries/backup.ts:32-42` (jelenleg nem exportált). Chunkolt írás: `upsertChunked` :126-134 (200 sor).
- Fájlválasztó minta: `src/components/settings/data-card.tsx:81-95` (`event.target.value = ""` reset, parse → state → `ConfirmDialog`, hiba a dialógusban marad).
- Újrahasznosítható sheet-ek: `src/components/quick-entry/account-picker-sheet.tsx` (`title?` prop), `category-picker-sheet.tsx` (`kind: CategoryKind`, `onSelect(category)`).
- Vissza-link minta: `src/pages/recurring-page.tsx:47-53`. Toggle-gombpár minta: `settings-page.tsx:81-98`. Natív `<select>` osztálysor: `src/components/accounts/account-form-sheet.tsx:103`.
- Backup zod-séma: `src/lib/backup.ts:83-96`, `BACKUP_VERSION = 1` (:21), `version: z.int().min(1)` — a 2-es verzió validál.
- Nincs tesztfuttató a projektben.

## Tervezési döntések

| Téma | Döntés | Miért |
|---|---|---|
| CSV parser | Saját RFC 4180 állapotgép (~40 sor) `src/lib/csv-import.ts`-ben | Nincs lib a projektben; papaparse csak streaminget adna; a tiszta-modul stílus már létezik (`backup.ts`, `money.ts`) |
| Ezreselválasztó | Nem mapping-mező; csak a `decimalSeparator` állítható, minden más nem-számjegy kidobva | `"1 234,56"`, `"12.450,00"`, `"1,234.56"` egy kapcsolóval parse-olható; rossz kapcsoló >2 tizedesjegyet ad → látható sorhiba, nem néma 100× hiba |
| Hash-normalizálás (leírás) | NFC + lowercase + szóközök összevonása + trim; ékezet **nem** kerül levágásra | A hash-ütközés néma (sor kihagyva), ezért konzervatív |
| Javaslat-kulcs | NFD + kombináló jelek törlése + lowercase + szóközök | A javaslat látható és felülírható, itt a találati arány számít |
| Hash bemenet | `"1\n" + accountId + isoDate + signedCents + normalizedDescription + ordinal` | `ordinal` = azonos (dátum, összeg, leírás) sorok sorszáma a fájlon belül → két azonos kávé ugyanaznap mindkettő bekerül; a vezető `"1"` formátumverzió |
| Insert vs upsert | Sima `insert` 200-as chunkokban, kliensoldali előszűrés a hash-halmaz ellen; PG `23505` = verseny ("frissítsd az előnézetet") | PostgREST `on_conflict` nem adja meg a részleges index predikátumát, Postgres elutasítja → `ignoreDuplicates` nem használható részleges unique indexszel |
| `Transaction` interface | Nem bővül | Semmi nem rendereli; `useUpdateTransaction` csak a megadott mezőket patch-eli, a hash megmarad |
| `v_transactions_flat` / lapos CSV | Változatlan | BI-szerződés; a lapos CSV nem restore-forrás. A JSON-mentés viszi a hash-t (veszteségmentes) |
| Backup verzió | 1 → 2; `import_hash` opcionális a zod-sémában | A restore verzió alapján dönt, küldje-e a kulcsot (chunkban minden sornak azonos kulcskészlet kell) |
| Belépési pont | Negyedik gomb az „Adataid” kártyán → `/import` saját oldal | Spec §7.3 ide teszi az adat be/ki műveleteket; több száz soros előnézet nem fér egy 85dvh sheetbe |

## Megvalósítás

### 1. Migráció

Új fájl: `supabase/migrations/20260918100001_transactions_import_hash.sql`

```sql
-- Bankkivonat-import (CSV): a kliens által számolt ujjlenyomat, amivel
-- ugyanazon kivonatsor kétszeri importja kiszűrhető. Kézi tételnél null.
alter table public.transactions
  add column if not exists import_hash text;

create unique index if not exists transactions_user_import_hash_uidx
  on public.transactions (user_id, import_hash)
  where import_hash is not null;

comment on column public.transactions.import_hash is
  'CSV-importból származó sor ujjlenyomata (SHA-256 hex). Kézi tételnél null.';
```

Ugyanezt `-- ===` fejléces szekcióként a `supabase/combined/full-schema.sql` végére. Nincs trigger- vagy nézetváltozás. `payee` index nem kell (a javaslat-index teljes kliensoldali olvasásból épül).

### 2. Tiszta modul: `src/lib/csv-import.ts` (új, hálózat- és React-mentes)

Import: `parse, isValid, format, differenceInCalendarDays` (date-fns), `toCents` (`@/lib/money`).

**Dekódolás és parse**
- `decodeCsvFile(buffer: ArrayBuffer): { text; encoding: "utf-8" | "utf-16le" | "windows-1250" }` — BOM levágás; `TextDecoder("utf-8", {fatal: true})`, hiba esetén `TextDecoder("windows-1250")` (OTP, K&H). cp1250 és ISO-8859-2 a magyar betűkön azonos kódpontú, elég ez a kettő.
- `detectDelimiter(text): "," | ";" | "\t"` — első 20 nem üres sor, soronkénti darabszám; pont = min (konzisztencia), majd összeg; kétes esetben `";"`.
- `parseCsv(text, delimiter): string[][]` — állapotgép: idézőjel, `""` escape, CRLF/LF, többsoros idézett mező; üres sorok eldobva.

**Mapping**
```ts
export const DATE_FORMATS = ["yyyy-MM-dd","yyyy.MM.dd.","yyyy.MM.dd","yyyy. MM. dd.","yyyy/MM/dd","yyyyMMdd",
  "dd.MM.yyyy","dd.MM.yyyy.","dd/MM/yyyy","dd-MM-yyyy","MM/dd/yyyy"] as const
export type AmountColumns =
  | { kind: "single"; amountCol: number; negate: boolean }
  | { kind: "split"; debitCol: number; creditCol: number }
export interface ColumnMapping {
  hasHeader: boolean; dateCol: number; amount: AmountColumns
  descriptionCol: number; noteCol: number | null
  dateFormat: DateFormat; decimalSeparator: "," | "."
}
export function guessMapping(headers: string[], sampleRows: string[][]): ColumnMapping
```
Fejléc-kulcsszavak (normalizálva, ékezet nélkül): dátum: `konyveles datuma, erteknap, datum, tranzakcio datuma, date, completed date, booking date, value date` (könyvelés/completed előnyben); összeg: `osszeg, amount, ertek`; terhelés/jóváírás: `terheles, debit, kiadas` / `jovairas, credit, bevetel`; leírás: `kozlemeny, leiras, partner, partner neve, kedvezmenyezett, megnevezes, description, payee, merchant, name`; megjegyzés: `megjegyzes, reference, note` (vagy `kozlemeny`, ha a leírás már a partner). `guessDateFormat`: minden minta parse-olódjon 1990–2100 évvel; `dd/MM` vs `MM/dd` esetén `dd/MM`, hacsak egy minta első tagja >12. `guessDecimalSeparator`: ha vessző és pont is van, az utolsó nyer; egyféle jel + pontosan 2 záró számjegy → tizedes; különben `","`. `hasHeader`: az első sor dátumoszlopa nem parse-olódik, a másodiké igen.

**Cella-parse (csak string-műveletek)**
- `parseAmountToCents(raw, decimalSeparator): number | null` — szóköz/NBSP/narrow NBSP ki, `−`/`–` → `-`, `(…)`, vezető/záró mínusz, `+` és pénznem kidobva, `lastIndexOf(decimalSeparator)` szerint bontva; `null`, ha nincs számjegy vagy a tört >2 jegy.
- `parseDateToIso(raw, fmt): string | null` — date-fns `parse`; ha nem illeszkedik, az első szóközig tartó token (pl. `"2026-09-15 10:22:31"`); év 1990–2100.

**Sorok, hash, osztályozás**
```ts
export interface ParsedRow { index; raw; occurredAt: string|null; signedCents: number|null; description; note: string|null; errors: string[] }
export function buildImportRows(table: string[][], mapping: ColumnMapping): ParsedRow[]
// split: signed = credit - debit (mindkettő abs); single: negate alkalmazva.
// Hibák: "Hiányzó/érvénytelen dátum", "Érvénytelen összeg", "Nulla összeg", "Hiányzó oszlop (a sor rövidebb)".

export interface ImportCandidate { index; occurredAt; signedCents; direction: "expense"|"income"; amountCents; description; note; ordinal; importHash }
export function normalizeDescription(s: string): string
export async function computeImportHash(i: { accountId; isoDate; signedCents; description; ordinal }): Promise<string> // crypto.subtle SHA-256 → hex
export async function prepareCandidates(rows: ParsedRow[], accountId: string): Promise<ImportCandidate[]> // ordinal csoporton belül, majd hash; 200-as batch Promise.all

export interface ExistingTransaction { id; occurred_at; direction; amount; account_id; category_id; payee; import_hash }
export function findProbableDuplicate(c: ImportCandidate, existing: ExistingTransaction[]): ExistingTransaction | null
// azonos számla, azonos irány + toCents(amount) === amountCents, |dátumkülönbség| <= 1 nap; azonos nap előnyben

export type RowStatus = "new" | "already_imported" | "probable_duplicate"
export interface PreviewRow extends ImportCandidate { status; duplicateOf; suggestedCategoryId: string|null }
export function classifyRows(candidates, knownHashes: Set<string>, existing, payeeIndex: Map<string,string>): PreviewRow[]
```

**Kategóriajavaslat**
- `normalizePayeeKey(s)` — NFD, `/\p{M}/gu` törlés, lowercase, szóközök.
- `buildPayeeCategoryIndex(rows: {direction, payee, category_id}[]): Map<string,string>` — kulcs `${direction}|${normalizePayeeKey(payee)}` → leggyakoribb `category_id`. Az irány a kulcs része, így a DB-trigger (`category.kind = direction`) sosem utasítja el a javaslatot.
- `suggestCategory(direction, description, index)` — pontos kulcs, különben a leghosszabb (≥4 karakteres) indexkulcs, ami részstringje a leírásnak.

### 3. Mapping-memória: `src/lib/import-mapping-storage.ts` (új)

Kulcs `koltsegkoveto-import-mapping-<accountId>` (minta: `src/lib/last-used-account.ts`). `{ version: 1, headers: string[], delimiter, mapping }`. Betöltéskor: ha tárolt van és a `headers` egyezik a fájl fejlécével → változatlanul; különben `guessMapping`, de `dateFormat`/`decimalSeparator` a tároltból előtöltve. Mentés a mapping-lépés elhagyásakor. try/catch minden olvasás/írás körül.

### 4. Query-réteg: `src/lib/queries/csv-import.ts` (új)

Előfeltétel: `export` a `fetchAllPages`-re `src/lib/queries/backup.ts:32`-ben.

- `useImportContext(accountId, range: {from,to} | null)` — `enabled` csak ha van user+account+range. `Promise.all`:
  1. ablak-sorok: `select("id, occurred_at, direction, amount, account_id, category_id, payee, import_hash").eq("account_id", accountId).gte("occurred_at", from−1 nap).lte("occurred_at", to+1 nap)` `fetchAllPages`-szel;
  2. minden ismert hash felhasználó-szinten: `select("import_hash").not("import_hash","is",null)` → `Set<string>` (számlaváltás után is védjen).
  Visszaad `{ existing, knownHashes }`.
- `usePayeeCategoryIndex()` — `select("direction, payee, category_id")` nem-null payee és category, `neq("direction","transfer")`, `fetchAllPages` → `buildPayeeCategoryIndex`. Kulcsát (`["payee-category-index", userId]`) fel kell venni a `transactionRelatedQueryKeys`-be (`src/lib/queries/transactions.ts:39-46`).
- `useImportTransactions()` mutation — bemenet `ImportTransactionInput[]` (`occurred_at, direction, amount = centsToAmount(amountCents), account_id, category_id, payee = description, note, import_hash`); 200-as chunkokban `insert(chunk.map(r => ({...r, user_id})))`, `inserted` számláló; `code === "23505"` → `ImportWriteError("Egy tétel időközben már bekerült (másik eszközről?). Frissítsd az előnézetet és próbáld újra.", inserted)`. `onSettled`: `transactionRelatedQueryKeys` + `["report-transactions", userId]` + import-context kulcs (részleges siker után is frissüljön, mint `useRestoreBackup`).

Adatfolyam: `File` → `arrayBuffer()` → `decodeCsvFile` → `detectDelimiter` → `parseCsv` → tárolt mapping / `guessMapping` → `buildImportRows` → `prepareCandidates` → dátumtartomány → `useImportContext` + `usePayeeCategoryIndex` → `classifyRows` → felhasználói szerkesztés (kijelölés, kategória) → `useImportTransactions`.

### 5. UI

- `src/App.tsx`: `<Route path="/import" element={<ImportPage />} />` a védett layouton belül. Alsó navba **nem** kerül.
- `src/components/settings/data-card.tsx`: negyedik outline gomb (`asChild` + `Link to="/import"`, ikon `FileSpreadsheet`), felirat „Bankkivonat importálása (CSV)”; a bevezető bekezdés és a komponens-doc-comment kiegészítve.
- `src/pages/import-page.tsx` (új) — wizard state: `step: "file"|"mapping"|"preview"|"done"`, `accountId` (init `getLastUsedAccountId()`), `parsed {fileName, encoding, delimiter, table}`, `mapping`, `rows: PreviewRow[]`, `checked: Set<number>`, `categoryOverrides: Map<number, string|null>`, `result`. Vissza-link `/settings`-re (minta `recurring-page.tsx:47-53`), lépésjelző „1/3 Fájl · 2/3 Oszlopok · 3/3 Előnézet”.
- `src/components/import/import-file-step.tsx` — számla-sor → `AccountPickerSheet` (`title="Cél számla"`); rejtett `<input type="file" accept=".csv,text/csv,text/plain">` a data-card resettel; `file.arrayBuffer()`; kiírja „windows-1250 · pontosvessző · 143 sor”; hiba `<p role="alert">`.
- `src/components/import/import-mapping-step.tsx` — mezőnként natív `<select>` (fejlécnevek vagy „1. oszlop”…); toggle-gombpárok: van fejléc, egy/külön összegoszlop, előjel megfordítása, tizedesjel; dátumformátum `<select>`; élő előnézet az első 5 sorból; „3 sor hibás — ezeket kihagyjuk”; „Tovább” csak ≥1 érvényes sornál. Segédszöveg a leírás-select alatt: „Ezt az oszlopot később is ugyanígy válaszd, különben a duplikátumszűrés gyengébb.”
- `src/components/import/import-preview-step.tsx` — számlálók (új / valószínű duplikátum / már importálva / hibás), „Mind” / „Egyik sem”, „Már importáltak mutatása” kapcsoló (alapból rejtve), hibalista („12. sor: érvénytelen összeg”), `ImportRowItem` lista, egy közös `CategoryPickerSheet` (`kind={row.direction}`) `activeRowIndex`-szel; választáskor a többi feloldatlan, azonos `normalizePayeeKey` sorra is alkalmazva („Még 4 hasonló sorra alkalmazva”). `ConfirmDialog` (`destructive={false}`, `confirmLabel="Importálás"`), leírás: „N tétel kerül a(z) X számlára. M tételnek nincs kategóriája — később a Tételek listában megadhatod. Kihagyva: … valószínű duplikátum, … már importált, … hibás sor.” `ImportWriteError` esetén a dialógus nyitva marad, „Hiba: …” hozzáfűzve. 2000 sor felett figyelmeztetés.
- `src/components/import/import-row-item.tsx` — mobil, egymás alatti sorok: (1) natív checkbox `min-h-11` labelben + dátum + előjeles összeg (`formatCentsAsHuf`, `text-expense`/`text-income`); (2) leírás (truncate) + badge `új` / `valószínű duplikátum` (amber, „≈ 2026-09-14 · Lidl”) / `már importálva` (muted, nem választható); (3) kategória-chip gomb („Nincs kategória” vagy név ikonnal).
- Alapértelmezett kijelölés: `new` ✓, `probable_duplicate` ✗, `already_imported` nem választható.
- Kész-lépés: `<p role="status">` „143 tétel importálva, 12 kihagyva.”, gombok „Tételek megtekintése” (`/transactions`) és „Másik fájl”; `setLastUsedAccountId(accountId)`.

### 6. Típus- és plumbing-módosítások

- `src/lib/database.types.ts` (:82-115): `import_hash: string | null` a `Row`-ban, `import_hash?: string | null` az `Insert`-ben.
- `src/lib/backup.ts`: `transactionSchema` + `import_hash: z.string().nullable().optional()`; `BACKUP_VERSION = 2`. `FLAT_CSV_HEADERS` / `buildFlatCsvRows` változatlan.
- `src/lib/queries/backup.ts`: transactions select string (:79) + `import_hash`; `fetchAllPages` exportálva; `useRestoreBackup` transactions-mapelése verziófüggő: `version >= 2` esetén `import_hash: row.import_hash ?? null`, különben a kulcs kihagyva (v1 mentés ne nullázza a meglévő hash-eket; chunkon belül azonos kulcskészlet kell).
- `src/lib/queries/transactions.ts:39-46`: payee-index kulcs hozzáadva.
- `package.json`: `vitest` devDep + `"test": "vitest run"`.

### 7. Spec és README

`koltsegkoveto-specifikacio.md`:
- 22. sor (Adatmigráció cella) kiegészítés: *„Kiegészítés (2026-09): a felhasználó által letöltött bankkivonat (CSV) kézi importja nem adatmigráció, hanem rögzítési mód — lásd 7.3.”*
- §3.3 SQL-blokk: `import_hash text, -- CSV-import ujjlenyomat, kézi tételnél null` + szabály-bullet a részleges unique indexről.
- §5.3 táblázat: új `/import` sor; a `/settings` sorban „bankkivonat importálása (CSV),” beszúrva.
- §7.3: „három műveletet ad” → „négy”; negyedik bullet a teljes működéssel (bármely bank, delimiter/kódolás felismerés, oszlopmegfeleltetés számlánként megjegyezve, `import_hash` szerinti automatikus kihagyás, ±1 napos „valószínű duplikátum” alapból kijelöletlenül, kulcsszavas javaslat — nem AI, csak kiadás/bevétel, átvezetést a felhasználó vesz ki).
- §10 341. sor: *„Ne köss be élő banki adatkapcsolatot (GoCardless, Plaid, open banking API, SMS-parsing). A felhasználó által letöltött kivonatfájl kézi importja (7.3) nem tartozik ide — az megengedett.”* 342. sor: „(a kulcsszavas kategóriajavaslat nem AI)”.

`README.md`: „Export & backup” → „Import, export & backup”, új bullet a CSV importról (auto-detect, per-account mapping, fingerprint + probable-duplicate, keyword suggestion, no live bank connection).

### 8. Tesztek (első tesztfuttató a projektben)

`npm i -D vitest`; `vite.config.ts` tetejére `/// <reference types="vitest/config" />`, `test: { environment: "node", include: ["src/**/*.test.ts"] }`. Node 22 adja a `crypto.subtle`-t és a `TextDecoder("windows-1250")`-et.

`src/lib/csv-import.test.ts` (explicit `import { describe, it, expect } from "vitest"`): `parseCsv` (`;`/`,`, idézett delimiter, `""`, többsoros mező, CRLF/LF, üres sorok); `detectDelimiter`; `decodeCsvFile` (BOM-os/BOM nélküli UTF-8, cp1250 bájtok `"Élelmiszer"`); `parseAmountToCents` (`"1 234,56"`→123456, `"-12 450"`→-1245000, `"12.450,00"`→1245000, `"1,234.56"`/`.`→123456, `"−12 450 HUF"`→-1245000, `"(1 000)"`→-100000, `"12,3456"`→null, `"abc"`→null); split terhelés/jóváírás `buildImportRows`-on át; `parseDateToIso` minden formátum + `"2026.09.18."` + datetime-token; `computeImportHash` stabilitás/ordinal/case; `prepareCandidates` ordinal 0 és 1; `findProbableDuplicate` (aznap, ±1, 2 nap nem, más számla nem, más irány nem); `suggestCategory` (pontos, részstring `"LIDL HU 1234 BUDAPEST"` ↔ `"lidl"`, iránytévesztés nem).

## Megvalósítási sorrend

1. Migráció + `full-schema.sql` + `database.types.ts` (build zöld marad).
2. Backup-plumbing (`backup.ts` séma/verzió, `queries/backup.ts` select/restore, `fetchAllPages` export).
3. `csv-import.ts` + `import-mapping-storage.ts`, majd vitest + tesztek (tiszta kód, UI nélkül ellenőrizhető).
4. `queries/csv-import.ts` + `transactionRelatedQueryKeys` bővítés.
5. UI: oldal, három lépés-komponens, sor-elem, route, DataCard gomb.
6. Spec + README.
7. Végponttól végpontig ellenőrzés.

## Ellenőrzés

1. Migráció futtatása Supabase SQL editorban vagy `supabase db push`; `import_hash` oszlop és `transactions_user_import_hash_uidx` látszik.
2. `npm run lint`, `npm run build` (a tsc elkapja a select-string/típus eltéréseket), `npm test`.
3. Fixture-ök a scratchpadban (`C:\Users\nemet\AppData\Local\Temp\claude\d--CODE-budget-tracker-2026\b25ebb64-7495-4c28-b136-88080bc976fa\scratchpad`):
   - `otp-like.csv` windows-1250, `;` (PowerShell: `[IO.File]::WriteAllBytes(path, [Text.Encoding]::GetEncoding(1250).GetBytes($text))`):
     ```
     Könyvelés dátuma;Értéknap;Terhelés;Jóváírás;Partner neve;Közlemény
     2026.09.15.;2026.09.15.;12 450;;LIDL ÁRUHÁZ BUDAPEST;Kártyás vásárlás
     2026.09.15.;2026.09.15.;12 450;;LIDL ÁRUHÁZ BUDAPEST;Kártyás vásárlás
     2026.09.16.;2026.09.16.;;450 000;MUNKÁLTATÓ KFT;Munkabér 2026/09
     2026.09.17.;2026.09.17.;3 990,00;;NETFLIX;Előfizetés "havi"
     ```
   - `revolut-like.csv` UTF-8 BOM nélkül, `,`:
     ```
     Type,Product,Started Date,Completed Date,Description,Amount,Fee,Currency,State,Balance
     CARD_PAYMENT,Current,2026-09-14 09:12:03,2026-09-15 10:22:31,Bolt.eu,-3490.00,0.00,HUF,COMPLETED,120500.00
     TOPUP,Current,2026-09-16 08:00:00,2026-09-16 08:00:01,"Top-up, from card",50000.00,0.00,HUF,COMPLETED,170500.00
     CARD_PAYMENT,Current,2026-09-18 07:40:00,,Spar,-1250.00,0.00,HUF,PENDING,169250.00
     ```
4. Kézi folyamat (`npm run dev`): Beállítások → Adataid → „Bankkivonat importálása (CSV)” → számla → `otp-like.csv`: „windows-1250 · pontosvessző”, split mapping és `yyyy.MM.dd.` kitalálva, 4 `új` sor (a két Lidl az ordinal miatt mindkettő), Netflix `-3 990 Ft`. Import → 4 beszúrva; Tételek listában „Nincs kategória” ahol nincs javaslat.
5. Ugyanaz a fájl újra → 4 × `már importálva`, 0 választható, megerősítés tiltva.
6. Kézzel 12 450 Ft kiadás 2026-09-14-re ugyanarra a számlára, majd módosított másolat (más leírás, 09-15) importja → `valószínű duplikátum`, kijelöletlen; bejelölve importálható.
7. `revolut-like.csv`: utf-8, `,`, egy összegoszlop, „Completed Date” datetime első-token fallbackkal; a PENDING sor üres dátuma → hibás sor, listázva és kihagyva; a vesszős idézett leírás ép marad.
8. Egy Lidl sor kategorizálása a szerkesztő sheetben → új importban „LIDL HU 4471” javaslatot kap.
9. Backup: a JSON tartalmazza az `import_hash`-t; régi v1 mentés visszaállítása nem nullázza a meglévő hash-eket; v2 mentés friss projektbe → ugyanazon kivonat újraimportja 0 új sort ad.
10. Két lap egyszerre importálja ugyanazt → a második 23505-üzenetet kap, listák frissülnek, nincs duplikátum.

## Kockázatok, szélső esetek

- **Pending → booked** sorok: dátum és szöveg változhat; a hash nem talál, a ±1 napos heurisztika elkapja, ha az összeg azonos. Üres dátum → hibás sor. „Állapot-oszlop szűrő” v1.1 jelölt.
- **Ordinal részleges átfedésnél**: ha egy későbbi export ugyanazt a napot más ablakkal fedi (az egyik kávé kiesik), a jelen lévő sorok ordinálja 0-tól indul, a második kávé `már importálva` lehet. Elfogadott kompromisszum; az alternatíva (ordinal nélkül) minden azonos sort összevonna, ami rosszabb.
- **Hash-stabilitás mapping-váltáskor**: a hash a parse-olt értékekből készül; ha a leírás-oszlop változik (Partner → Közlemény), a hash nem talál, csak a heurisztika. UI-segédszöveg kezeli.
- **Átvezetések**: kiadás/bevételként jelennek meg; v1-ben kivéve az előnézetben. Spec és help-szöveg mondja.
- **Nagy fájl**: figyelmeztetés 2000 sor felett; hash-számítás 200-as batchekben.
- **Chunk részleges hiba**: korábbi chunkok maradnak; `ImportWriteError.inserted` látszik, `onSettled` invalidál.
- **v2 backup restore meglévő adatokra**, ahol azonos hash más `id`-vel már létezik → 23505; a restore-hiba a dialógusban marad (meglévő viselkedés).
