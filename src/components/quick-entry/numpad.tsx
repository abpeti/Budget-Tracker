import { Delete, Minus, Plus } from "lucide-react"
import { cn } from "@/lib/utils"

interface NumpadProps {
  onDigit: (digit: string) => void
  onDecimal: () => void
  onThousand: () => void
  onBackspace: () => void
  onOperator: (op: SumOperator) => void
  onOpenCategory: () => void
  onSave: () => void
  categoryLabel: string
  saving: boolean
  savePosition: "left" | "right"
  /** Az éppen függő művelet (összeadás/kivonás mód), vagy null, ha nincs gyűjtés folyamatban. */
  activeOperator: SumOperator | null
}

export type SumOperator = "plus" | "minus"

type CellKind = "digit" | "decimal" | "thousand" | "backspace" | "sum" | "category" | "save"

interface Cell {
  kind: CellKind
  label: string
  value?: string
}

const ROWS: Cell[][] = [
  [
    { kind: "digit", label: "1", value: "1" },
    { kind: "digit", label: "2", value: "2" },
    { kind: "digit", label: "3", value: "3" },
    { kind: "backspace", label: "Törlés" },
  ],
  [
    { kind: "digit", label: "4", value: "4" },
    { kind: "digit", label: "5", value: "5" },
    { kind: "digit", label: "6", value: "6" },
    { kind: "thousand", label: "000" },
  ],
  [
    { kind: "digit", label: "7", value: "7" },
    { kind: "digit", label: "8", value: "8" },
    { kind: "digit", label: "9", value: "9" },
    { kind: "sum", label: "Összeadás / kivonás" },
  ],
  [
    { kind: "decimal", label: "," },
    { kind: "digit", label: "0", value: "0" },
    { kind: "category", label: "Kat." },
    { kind: "save", label: "Mentés" },
  ],
]

export function Numpad({
  onDigit,
  onDecimal,
  onThousand,
  onBackspace,
  onOperator,
  onOpenCategory,
  onSave,
  categoryLabel,
  saving,
  savePosition,
  activeOperator,
}: NumpadProps) {
  // Balra módban a funkció-oszlop (utolsó cella) kerül a sor elejére,
  // a számjegyek sorrendje (1-2-3) változatlan marad.
  const rows = ROWS.map((row) =>
    savePosition === "left" ? [row[row.length - 1], ...row.slice(0, -1)] : row
  )

  return (
    <div className="grid grid-cols-4 gap-2 p-3">
      {rows.map((row, rowIndex) =>
        row.map((cell, cellIndex) => (
          <NumpadCell
            key={`${rowIndex}-${cellIndex}`}
            cell={cell}
            saving={saving}
            activeOperator={activeOperator}
            categoryLabel={categoryLabel}
            onDigit={onDigit}
            onDecimal={onDecimal}
            onThousand={onThousand}
            onBackspace={onBackspace}
            onOperator={onOperator}
            onOpenCategory={onOpenCategory}
            onSave={onSave}
          />
        ))
      )}
    </div>
  )
}

function NumpadCell({
  cell,
  saving,
  activeOperator,
  categoryLabel,
  onDigit,
  onDecimal,
  onThousand,
  onBackspace,
  onOperator,
  onOpenCategory,
  onSave,
}: {
  cell: Cell
} & Pick<
  NumpadProps,
  | "saving"
  | "activeOperator"
  | "categoryLabel"
  | "onDigit"
  | "onDecimal"
  | "onThousand"
  | "onBackspace"
  | "onOperator"
  | "onOpenCategory"
  | "onSave"
>) {
  const baseClass =
    "h-14 w-full rounded-xl text-xl font-medium tabular-nums transition-colors active:scale-95"

  switch (cell.kind) {
    case "digit":
      return (
        <button
          type="button"
          className={cn(baseClass, "bg-secondary text-secondary-foreground hover:bg-secondary/80")}
          aria-label={`Számjegy ${cell.value}`}
          onClick={() => onDigit(cell.value!)}
        >
          {cell.value}
        </button>
      )
    case "decimal":
      return (
        <button
          type="button"
          className={cn(baseClass, "bg-secondary text-secondary-foreground hover:bg-secondary/80")}
          aria-label="Tizedesvessző"
          onClick={onDecimal}
        >
          ,
        </button>
      )
    case "thousand":
      return (
        <button
          type="button"
          className={cn(baseClass, "bg-secondary text-secondary-foreground hover:bg-secondary/80 text-base")}
          aria-label="Három nulla hozzáadása"
          onClick={onThousand}
        >
          000
        </button>
      )
    case "backspace":
      return (
        <button
          type="button"
          className={cn(baseClass, "bg-secondary text-secondary-foreground hover:bg-secondary/80 flex items-center justify-center")}
          aria-label="Utolsó számjegy törlése"
          onClick={onBackspace}
        >
          <Delete className="size-5" aria-hidden="true" />
        </button>
      )
    case "sum": {
      const opClass = (op: SumOperator) =>
        cn(
          "h-14 flex-1 rounded-xl flex items-center justify-center transition-colors active:scale-95",
          activeOperator === op
            ? "bg-primary text-primary-foreground"
            : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
        )
      return (
        <div className="flex w-full gap-1">
          <button
            type="button"
            className={opClass("plus")}
            aria-label="Összeadás: az aktuális tétel hozzáadása, a következő hozzáadódik"
            aria-pressed={activeOperator === "plus"}
            onClick={() => onOperator("plus")}
          >
            <Plus className="size-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            className={opClass("minus")}
            aria-label="Kivonás: az aktuális tétel hozzáadása, a következő levonódik"
            aria-pressed={activeOperator === "minus"}
            onClick={() => onOperator("minus")}
          >
            <Minus className="size-5" aria-hidden="true" />
          </button>
        </div>
      )
    }
    case "category":
      return (
        <button
          type="button"
          className={cn(baseClass, "bg-secondary text-secondary-foreground hover:bg-secondary/80 text-sm px-1 truncate")}
          aria-label={`Kategória kiválasztása, jelenleg: ${categoryLabel}`}
          onClick={onOpenCategory}
        >
          Kat.
        </button>
      )
    case "save":
      return (
        <button
          type="button"
          disabled={saving}
          className={cn(
            baseClass,
            "bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60 text-base"
          )}
          aria-label="Tranzakció mentése"
          onClick={onSave}
        >
          {saving ? "…" : "MENTÉS"}
        </button>
      )
  }
}
