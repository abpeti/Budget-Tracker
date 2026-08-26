import { useEffect, useState } from "react"
import { format, startOfMonth } from "date-fns"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { useCreateBudget, useUpdateBudget, useDeleteBudget, type Budget } from "@/lib/queries/budgets"
import { useCategoryTree } from "@/lib/queries/categories"

interface BudgetFormSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  budget?: Budget | null
}

export function BudgetFormSheet({ open, onOpenChange, budget }: BudgetFormSheetProps) {
  const isEdit = !!budget
  const { tree: mainExpenseCategories } = useCategoryTree("expense")
  const createBudget = useCreateBudget()
  const updateBudget = useUpdateBudget()
  const deleteBudget = useDeleteBudget()

  const [categoryId, setCategoryId] = useState("")
  const [amount, setAmount] = useState("")
  const [validFrom, setValidFrom] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"))
  const [validTo, setValidTo] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (open) {
      setCategoryId(budget?.category_id ?? "")
      setAmount(budget ? String(budget.amount) : "")
      setValidFrom(budget?.valid_from ?? format(startOfMonth(new Date()), "yyyy-MM-dd"))
      setValidTo(budget?.valid_to ?? "")
      setError(null)
    }
  }, [open, budget])

  // Ha nincs kiválasztott kategória (új keretnél), essünk vissza az első elérhető
  // fő kiadási kategóriára — külön a nyitó-effekttől, hogy a lista frissülése
  // (pl. háttér-refetch) ne törölje a felhasználó közben tett választását.
  const effectiveCategoryId = categoryId || mainExpenseCategories[0]?.id || ""

  const saving = createBudget.isPending || updateBudget.isPending

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!effectiveCategoryId) {
      setError("Válassz kategóriát.")
      return
    }
    const parsedAmount = Number(amount.replace(",", "."))
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError("Érvénytelen összeg.")
      return
    }

    try {
      if (isEdit) {
        await updateBudget.mutateAsync({
          id: budget.id,
          category_id: effectiveCategoryId,
          amount: parsedAmount,
          valid_from: validFrom,
          valid_to: validTo || null,
        })
      } else {
        await createBudget.mutateAsync({
          category_id: effectiveCategoryId,
          amount: parsedAmount,
          valid_from: validFrom,
          valid_to: validTo || null,
        })
      }
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ismeretlen hiba történt.")
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{isEdit ? "Keret szerkesztése" : "Új keret"}</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 overflow-y-auto px-4 pb-6">
          <div className="flex flex-col gap-2">
            <Label htmlFor="budget-category">Kategória</Label>
            <select
              id="budget-category"
              value={effectiveCategoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="h-12 w-full rounded-md border border-input bg-transparent px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              {mainExpenseCategories.length === 0 && <option value="">Nincs elérhető kategória</option>}
              {mainExpenseCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="budget-amount">Havi keret (Ft)</Label>
            <Input
              id="budget-amount"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="pl. 50000"
            />
          </div>

          <div className="flex gap-2">
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="budget-valid-from">Érvényes ettől</Label>
              <input
                id="budget-valid-from"
                type="date"
                value={validFrom}
                onChange={(e) => setValidFrom(e.target.value)}
                className="h-12 w-full rounded-md border border-input bg-transparent px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
              />
            </div>
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="budget-valid-to">Eddig (opcionális)</Label>
              <input
                id="budget-valid-to"
                type="date"
                value={validTo}
                onChange={(e) => setValidTo(e.target.value)}
                className="h-12 w-full rounded-md border border-input bg-transparent px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
              />
            </div>
          </div>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <Button type="submit" size="lg" disabled={saving}>
            {saving ? "Mentés…" : "Mentés"}
          </Button>

          {isEdit && (
            <Button type="button" variant="outline" onClick={() => setConfirmDelete(true)}>
              Keret törlése
            </Button>
          )}
        </form>
      </SheetContent>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Keret törlése"
        description="Ez a művelet nem vonható vissza."
        onConfirm={async () => {
          if (!budget) return
          await deleteBudget.mutateAsync(budget.id)
          setConfirmDelete(false)
          onOpenChange(false)
        }}
      />
    </Sheet>
  )
}
