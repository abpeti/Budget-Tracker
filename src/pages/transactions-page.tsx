import { useEffect, useMemo, useRef, useState } from "react"
import { format, isToday, isYesterday } from "date-fns"
import { hu } from "date-fns/locale"
import { SlidersHorizontal } from "lucide-react"
import { useTransactionsInfinite, useDeleteTransaction, type Transaction } from "@/lib/queries/transactions"
import type { TransactionFilters } from "@/lib/queries/transactions"
import { useAccounts } from "@/lib/queries/accounts"
import { useCategories, type Category } from "@/lib/queries/categories"
import { formatCentsAsHuf } from "@/lib/money"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { SwipeableRow } from "@/components/transactions/swipeable-row"
import { TransactionFilterSheet } from "@/components/transactions/transaction-filter-sheet"
import { TransactionEditSheet } from "@/components/transactions/transaction-edit-sheet"
import { cn } from "@/lib/utils"

function groupByDate(transactions: Transaction[]) {
  const groups: { date: string; items: Transaction[] }[] = []
  for (const tx of transactions) {
    const last = groups[groups.length - 1]
    if (last && last.date === tx.occurred_at) {
      last.items.push(tx)
    } else {
      groups.push({ date: tx.occurred_at, items: [tx] })
    }
  }
  return groups
}

function dateHeading(dateStr: string): string {
  const d = new Date(dateStr)
  if (isToday(d)) return "Ma"
  if (isYesterday(d)) return "Tegnap"
  return format(d, "yyyy. MMMM d., EEEE", { locale: hu })
}

export function TransactionsPage() {
  const [filters, setFilters] = useState<TransactionFilters>({})
  const [searchInput, setSearchInput] = useState("")
  const [filterSheetOpen, setFilterSheetOpen] = useState(false)
  const [editingTx, setEditingTx] = useState<Transaction | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const { data: accounts } = useAccounts()
  const { data: categories } = useCategories()
  const deleteTransaction = useDeleteTransaction()

  useEffect(() => {
    const handle = setTimeout(() => {
      setFilters((f) => ({ ...f, search: searchInput || undefined }))
    }, 300)
    return () => clearTimeout(handle)
  }, [searchInput])

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useTransactionsInfinite(filters)

  const allTransactions = useMemo(() => data?.pages.flat() ?? [], [data])
  const groups = useMemo(() => groupByDate(allTransactions), [allTransactions])

  const accountMap = useMemo(() => new Map((accounts ?? []).map((a) => [a.id, a])), [accounts])
  const categoryMap = useMemo(() => new Map((categories ?? []).map((c) => [c.id, c])), [categories])

  const categoryLabel = (cat: Category) =>
    cat.parent_id ? `${categoryMap.get(cat.parent_id)?.name ?? ""} › ${cat.name}` : cat.name

  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage()
      }
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [fetchNextPage, hasNextPage, isFetchingNextPage])

  const activeFilterCount = [
    filters.from,
    filters.direction,
    filters.accountId,
    filters.categoryId,
  ].filter(Boolean).length

  return (
    <div className="flex flex-col gap-3 p-4 pt-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Tételek</h1>
      </div>

      <div className="flex gap-2">
        <Input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Keresés kedvezményezett vagy megjegyzés alapján…"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Szűrők"
          onClick={() => setFilterSheetOpen(true)}
          className="relative shrink-0"
        >
          <SlidersHorizontal className="size-5" />
          {activeFilterCount > 0 && (
            <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
              {activeFilterCount}
            </span>
          )}
        </Button>
      </div>

      {isLoading && <p className="py-8 text-center text-sm text-muted-foreground">Betöltés…</p>}

      {!isLoading && groups.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Nincs a szűrésnek megfelelő tranzakció.
        </p>
      )}

      <div className="flex flex-col gap-4">
        {groups.map((group) => (
          <div key={group.date}>
            <h2 className="mb-1 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {dateHeading(group.date)}
            </h2>
            <ul className="flex flex-col overflow-hidden rounded-xl border border-border">
              {group.items.map((tx) => {
                const account = accountMap.get(tx.account_id)
                const toAccount = tx.to_account_id ? accountMap.get(tx.to_account_id) : null
                const category = tx.category_id ? categoryMap.get(tx.category_id) : null

                return (
                  <li key={tx.id} className="border-b border-border last:border-b-0">
                    <SwipeableRow onDelete={() => setDeleteTarget(tx)}>
                      <button
                        type="button"
                        onClick={() => setEditingTx(tx)}
                        className="flex w-full items-center gap-3 bg-card px-3 py-3 text-left hover:bg-secondary/50"
                      >
                        <span
                          className="flex size-9 shrink-0 items-center justify-center rounded-full text-sm"
                          style={{ backgroundColor: category?.color ?? "var(--color-muted)" }}
                          aria-hidden="true"
                        >
                          {tx.direction === "transfer" ? "⇄" : category?.icon ?? category?.name.charAt(0) ?? "•"}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {tx.direction === "transfer"
                              ? `${account?.name ?? "?"} → ${toAccount?.name ?? "?"}`
                              : category
                                ? categoryLabel(category)
                                : "Nincs kategória"}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {[tx.payee, tx.direction !== "transfer" ? account?.name : null, tx.note]
                              .filter(Boolean)
                              .join(" · ") || (tx.direction !== "transfer" ? account?.name : "")}
                          </p>
                        </div>
                        <p
                          className={cn(
                            "tabular-nums font-medium",
                            tx.direction === "expense" && "text-expense",
                            tx.direction === "income" && "text-income",
                            tx.direction === "transfer" && "text-transfer"
                          )}
                        >
                          {tx.direction === "expense" ? "−" : tx.direction === "income" ? "+" : ""}
                          {formatCentsAsHuf(Math.round(tx.amount * 100))}
                        </p>
                      </button>
                    </SwipeableRow>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>

      <div ref={sentinelRef} className="h-4" />
      {isFetchingNextPage && (
        <p className="pb-4 text-center text-sm text-muted-foreground">Töltés…</p>
      )}

      <TransactionFilterSheet
        open={filterSheetOpen}
        onOpenChange={setFilterSheetOpen}
        filters={filters}
        onChange={setFilters}
      />

      <TransactionEditSheet
        open={!!editingTx}
        onOpenChange={(open) => !open && setEditingTx(null)}
        transaction={editingTx}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null)
            setDeleteError(null)
          }
        }}
        title="Tranzakció törlése"
        description={
          deleteError ??
          (deleteTarget
            ? `${formatCentsAsHuf(Math.round(deleteTarget.amount * 100))} — ez a művelet nem vonható vissza.`
            : undefined)
        }
        onConfirm={async () => {
          if (!deleteTarget) return
          setDeleteError(null)
          try {
            await deleteTransaction.mutateAsync(deleteTarget.id)
            setDeleteTarget(null)
          } catch (err) {
            setDeleteError(err instanceof Error ? err.message : "Ismeretlen hiba történt törléskor.")
          }
        }}
      />
    </div>
  )
}
