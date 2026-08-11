import { useEffect, useState } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { useCreateAccount, useUpdateAccount, type Account } from "@/lib/queries/accounts"
import type { AccountType } from "@/lib/database.types"

const ACCOUNT_TYPES: { value: AccountType; label: string }[] = [
  { value: "cash", label: "Készpénz" },
  { value: "bank", label: "Bankszámla" },
  { value: "card", label: "Kártya" },
  { value: "savings", label: "Megtakarítás" },
  { value: "credit", label: "Hitel" },
  { value: "other", label: "Egyéb" },
]

interface AccountFormSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  account?: Account | null
  nextSortOrder: number
}

export function AccountFormSheet({
  open,
  onOpenChange,
  account,
  nextSortOrder,
}: AccountFormSheetProps) {
  const isEdit = !!account
  const createAccount = useCreateAccount()
  const updateAccount = useUpdateAccount()

  const [name, setName] = useState("")
  const [type, setType] = useState<AccountType>("cash")
  const [openingBalance, setOpeningBalance] = useState("0")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setName(account?.name ?? "")
      setType(account?.type ?? "cash")
      setOpeningBalance(account ? String(account.opening_balance) : "0")
      setError(null)
    }
  }, [open, account])

  const saving = createAccount.isPending || updateAccount.isPending

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError("Adj meg egy nevet.")
      return
    }
    const balance = Number(openingBalance.replace(",", "."))
    if (Number.isNaN(balance)) {
      setError("Érvénytelen nyitóegyenleg.")
      return
    }

    try {
      if (isEdit) {
        await updateAccount.mutateAsync({ id: account.id, name: name.trim(), type })
      } else {
        await createAccount.mutateAsync({
          name: name.trim(),
          type,
          opening_balance: balance,
          sort_order: nextSortOrder,
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
          <SheetTitle>{isEdit ? "Számla szerkesztése" : "Új számla"}</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-4 pb-6">
          <div className="flex flex-col gap-2">
            <Label htmlFor="account-name">Név</Label>
            <Input
              id="account-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="pl. Készpénz"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="account-type">Típus</Label>
            <select
              id="account-type"
              value={type}
              onChange={(e) => setType(e.target.value as AccountType)}
              className="h-12 w-full rounded-md border border-input bg-transparent px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              {ACCOUNT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {!isEdit && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="opening-balance">Nyitóegyenleg (Ft)</Label>
              <Input
                id="opening-balance"
                inputMode="decimal"
                value={openingBalance}
                onChange={(e) => setOpeningBalance(e.target.value)}
              />
            </div>
          )}

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <Button type="submit" size="lg" disabled={saving}>
            {saving ? "Mentés…" : "Mentés"}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  )
}
