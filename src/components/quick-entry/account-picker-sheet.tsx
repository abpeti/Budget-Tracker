import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { useAccounts, type Account } from "@/lib/queries/accounts"
import { cn } from "@/lib/utils"

const ACCOUNT_TYPE_LABELS: Record<Account["type"], string> = {
  cash: "Készpénz",
  bank: "Bankszámla",
  card: "Kártya",
  savings: "Megtakarítás",
  credit: "Hitel",
  other: "Egyéb",
}

interface AccountPickerSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  value: string | null
  onSelect: (account: Account) => void
  excludeId?: string | null
  title?: string
}

export function AccountPickerSheet({
  open,
  onOpenChange,
  value,
  onSelect,
  excludeId,
  title = "Számla",
}: AccountPickerSheetProps) {
  const { data: allAccounts, isLoading } = useAccounts()
  const accounts = excludeId ? allAccounts?.filter((a) => a.id !== excludeId) : allAccounts

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-1 px-4 pb-6">
          {isLoading && <p className="py-8 text-center text-sm text-muted-foreground">Betöltés…</p>}
          {!isLoading && accounts?.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Még nincs számla. Hozz létre egyet a Számlák oldalon.
            </p>
          )}
          {accounts?.map((account) => (
            <button
              key={account.id}
              type="button"
              onClick={() => {
                onSelect(account)
                onOpenChange(false)
              }}
              className={cn(
                "flex min-h-12 items-center justify-between rounded-lg px-3 py-2 text-left transition-colors hover:bg-secondary",
                value === account.id && "bg-secondary"
              )}
            >
              <span className="font-medium">{account.name}</span>
              <span className="text-sm text-muted-foreground">
                {ACCOUNT_TYPE_LABELS[account.type]}
              </span>
            </button>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  )
}
