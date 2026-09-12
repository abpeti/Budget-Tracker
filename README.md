# Költségkövető

Egyfelhasználós, személyes költségkövető PWA. Gyors, numpad-alapú
tranzakció-rögzítés, számla- és kategóriakezelés, riportok — mobilra
optimalizálva, telefonra telepíthető alkalmazásként is.

Részletes termékspecifikáció: [koltsegkoveto-specifikacio.md](./koltsegkoveto-specifikacio.md).

## Képernyők

| Gyorsrögzítés | Tételek | Riportok | Beállítások |
|---|---|---|---|
| ![Gyorsrögzítés](docs/screenshots/quick-entry-light.png) | ![Tételek](docs/screenshots/transactions-light.png) | ![Riportok](docs/screenshots/reports-light.png) | ![Beállítások](docs/screenshots/settings-light.png) |
| ![Gyorsrögzítés – sötét mód](docs/screenshots/quick-entry-dark.png) | ![Tételek – sötét mód](docs/screenshots/transactions-dark.png) | ![Riportok – sötét mód](docs/screenshots/reports-dark.png) | ![Beállítások – sötét mód](docs/screenshots/settings-dark.png) |

## Technológia

React 19 + TypeScript + Vite · Tailwind CSS v4 · shadcn/ui · React Router
· Supabase (Postgres + Auth, Row Level Security) · TanStack Query ·
react-hook-form + zod · date-fns · vite-plugin-pwa.

