import { useEffect, useMemo, useRef, useState } from "react"
import { format, subDays } from "date-fns"
import { hu } from "date-fns/locale"
import type { TransactionDirection } from "@/lib/database.types"
import { useAccounts, type Account } from "@/lib/queries/accounts"
import { useCategories, type Category } from "@/lib/queries/categories"
import { useCreateTransaction, useDeleteTransaction } from "@/lib/queries/transactions"
import { getLastUsedAccountId, setLastUsedAccountId } from "@/lib/last-used-account"
import {
  appendDecimalPoint,
  appendToAmountInput,
  backspaceAmountInput,
  centsToAmount,
  formatAmountInputDisplay,
  formatCentsAsHuf,
  parseAmountInputToCents,
} from "@/lib/money"
import { useSavePosition } from "@/contexts/save-position-context"
import { DirectionSwitch } from "@/components/quick-entry/direction-switch"
import { Numpad } from "@/components/quick-entry/numpad"
import { FrequentCategoryChips } from "@/components/quick-entry/frequent-category-chips"
import { CategoryPickerSheet } from "@/components/quick-entry/category-picker-sheet"
import { AccountPickerSheet } from "@/components/quick-entry/account-picker-sheet"
import { DatePickerSheet } from "@/components/quick-entry/date-picker-sheet"
import { SaveToast } from "@/components/quick-entry/save-toast"

function todayStr() {
  return format(new Date(), "yyyy-MM-dd")
}

export function QuickEntryPage() {
  const { data: accounts } = useAccounts()
  const { data: allCategories } = useCategories()
  const createTransaction = useCreateTransaction()
  const deleteTransaction = useDeleteTransaction()
  const { savePosition } = useSavePosition()

  const [direction, setDirection] = useState<TransactionDirection>("expense")
  const [amountRaw, setAmountRaw] = useState("0")
  const [sumParts, setSumParts] = useState<number[]>([])
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null)
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null)
  const [selectedToAccount, setSelectedToAccount] = useState<Account | null>(null)
  const [occurredAt, setOccurredAt] = useState(todayStr())
  const [error, setError] = useState<string | null>(null)

  const [categorySheetOpen, setCategorySheetOpen] = useState(false)
  const [accountSheetOpen, setAccountSheetOpen] = useState(false)
  const [toAccountSheetOpen, setToAccountSheetOpen] = useState(false)
  const [dateSheetOpen, setDateSheetOpen] = useState(false)

  const [toastTxId, setToastTxId] = useState<string | null>(null)
  const toastTimerRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (selectedAccount || !accounts || accounts.length === 0) return
    const lastId = getLastUsedAccountId()
    const match = lastId ? accounts.find((a) => a.id === lastId) : undefined
    setSelectedAccount(match ?? accounts[0])
  }, [accounts, selectedAccount])

  const categoryMap = useMemo(
    () => new Map((allCategories ?? []).map((c) => [c.id, c])),
    [allCategories]
  )

  const categoryLabel = (cat: Category): string => {
    if (cat.parent_id) {
      const parent = categoryMap.get(cat.parent_id)
      if (parent) return `${parent.name} › ${cat.name}`
    }
    return cat.name
  }

  const dateLabel = (dateStr: string): string => {
    if (dateStr === todayStr()) return "ma"
    if (dateStr === format(subDays(new Date(), 1), "yyyy-MM-dd")) return "tegnap"
    return format(new Date(dateStr), "MMM d.", { locale: hu })
  }

  const handleDirectionChange = (next: TransactionDirection) => {
    setDirection(next)
    setError(null)
    if (next === "transfer") {
      setSelectedCategory(null)
    } else {
      setSelectedToAccount(null)
      setSelectedCategory((prev) => (prev && prev.kind !== next ? null : prev))
    }
  }

  const sumTotal = sumParts.reduce((a, b) => a + b, 0)

  const showUndoToast = (id: string) => {
    setToastTxId(id)
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
    toastTimerRef.current = window.setTimeout(() => setToastTxId(null), 2500)
  }

  const handleUndo = () => {
    if (!toastTxId) return
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
    deleteTransaction.mutate(toastTxId)
    setToastTxId(null)
  }

  const handleSave = async () => {
    const currentCents = parseAmountInputToCents(amountRaw)
    const totalCents = sumTotal + currentCents

    if (totalCents <= 0) {
      setError("Adj meg egy összeget.")
      return
    }
    if (!selectedAccount) {
      setError("Válassz számlát.")
      setAccountSheetOpen(true)
      return
    }
    if (direction === "transfer") {
      if (!selectedToAccount) {
        setError("Válassz cél számlát.")
        setToAccountSheetOpen(true)
        return
      }
    } else if (!selectedCategory) {
      setError("Válassz kategóriát.")
      setCategorySheetOpen(true)
      return
    }

    setError(null)

    try {
      const created = await createTransaction.mutateAsync({
        direction,
        amount: centsToAmount(totalCents),
        account_id: selectedAccount.id,
        to_account_id: direction === "transfer" ? selectedToAccount!.id : null,
        category_id: direction === "transfer" ? null : selectedCategory!.id,
        occurred_at: occurredAt,
      })

      setLastUsedAccountId(selectedAccount.id)
      if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(15)

      setAmountRaw("0")
      setSumParts([])
      if (direction !== "transfer") setSelectedCategory(null)

      showUndoToast(created.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ismeretlen hiba történt mentéskor.")
    }
  }

  return (
    <div className="flex min-h-[calc(100dvh-5rem)] flex-col">
      <div className="flex flex-col gap-4 px-4 pt-4">
        <DirectionSwitch value={direction} onChange={handleDirectionChange} />

        <div className="flex flex-col items-center gap-1 py-2 text-center">
          <p className="tabular-nums text-5xl font-semibold">
            {formatAmountInputDisplay(amountRaw)}{" "}
            <span className="text-2xl text-muted-foreground">Ft</span>
          </p>

          {sumParts.length > 0 && (
            <p className="text-sm text-muted-foreground">
              +{sumParts.length} tétel eddig: {formatCentsAsHuf(sumTotal)}
            </p>
          )}

          {direction !== "transfer" && (
            <button
              type="button"
              onClick={() => setCategorySheetOpen(true)}
              className="mt-1 min-h-11 rounded-lg px-3 text-base font-medium hover:bg-secondary"
            >
              {selectedCategory ? categoryLabel(selectedCategory) : "Válassz kategóriát"}
            </button>
          )}

          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <button
              type="button"
              onClick={() => setAccountSheetOpen(true)}
              className="min-h-11 rounded-lg px-2 hover:bg-secondary hover:text-foreground"
            >
              {selectedAccount?.name ?? "Számla"}
            </button>

            {direction === "transfer" && (
              <>
                <span aria-hidden="true">→</span>
                <button
                  type="button"
                  onClick={() => setToAccountSheetOpen(true)}
                  className="min-h-11 rounded-lg px-2 hover:bg-secondary hover:text-foreground"
                >
                  {selectedToAccount?.name ?? "Cél számla"}
                </button>
              </>
            )}

            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={() => setDateSheetOpen(true)}
              className="min-h-11 rounded-lg px-2 hover:bg-secondary hover:text-foreground"
            >
              {dateLabel(occurredAt)}
            </button>
          </div>
        </div>

        {error && (
          <p role="alert" className="text-center text-sm text-destructive">
            {error}
          </p>
        )}
      </div>

      <div className="mt-auto">
        {direction !== "transfer" && (
          <FrequentCategoryChips
            kind={direction}
            selectedId={selectedCategory?.id ?? null}
            onSelect={setSelectedCategory}
          />
        )}

        <Numpad
          categoryLabel={selectedCategory ? categoryLabel(selectedCategory) : "nincs"}
          saving={createTransaction.isPending}
          savePosition={savePosition}
          sumModeActive={sumParts.length > 0}
          onDigit={(d) => setAmountRaw((prev) => appendToAmountInput(prev, d))}
          onDecimal={() => setAmountRaw((prev) => appendDecimalPoint(prev))}
          onThousand={() => setAmountRaw((prev) => appendToAmountInput(prev, "000"))}
          onBackspace={() => setAmountRaw((prev) => backspaceAmountInput(prev))}
          onToggleSum={() => {
            const cents = parseAmountInputToCents(amountRaw)
            if (cents > 0) {
              setSumParts((prev) => [...prev, cents])
              setAmountRaw("0")
            }
          }}
          onOpenCategory={() => setCategorySheetOpen(true)}
          onSave={() => void handleSave()}
        />
      </div>

      {direction !== "transfer" && (
        <CategoryPickerSheet
          open={categorySheetOpen}
          onOpenChange={setCategorySheetOpen}
          kind={direction}
          onSelect={setSelectedCategory}
        />
      )}

      <AccountPickerSheet
        open={accountSheetOpen}
        onOpenChange={setAccountSheetOpen}
        value={selectedAccount?.id ?? null}
        onSelect={setSelectedAccount}
        excludeId={direction === "transfer" ? selectedToAccount?.id : undefined}
      />

      {direction === "transfer" && (
        <AccountPickerSheet
          open={toAccountSheetOpen}
          onOpenChange={setToAccountSheetOpen}
          value={selectedToAccount?.id ?? null}
          onSelect={setSelectedToAccount}
          excludeId={selectedAccount?.id}
          title="Cél számla"
        />
      )}

      <DatePickerSheet
        open={dateSheetOpen}
        onOpenChange={setDateSheetOpen}
        value={occurredAt}
        onSelect={setOccurredAt}
      />

      {toastTxId && (
        <div className="pointer-events-none fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 flex justify-center px-4">
          <SaveToast onUndo={handleUndo} />
        </div>
      )}
    </div>
  )
}
