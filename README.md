# Költségkövető

Egyfelhasználós, személyes költségkövető PWA. Gyors, numpad-alapú
tranzakció-rögzítés, számla- és kategóriakezelés, riportok — mobilra
optimalizálva, telefonra telepíthető alkalmazásként is.

Részletes termékspecifikáció: [koltsegkoveto-specifikacio.md](./koltsegkoveto-specifikacio.md).

## Képernyők

| Gyorsrögzítés | Tételek | Riportok | Beállítások |
|:---:|:---:|:---:|:---:|
| <img src="docs/screenshots/quick-entry-light.png" width="200" alt="Gyorsrögzítés"> | <img src="docs/screenshots/transactions-light.png" width="200" alt="Tételek"> | <img src="docs/screenshots/reports-light.png" width="200" alt="Riportok"> | <img src="docs/screenshots/settings-light.png" width="200" alt="Beállítások"> |
| <img src="docs/screenshots/quick-entry-dark.png" width="200" alt="Gyorsrögzítés – sötét mód"> | <img src="docs/screenshots/transactions-dark.png" width="200" alt="Tételek – sötét mód"> | <img src="docs/screenshots/reports-dark.png" width="200" alt="Riportok – sötét mód"> | <img src="docs/screenshots/settings-dark.png" width="200" alt="Beállítások – sötét mód"> |

## Technológia

React 19 + TypeScript + Vite · Tailwind CSS v4 · shadcn/ui · React Router
· Supabase (Postgres + Auth, Row Level Security) · TanStack Query ·
react-hook-form + zod · date-fns · vite-plugin-pwa.

