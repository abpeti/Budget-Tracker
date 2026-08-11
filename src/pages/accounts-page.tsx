import { useState } from "react"
import { Link } from "react-router-dom"
import { ArrowDown, ArrowLeft, ArrowUp, Archive, ArchiveRestore, Pencil, Plus, Trash2 } from "lucide-react"
import { useAccounts, useUpdateAccount, type Account } from "@/lib/queries/accounts"
import { useAccountBalances } from "@/lib/queries/account-balances"
import { formatCentsAsHuf } from "@/lib/money"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { AccountFormSheet } from "@/components/accounts/account-form-sheet"

const ACCOUNT_TYPE_LABELS: Record<Account["type"], string> = {
  cash: "Készpénz",
  bank: "Bankszámla",
  card: "Kártya",
  savings: "Megtakarítás",
  credit: "Hitel",
  other: "Egyéb",
}

export function AccountsPage() {
  const { data: accounts, isLoading } = useAccounts({ includeArchived: true })
  const { balances, netWorth } = useAccountBalances()
  const updateAccount = useUpdateAccount()

  const [formOpen, setFormOpen] = useState(false)
  const [editingAccount, setEditingAccount] = useState<Account | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Account | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const active = (accounts ?? []).filter((a) => !a.is_archived)
  const archived = (accounts ?? []).filter((a) => a.is_archived)

  const openCreate = () => {
    setEditingAccount(null)
    setFormOpen(true)
  }

  const openEdit = (account: Account) => {
    setEditingAccount(account)
    setFormOpen(true)
  }

  const move = (list: Account[], index: number, dir: -1 | 1) => {
    const target = list[index + dir]
    const current = list[index]
    if (!target) return
    updateAccount.mutate({ id: current.id, sort_order: target.sort_order })
    updateAccount.mutate({ id: target.id, sort_order: current.sort_order })
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleteError(null)
    const { error } = await supabase.from("accounts").delete().eq("id", deleteTarget.id)
    if (error) {
      setDeleteError(
        error.code === "23503"
          ? "Ez a számla nem törölhető, mert vannak hozzá tartozó tranzakciók. Archiváld helyette."
          : error.message
      )
      return
    }
    setDeleteTarget(null)
  }

  return (
    <div className="flex flex-col gap-4 p-4 pt-6">
      <Link
        to="/settings"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Beállítások
      </Link>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Számlák</h1>
          <p className="text-sm text-muted-foreground">
            Összesített vagyon: <span className="tabular-nums">{formatCentsAsHuf(netWorth)}</span>
          </p>
        </div>
        <Button type="button" size="icon" onClick={openCreate} aria-label="Új számla">
          <Plus className="size-5" />
        </Button>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Betöltés…</p>}

      {!isLoading && active.length === 0 && archived.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Még nincs számla. Hozz létre egyet a jobb felső gombbal.
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {active.map((account, index) => (
          <AccountRow
            key={account.id}
            account={account}
            balanceCents={balances.get(account.id) ?? 0}
            typeLabel={ACCOUNT_TYPE_LABELS[account.type]}
            onEdit={() => openEdit(account)}
            onArchive={() => updateAccount.mutate({ id: account.id, is_archived: true })}
            onDelete={() => {
              setDeleteError(null)
              setDeleteTarget(account)
            }}
            onMoveUp={index > 0 ? () => move(active, index, -1) : undefined}
            onMoveDown={index < active.length - 1 ? () => move(active, index, 1) : undefined}
          />
        ))}
      </ul>

      {archived.length > 0 && (
        <>
          <h2 className="mt-4 text-sm font-semibold text-muted-foreground">Archivált</h2>
          <ul className="flex flex-col gap-2">
            {archived.map((account) => (
              <AccountRow
                key={account.id}
                account={account}
                balanceCents={balances.get(account.id) ?? 0}
                typeLabel={ACCOUNT_TYPE_LABELS[account.type]}
                archived
                onEdit={() => openEdit(account)}
                onArchive={() => updateAccount.mutate({ id: account.id, is_archived: false })}
                onDelete={() => {
                  setDeleteError(null)
                  setDeleteTarget(account)
                }}
              />
            ))}
          </ul>
        </>
      )}

      <AccountFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        account={editingAccount}
        nextSortOrder={(accounts?.length ?? 0) + 1}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={`"${deleteTarget?.name}" törlése`}
        description={deleteError ?? "Ez a művelet nem vonható vissza."}
        onConfirm={handleDelete}
      />
    </div>
  )
}

function AccountRow({
  account,
  balanceCents,
  typeLabel,
  archived,
  onEdit,
  onArchive,
  onDelete,
  onMoveUp,
  onMoveDown,
}: {
  account: Account
  balanceCents: number
  typeLabel: string
  archived?: boolean
  onEdit: () => void
  onArchive: () => void
  onDelete: () => void
  onMoveUp?: () => void
  onMoveDown?: () => void
}) {
  return (
    <li className="flex flex-col gap-2 rounded-xl bg-card border border-border p-3">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{account.name}</p>
          <p className="text-xs text-muted-foreground">{typeLabel}</p>
        </div>
        <p className="tabular-nums font-medium shrink-0">{formatCentsAsHuf(balanceCents)}</p>
      </div>
      <div className="flex items-center justify-end gap-1">
        {!archived && (
          <>
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Feljebb" disabled={!onMoveUp} onClick={onMoveUp}>
              <ArrowUp className="size-4" />
            </Button>
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Lejjebb" disabled={!onMoveDown} onClick={onMoveDown}>
              <ArrowDown className="size-4" />
            </Button>
          </>
        )}
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Szerkesztés" onClick={onEdit}>
          <Pencil className="size-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon-sm" aria-label={archived ? "Visszaállítás" : "Archiválás"} onClick={onArchive}>
          {archived ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
        </Button>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Törlés" onClick={onDelete}>
          <Trash2 className="size-4" />
        </Button>
      </div>
    </li>
  )
}
