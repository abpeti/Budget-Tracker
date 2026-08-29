# Költségkövető

Egyfelhasználós, személyes költségkövető PWA. Gyors, numpad-alapú
tranzakció-rögzítés, számla- és kategóriakezelés, riportok — mobilra
optimalizálva, telefonra telepíthető alkalmazásként is.

Részletes termékspecifikáció: [koltsegkoveto-specifikacio.md](./koltsegkoveto-specifikacio.md).

## Képernyők

| Gyorsrögzítés | Tranzakciók | Riportok |
|---|---|---|
| ![Gyorsrögzítés](docs/screenshots/quick-entry.png) | ![Tranzakciók](docs/screenshots/transactions.png) | ![Riportok](docs/screenshots/reports.png) |

| Számlák | Kategóriák | Beállítások |
|---|---|---|
| ![Számlák](docs/screenshots/accounts.png) | ![Kategóriák](docs/screenshots/categories.png) | ![Beállítások](docs/screenshots/settings.png) |

## Technológia

React 19 + TypeScript + Vite · Tailwind CSS v4 · shadcn/ui · React Router
· Supabase (Postgres + Auth, Row Level Security) · TanStack Query ·
react-hook-form + zod · date-fns · vite-plugin-pwa.

