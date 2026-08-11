import { cn } from "@/lib/utils"
import type { TransactionDirection } from "@/lib/database.types"

const OPTIONS: { value: TransactionDirection; label: string }[] = [
  { value: "expense", label: "Kiadás" },
  { value: "income", label: "Bevétel" },
  { value: "transfer", label: "Átvez." },
]

const ACTIVE_CLASS: Record<TransactionDirection, string> = {
  expense: "bg-expense text-expense-foreground",
  income: "bg-income text-income-foreground",
  transfer: "bg-transfer text-transfer-foreground",
}

interface DirectionSwitchProps {
  value: TransactionDirection
  onChange: (value: TransactionDirection) => void
}

export function DirectionSwitch({ value, onChange }: DirectionSwitchProps) {
  return (
    <div
      role="tablist"
      aria-label="Tranzakció típusa"
      className="flex gap-1 rounded-xl bg-secondary p-1"
    >
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "min-h-11 flex-1 rounded-lg text-sm font-medium transition-colors",
            value === option.value
              ? ACTIVE_CLASS[option.value]
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
