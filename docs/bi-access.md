# BI hozzáférés

Az adatbázis kívülről, programozottan elérhető, hogy egy BI eszköz (Power BI,
Looker Studio, Metabase, Grafana...) riportot tudjon építeni rá. Három út van
erre — az első a fő út, a másik kettő tartalék/kiegészítés.

Az itt leírt `v_*` nézetek és a `bi_reader` szerepkör a
[`20260903100001_bi_views_and_reader_role.sql`](../supabase/migrations/20260903100001_bi_views_and_reader_role.sql)
migrációban jönnek létre.

> **A nézetek a BI szerződéses felülete.** Ha később változtatod a nyers
> táblák szerkezetét, a nézetek maradjanak stabilak (oszlopnevek, típusok),
> hogy a kint futó riportok ne törjenek el.

---

## 1. Közvetlen Postgres kapcsolat (fő út — ezt használja a Power BI és a Looker Studio is)

### 1.1 A `bi_reader` szerepkör beüzemelése

A migráció létrehozza a `bi_reader` szerepkört jelszó **nélkül** (nincs titok a
git repóban). Első használat előtt, a Supabase Dashboard → **SQL Editor**-ban
fusd le:

```sql
alter role bi_reader with password 'ide-egy-hosszú-random-jelszó';
```

A szerepkörnek csak `SELECT` joga van a négy `v_*` nézetre és a nyers
táblákra — `INSERT/UPDATE/DELETE`-et bármelyik táblán megkísérelve hibára
fut. RLS nem érvényesül rá (`BYPASSRLS`), mert egy direkt Postgres
kapcsolatnak nincs Supabase Auth JWT-je / `auth.uid()`-ja — enélkül egyetlen
sort sem látna. Mivel az appnak egyetlen felhasználója van, ez szándékos és
biztonságos: a `bi_reader` mindent lát, de semmit nem tud módosítani.

**Jelszórotálás**: bármikor futtatható ugyanaz az `alter role` parancs új
jelszóval — a régi azonnal érvénytelenné válik, a BI eszközben csak a
mentett jelszót kell frissíteni.

### 1.2 Kapcsolódási adatok

Supabase Dashboard → **Project Settings → Database → Connection pooling**.

A **direkt kapcsolat** (`db.<project-ref>.supabase.co:5432`) csak IPv6-on
érhető el, hacsak nincs előfizetve az IPv4 add-on — a legtöbb BI eszköz
(köztük a Looker Studio Google-szerverei) viszont IPv4-ről csatlakozik.
Ezért **a connection poolert (Supavisor) használd, Session módban**:

| Mező | Érték |
|---|---|
| Host | `aws-0-<régió>.pooler.supabase.com` |
| Port | `5432` (Session mode — ne a 6543-as Transaction módot, az nem támogatja jól a séma-introspekciót) |
| Database | `postgres` |
| User | `bi_reader.<project-ref>` (poolernél a user mindig `<role>.<project-ref>` alakú) |
| Password | az 1.1-ben beállított jelszó |
| SSL | kötelező |

A pontos hosztnevet és project-ref-et a Dashboard **Connection pooling**
paneljén találod (ott a `postgres` userre van kiírva a stringje — csak a
usernevet cseréld `bi_reader.<project-ref>`-re).

### 1.3 Looker Studio beállítása

1. [lookerstudio.google.com](https://lookerstudio.google.com) → **Create → Data source**
2. Connector: **PostgreSQL**
3. Host / Port / Database / User / Password: az 1.2 táblázat szerint
4. **SSL mode: Require**
5. Válaszd ki a `v_transactions_flat` (és a többi `v_*`) nézetet táblaként,
   vagy adj meg egyedi SQL-t
6. Csatlakoztasd a data source-t egy riporthoz

Power BI / Metabase esetén ugyanezek az adatok kellenek, csak más
felületen add meg őket (Power BI: **Get Data → PostgreSQL database**).

---

## 2. REST API (PostgREST)

A Supabase automatikusan publikálja a táblákat és nézeteket REST végponton
is — ez akkor hasznos, ha egy eszköz nem tud natív Postgres-kapcsolatot
nyitni, csak HTTP-t beszél.

```
GET https://<project-ref>.supabase.co/rest/v1/v_transactions_flat?occurred_at=gte.2026-01-01
```

Fejlécek:

```
apikey: <kulcs>
Authorization: Bearer <kulcs>
```

- Szűrés: `?occurred_at=gte.2026-01-01&direction=eq.expense`
- Rendezés: `?order=occurred_at.desc`
- Lapozás: `Range: 0-99` header, vagy `?limit=100&offset=0`

**Melyik kulcsot hol:**
- Az **`anon`** kulcs csak `authenticated` sessionnel (bejelentkezett userrel)
  ad vissza adatot, mert a nézetek `security_invoker = true` miatt az RLS
  érvényesül rajtuk — ez az, amit a frontend használ, böngészőben biztonságos.
- A **`service_role`** kulcs megkerüli az RLS-t, mindent lát. **Kizárólag**
  szerveroldali vagy asztali BI eszközbe kerülhet (pl. egy backend job
  Authorization headerébe) — **böngészőbe soha**, és git-be soha.

Ehhez a use case-hez (BI eszköz, IP-fehérlistázás nélkül, sok lekérdezés) a
fenti 1. pontban leírt direkt Postgres-kapcsolat + `bi_reader` az ajánlott
út — a REST API inkább kiegészítő/automatizálási célra van.

---

## 3. CSV export

Minden riport képernyőn van egy „Adatok CSV-be" gomb, ami a teljes
tranzakciótörténetet exportálja a `v_transactions_flat` nézet szerkezetében,
UTF-8 BOM-mal (hogy Excelben ne romoljanak el az ékezetek) és ISO
dátumformátummal (`YYYY-MM-DD`).

---

## 4. A nézetek

### `v_transactions_flat`

Denormalizált fő nézet, **egy sor = egy tranzakció**.

| Oszlop | Típus | Leírás |
|---|---|---|
| `id` | uuid | Tranzakció azonosítója |
| `occurred_at` | date | Tranzakció dátuma |
| `year`, `month` | int | `occurred_at` évre/hónapra bontva, gyors csoportosításhoz |
| `direction` | text | `expense` / `income` / `transfer` |
| `amount` | numeric | Mindig pozitív |
| `signed_amount` | numeric | Kiadásnál negatív, bevételnél pozitív, átvezetésnél `0` |
| `account_name` | text | Forrásszámla neve |
| `account_type` | text | `cash` / `bank` / `card` / `savings` / `credit` / `other` |
| `to_account_name` | text | Csak átvezetésnél kitöltött, a cél számla neve |
| `category_name` | text | Alkategória neve (vagy főkategória, ha nincs alkategória) |
| `parent_category_name` | text | Főkategória neve, ha a tranzakció alkategóriára van könyvelve |
| `category_path` | text | `"Főkategória › Alkategória"`, vagy csak a kategórianév; `null` átvezetésnél |
| `payee` | text | Kedvezményezett/partner szabadszöveg |
| `note` | text | Megjegyzés |
| `created_at` | timestamptz | Rögzítés időpontja |

### `v_account_balances`

Számlánként egy sor.

| Oszlop | Leírás |
|---|---|
| `account_id`, `account_name`, `account_type`, `currency`, `is_archived` | Számla adatai |
| `opening_balance` | Nyitóegyenleg |
| `income_total` | Az adott számlára könyvelt bevételek összege |
| `expense_total` | Az adott számláról könyvelt kiadások összege |
| `transfer_out_total` | Erről a számláról induló átvezetések összege |
| `transfer_in_total` | Erre a számlára érkező átvezetések összege |
| `current_balance` | `opening_balance + income - expense - transfer_out + transfer_in` |

### `v_monthly_category_totals`

Hónap × kategória × alkategória bontású összegek (csak `expense`/`income`,
átvezetés nélkül).

| Oszlop | Leírás |
|---|---|
| `year`, `month` | Időszak |
| `direction` | `expense` / `income` |
| `category_id`, `category_name` | Mindig a **főkategória** |
| `subcategory_id`, `subcategory_name` | Kitöltve, ha a tranzakció alkategóriára ment; egyébként `null` |
| `total_amount` | Összeg |
| `transaction_count` | Tranzakciók száma a csoportban |

### `v_budget_status`

Az **aktuális naptári hónap** budget-állapota, soronként egy budget.

| Oszlop | Leírás |
|---|---|
| `budget_id`, `category_id`, `category_name` | Budget és a hozzá tartozó főkategória |
| `month_start` | Az aktuális hónap első napja |
| `budget_amount` | A keret összege |
| `spent_amount` | A hónapban eddig elköltött összeg ebben a kategóriában |
| `remaining_amount` | `budget_amount - spent_amount` (lehet negatív, ha túllépték) |
| `utilization_pct` | Kihasználtság százalékban, kerekítve 1 tizedesre |

---

## 5. Példa lekérdezések

Havi kiadás/bevétel/egyenleg trend:

```sql
select year, month, direction, sum(signed_amount) as total
from v_transactions_flat
where direction in ('expense', 'income')
group by year, month, direction
order by year, month;
```

Top 10 kategória az elmúlt 12 hónapban:

```sql
select category_name, sum(total_amount) as total
from v_monthly_category_totals
where direction = 'expense'
  and make_date(year, month, 1) >= date_trunc('month', current_date) - interval '11 months'
group by category_name
order by total desc
limit 10;
```

Összvagyon (minden nem archivált számla aktuális egyenlegének összege):

```sql
select sum(current_balance) as net_worth
from v_account_balances
where not is_archived;
```
