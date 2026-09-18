import { NavLink } from "react-router-dom"
import { PlusCircle, List, Landmark, PieChart, Settings } from "lucide-react"
import { cn } from "@/lib/utils"

const NAV_ITEMS = [
  { to: "/", label: "Rögzítés", icon: PlusCircle, end: true },
  { to: "/transactions", label: "Tételek", icon: List, end: false },
  { to: "/accounts", label: "Számlák", icon: Landmark, end: false },
  { to: "/reports", label: "Riportok", icon: PieChart, end: false },
  { to: "/settings", label: "Beállítások", icon: Settings, end: false },
] as const

export function BottomNav() {
  return (
    <nav
      aria-label="Fő navigáció"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur supports-backdrop-filter:bg-card/80"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-around">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "flex min-h-12 flex-col items-center justify-center gap-0.5 px-1 py-2 text-[11px] font-medium whitespace-nowrap transition-colors",
                  isActive
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )
              }
            >
              <Icon className="size-5" aria-hidden="true" />
              <span>{label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
