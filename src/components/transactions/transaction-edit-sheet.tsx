import { useEffect, useState } from "react"
import { format } from "date-fns"
import { hu } from "date-fns/locale"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { CategoryPickerSheet } from "@/components/quick-entry/category-picker-sheet"
import { AccountPickerSheet } from "@/components/quick-entry/account-picker-sheet"
import { DatePickerSheet } from "@/components/quick-entry/date-picker-sheet"
import { useAccounts } from "@/lib/queries/accounts"
import { useCategories, type Category } from "@/lib/queries/categories"
import { useUpdateTransaction, useDeleteTransaction, type Transaction } from "@/lib/queries/transactions"
import { centsToAmount, formatCentsAsHuf, parseAmountInputToCents } from "@/lib/money"

interface TransactionEditSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  transaction: Transaction | null
}

const DIRECTION_LABEL: Record<Transaction["direction"], string> = {
  expense: "Kiadás",
  income: "Bevétel",
  transfer: "Átvezetés",
}

export function TransactionEditSheet({ open, onOpenChange, transaction }: TransactionEditSheetProps) {
  const { data: accounts } = useAccounts()
  const { data: categories } = useCategories()
  const updateTransaction = useUpdateTransaction()
  const deleteTransaction = useDeleteTransaction()

  const [amountText, setAmountText] = useState("0")
  const [accountId, setAccountId] = useState<string | null>(null)
  const [toAccountId, setToAccountId] = useState<string | null>(null)
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [occurredAt, setOccurredAt] = useState(() => format(new Date(), "yyyy-MM-dd"))
  const [payee, setPayee] = useState("")
  const [note, setNote] = useState("")
  const [error, setError] = useState<string | null>(null)

  const [categorySheetOpen, setCategorySheetOpen] = useState(false)
  const [accountSheetOpen, setAccountSheetOpen] = useState(false)
  const [toAccountSheetOpen, setToAccountSheetOpen] = useState(false)
  const [dateSheetOpen, setDateSheetOpen] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => {
    if (open && transaction) {
      setAmountText(String(transaction.amount))
      setAccountId(transaction.account_id)
      setToAccountId(transaction.to_account_id)
      setCategoryId(transaction.category_id)
      setOccurredAt(transaction.occurred_at)
      setPayee(transaction.payee ?? "")
      setNote(transaction.note ?? "")
      setError(null)
    }
  }, [open, transaction])

  if (!transaction) return null

  const account = accounts?.find((a) => a.id === accountId) ?? null
  const toAccount = accounts?.find((a) => a.id === toAccountId) ?? null
  const category = categories?.find((c) => c.id === categoryId) ?? null
  const categoryMap = new Map((categories ?? []).map((c) => [c.id, c]))
  const categoryLabel = (cat: Category) =>
    cat.parent_id ? `${categoryMap.get(cat.parent_id)?.name ?? ""} › ${cat.name}` : cat.name

  const handleSave = async () => {
    const cents = parseAmountInputToCents(amountText.replace(",", "."))
    if (cents <= 0) {
      setError("Adj meg egy összeget.")
      return
    }
    if (!accountId) {
      setError("Válassz számlát.")
      return
    }
    if (transaction.direction === "transfer" && (!toAccountId || toAccountId === accountId)) {
      setError("Válassz érvényes cél számlát.")
      return
    }
    if (transaction.direction !== "transfer" && !categoryId) {
      setError("Válassz kategóriát.")
      return
    }

    try {
      await updateTransaction.mutateAsync({
        id: transaction.id,
        amount: centsToAmount(cents),
        account_id: accountId,
        to_account_id: transaction.direction === "transfer" ? toAccountId : null,
        category_id: transaction.direction === "transfer" ? null : categoryId,
        occurred_at: occurredAt,
        payee: payee.trim() || null,
        note: note.trim() || null,
      })
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ismeretlen hiba történt mentéskor.")
    }
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{DIRECTION_LABEL[transaction.direction]} szerkesztése</SheetTitle>
          </SheetHeader>

          <div className="flex flex-col gap-4 overflow-y-auto px-4 pb-6">
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-amount">Összeg (Ft)</Label>
              <Input
                id="edit-amount"
                inputMode="decimal"
                value={amountText}
                onChange={(e) => setAmountText(e.target.value)}
              />
            </div>

            {transaction.direction !== "transfer" && (
              <div className="flex flex-col gap-2">
                <Label>Kategória</Label>
                <Button type="button" variant="outline" onClick={() => setCategorySheetOpen(true)}>
                  {category ? categoryLabel(category) : "Válassz kategóriát"}
                </Button>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <Label>Számla</Label>
              <Button type="button" variant="outline" onClick={() => setAccountSheetOpen(true)}>
                {account?.name ?? "Válassz számlát"}
              </Button>
            </div>

            {transaction.direction === "transfer" && (
              <div className="flex flex-col gap-2">
                <Label>Cél számla</Label>
                <Button type="button" variant="outline" onClick={() => setToAccountSheetOpen(true)}>
                  {toAccount?.name ?? "Válassz cél számlát"}
                </Button>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <Label>Dátum</Label>
              <Button type="button" variant="outline" onClick={() => setDateSheetOpen(true)}>
                {occurredAt && format(new Date(occurredAt), "yyyy. MMMM d.", { locale: hu })}
              </Button>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-payee">Kedvezményezett (opcionális)</Label>
              <Input id="edit-payee" value={payee} onChange={(e) => setPayee(e.target.value)} />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-note">Megjegyzés (opcionális)</Label>
              <Input id="edit-note" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>

            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}

            <Button type="button" size="lg" onClick={() => void handleSave()} disabled={updateTransaction.isPending}>
              {updateTransaction.isPending ? "Mentés…" : "Mentés"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="text-destructive"
              onClick={() => setDeleteConfirmOpen(true)}
            >
              Tranzakció törlése
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {transaction.direction !== "transfer" && (
        <CategoryPickerSheet
          open={categorySheetOpen}
          onOpenChange={setCategorySheetOpen}
          kind={transaction.direction}
          onSelect={(c) => setCategoryId(c.id)}
        />
      )}

      <AccountPickerSheet
        open={accountSheetOpen}
        onOpenChange={setAccountSheetOpen}
        value={accountId}
        onSelect={(a) => setAccountId(a.id)}
        excludeId={transaction.direction === "transfer" ? (toAccountId ?? undefined) : undefined}
      />

      {transaction.direction === "transfer" && (
        <AccountPickerSheet
          open={toAccountSheetOpen}
          onOpenChange={setToAccountSheetOpen}
          value={toAccountId}
          onSelect={(a) => setToAccountId(a.id)}
          excludeId={accountId ?? undefined}
          title="Cél számla"
        />
      )}

      <DatePickerSheet
        open={dateSheetOpen}
        onOpenChange={setDateSheetOpen}
        value={occurredAt}
        onSelect={setOccurredAt}
      />

      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={(next) => {
          setDeleteConfirmOpen(next)
          if (!next) setDeleteError(null)
        }}
        title="Tranzakció törlése"
        description={
          deleteError ??
          `${formatCentsAsHuf(parseAmountInputToCents(String(transaction.amount)))} — ez a művelet nem vonható vissza.`
        }
        onConfirm={async () => {
          setDeleteError(null)
          try {
            await deleteTransaction.mutateAsync(transaction.id)
            setDeleteConfirmOpen(false)
            onOpenChange(false)
          } catch (err) {
            setDeleteError(err instanceof Error ? err.message : "Ismeretlen hiba történt törléskor.")
          }
        }}
      />
    </>
  )
}
