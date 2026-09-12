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

## Tech Stack

React 19 + TypeScript + Vite · Tailwind CSS v4 · shadcn/ui · React Router
· Supabase (Postgres + Auth, Row Level Security) · TanStack Query ·
react-hook-form + zod · date-fns · vite-plugin-pwa.
