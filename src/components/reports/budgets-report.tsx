import { useMemo, useState } from "react"
import { endOfMonth, format, startOfMonth } from "date-fns"
import { Plus } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { CsvExportButton } from "@/components/reports/csv-export-button"
import { BudgetFormSheet } from "@/components/budgets/budget-form-sheet"
import { useBudgets, isBudgetActiveOn, type Budget } from "@/lib/queries/budgets"
import { useReportTransactions } from "@/lib/queries/reports"
import { useCategories } from "@/lib/queries/categories"
import { formatCentsAsHuf, toCents } from "@/lib/money"
import { cn } from "@/lib/utils"

export function BudgetsReport() {
  const [formOpen, setFormOpen] = useState(false)
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null)

  const { data: budgets } = useBudgets()
  const { data: transactions } = useReportTransactions()
  const { data: categories } = useCategories()

  const categoryMap = useMemo(() => new Map((categories ?? []).map((c) => [c.id, c])), [categories])

  const today = new Date()
  const monthFrom = format(startOfMonth(today), "yyyy-MM-dd")
  const monthTo = format(endOfMonth(today), "yyyy-MM-dd")
  const todayIso = format(today, "yyyy-MM-dd")

  const rows = useMemo(() => {
    const active = (budgets ?? []).filter((b) => isBudgetActiveOn(b, todayIso))
    return active.map((budget) => {
      const category = categoryMap.get(budget.category_id)
      const childIds = new Set(
        (categories ?? []).filter((c) => c.parent_id === budget.category_id).map((c) => c.id)
      )
      let spentCents = 0
      for (const tx of transactions ?? []) {
        if (tx.direction !== "expense") continue
        if (tx.occurred_at < monthFrom || tx.occurred_at > monthTo) continue
        if (tx.category_id !== budget.category_id && !(tx.category_id && childIds.has(tx.category_id)))
          continue
        spentCents += toCents(tx.amount)
      }
      const budgetCents = toCents(budget.amount)
      const percent = budgetCents > 0 ? (spentCents / budgetCents) * 100 : 0
      return { budget, category, spentCents, budgetCents, percent }
    })
  }, [budgets, transactions, categories, categoryMap, todayIso, monthFrom, monthTo])

  const csvRows = rows.map((r) => [
    r.category?.name ?? "",
    Math.trunc(r.budgetCents / 100),
    Math.trunc(r.spentCents / 100),
    Math.trunc((r.budgetCents - r.spentCents) / 100),
    Math.round(r.percent),
  ])

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-muted-foreground">Mindig a jelenlegi hónap ({format(today, "yyyy. MMMM")})</p>

      <Button
        type="button"
        variant="outline"
        onClick={() => {
          setEditingBudget(null)
          setFormOpen(true)
        }}
        className="self-start"
      >
        <Plus className="size-4" />
        Új keret
      </Button>

      {rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Nincs beállított keret erre a hónapra.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map(({ budget, category, spentCents, budgetCents, percent }) => {
            const overspent = spentCents > budgetCents
            return (
              <button
                key={budget.id}
                type="button"
                onClick={() => {
                  setEditingBudget(budget)
                  setFormOpen(true)
                }}
                className="text-left"
              >
                <Card className="gap-2 p-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{category?.name ?? "Ismeretlen kategória"}</span>
                    <span
                      className={cn("tabular-nums", overspent ? "text-destructive" : "text-muted-foreground")}
                    >
                      {formatCentsAsHuf(spentCents)} / {formatCentsAsHuf(budgetCents)}
                    </span>
                  </div>
                  <Progress
                    value={Math.min(100, percent)}
                    indicatorClassName={overspent ? "bg-destructive" : "bg-expense"}
                  />
                  {overspent && (
                    <p className="text-xs text-destructive">
                      {Math.round(percent)}% — túllépve {formatCentsAsHuf(spentCents - budgetCents)}-tal
                    </p>
                  )}
                </Card>
              </button>
            )
          })}
        </div>
      )}

      <CsvExportButton
        filename="keretek.csv"
        headers={["category", "budget_amount", "spent", "remaining", "usage_percent"]}
        rows={csvRows}
      />

      <BudgetFormSheet open={formOpen} onOpenChange={setFormOpen} budget={editingBudget} />
    </div>
  )
}
