import { endOfMonth, endOfYear, format, startOfMonth, startOfYear, subMonths } from "date-fns"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { useAccounts } from "@/lib/queries/accounts"
import { useCategories } from "@/lib/queries/categories"
import type { TransactionDirection } from "@/lib/database.types"
import type { TransactionFilters } from "@/lib/queries/transactions"
import { cn } from "@/lib/utils"

const fmt = (d: Date) => format(d, "yyyy-MM-dd")

type Period = "this-month" | "last-month" | "this-year" | "all"

const PERIODS: { value: Period; label: string; range: () => { from?: string; to?: string } }[] = [
  {
    value: "this-month",
    label: "Ez a hónap",
    range: () => ({ from: fmt(startOfMonth(new Date())), to: fmt(endOfMonth(new Date())) }),
  },
  {
    value: "last-month",
    label: "Előző hónap",
    range: () => {
      const prev = subMonths(new Date(), 1)
      return { from: fmt(startOfMonth(prev)), to: fmt(endOfMonth(prev)) }
    },
  },
  {
    value: "this-year",
    label: "Ez az év",
    range: () => ({ from: fmt(startOfYear(new Date())), to: fmt(endOfYear(new Date())) }),
  },
  { value: "all", label: "Mind", range: () => ({ from: undefined, to: undefined }) },
]

const DIRECTIONS: { value: TransactionDirection | null; label: string }[] = [
  { value: null, label: "Mind" },
  { value: "expense", label: "Kiadás" },
  { value: "income", label: "Bevétel" },
  { value: "transfer", label: "Átvezetés" },
]

interface TransactionFilterSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  filters: TransactionFilters
  onChange: (filters: TransactionFilters) => void
}

export function TransactionFilterSheet({
  open,
  onOpenChange,
  filters,
  onChange,
}: TransactionFilterSheetProps) {
  const { data: accounts } = useAccounts()
  const { data: categories } = useCategories()

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Szűrők</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-4 overflow-y-auto px-4 pb-6">
          <div className="flex flex-col gap-2">
            <Label>Időszak</Label>
            <div className="flex flex-wrap gap-2">
              {PERIODS.map((p) => {
                const range = p.range()
                const active = filters.from === range.from && filters.to === range.to
                return (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => onChange({ ...filters, ...range })}
                    className={cn(
                      "min-h-9 rounded-full border px-3 text-sm",
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-secondary text-secondary-foreground"
                    )}
                  >
                    {p.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Irány</Label>
            <div className="flex flex-wrap gap-2">
              {DIRECTIONS.map((d) => (
                <button
                  key={d.label}
                  type="button"
                  onClick={() => onChange({ ...filters, direction: d.value })}
                  className={cn(
                    "min-h-9 rounded-full border px-3 text-sm",
                    filters.direction === d.value
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-secondary text-secondary-foreground"
                  )}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="filter-account">Számla</Label>
            <select
              id="filter-account"
              value={filters.accountId ?? ""}
              onChange={(e) => onChange({ ...filters, accountId: e.target.value || null })}
              className="h-12 w-full rounded-md border border-input bg-transparent px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <option value="">Mind</option>
              {accounts?.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="filter-category">Kategória</Label>
            <select
              id="filter-category"
              value={filters.categoryId ?? ""}
              onChange={(e) => onChange({ ...filters, categoryId: e.target.value || null })}
              className="h-12 w-full rounded-md border border-input bg-transparent px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <option value="">Mind</option>
              {categories?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.parent_id ? `— ${c.name}` : c.name}
                </option>
              ))}
            </select>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={() =>
              onChange({ from: undefined, to: undefined, direction: null, accountId: null, categoryId: null, search: filters.search })
            }
          >
            Szűrők törlése
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
