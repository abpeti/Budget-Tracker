# Budget Tracker

A single-user, personal budget tracking PWA. Fast, numpad-based
transaction entry, account and category management, reports — optimized
for mobile, installable on your phone as an app.

Detailed product specification (in Hungarian): [koltsegkoveto-specifikacio.md](./koltsegkoveto-specifikacio.md).

## Screens

| Quick Entry | Transactions | Reports | Settings |
|:---:|:---:|:---:|:---:|
| <img src="docs/screenshots/quick-entry-light.png" width="200" alt="Quick Entry"> | <img src="docs/screenshots/transactions-light.png" width="200" alt="Transactions"> | <img src="docs/screenshots/reports-light.png" width="200" alt="Reports"> | <img src="docs/screenshots/settings-light.png" width="200" alt="Settings"> |
| <img src="docs/screenshots/quick-entry-dark.png" width="200" alt="Quick Entry – dark mode"> | <img src="docs/screenshots/transactions-dark.png" width="200" alt="Transactions – dark mode"> | <img src="docs/screenshots/reports-dark.png" width="200" alt="Reports – dark mode"> | <img src="docs/screenshots/settings-dark.png" width="200" alt="Settings – dark mode"> |

## Export & backup

Your data is never locked in. Settings → "Adataid" offers:

- **All transactions as CSV** — the full history in the `v_transactions_flat`
  shape (names instead of ids, signed amounts, category path), UTF-8 BOM so
  Excel and Google Sheets open it correctly.
- **Full backup as JSON** — every table (accounts, categories, recurring
  rules, transactions, budgets) with original ids, lossless.
- **Restore from backup** — pick a JSON backup; rows are merged by id (existing
  rows with the same id are overwritten, everything else is kept, nothing is
  deleted). Works for undoing an accidental delete or moving to a fresh
  Supabase project. Database triggers still validate every row.

Every report screen also has its own "Adatok CSV-be" button for the selected
period.

## Tech Stack

React 19 + TypeScript + Vite · Tailwind CSS v4 · shadcn/ui · React Router
· Supabase (Postgres + Auth, Row Level Security) · TanStack Query ·
react-hook-form + zod · date-fns · vite-plugin-pwa.
