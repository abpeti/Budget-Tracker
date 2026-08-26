import { useEffect, useState } from "react"
import { endOfMonth, endOfYear, format, startOfMonth, startOfYear, subMonths } from "date-fns"
import { cn } from "@/lib/utils"

const fmt = (d: Date) => format(d, "yyyy-MM-dd")

export type PeriodKey = "this-month" | "last-month" | "this-year" | "custom"

export interface ReportRange {
  key: PeriodKey
  from?: string
  to?: string
}

const PRESETS: { value: Exclude<PeriodKey, "custom">; label: string; range: () => { from: string; to: string } }[] = [
  {
    value: "this-month",
    label: "Ez a hónap",
    range: () => ({ from: fmt(startOfMonth(new Date())), to: fmt(endOfMonth(new Date())) }),
  },
  {
    value: "last-month",
    label: "Előző hónap",
    range: () => {
      const prev = subMonths(new Date(), 1)
      return { from: fmt(startOfMonth(prev)), to: fmt(endOfMonth(prev)) }
    },
  },
  {
    value: "this-year",
    label: "Ez az év",
    range: () => ({ from: fmt(startOfYear(new Date())), to: fmt(endOfYear(new Date())) }),
  },
]

export function getDefaultRange(): ReportRange {
  return { key: "this-month", ...PRESETS[0].range() }
}

interface PeriodSelectorProps {
  value: ReportRange
  onChange: (range: ReportRange) => void
}

export function PeriodSelector({ value, onChange }: PeriodSelectorProps) {
  const [customFrom, setCustomFrom] = useState(value.key === "custom" ? value.from ?? "" : "")
  const [customTo, setCustomTo] = useState(value.key === "custom" ? value.to ?? "" : "")

  useEffect(() => {
    if (value.key === "custom" && customFrom && customTo) {
      onChange({ key: "custom", from: customFrom, to: customTo })
    }
    // Csak akkor küldjük tovább, ha a felhasználó mindkét mezőt kitöltötte.
  }, [customFrom, customTo, value.key, onChange])

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => {
          const active = value.key === p.value
          return (
            <button
              key={p.value}
              type="button"
              onClick={() => onChange({ key: p.value, ...p.range() })}
              className={cn(
                "min-h-9 rounded-full border px-3 text-sm",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-secondary text-secondary-foreground"
              )}
            >
              {p.label}
            </button>
          )
        })}
        <button
          type="button"
          onClick={() => onChange({ key: "custom", from: customFrom || undefined, to: customTo || undefined })}
          className={cn(
            "min-h-9 rounded-full border px-3 text-sm",
            value.key === "custom"
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-secondary text-secondary-foreground"
          )}
        >
          Egyedi tartomány
        </button>
      </div>

      {value.key === "custom" && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={customFrom}
            onChange={(e) => setCustomFrom(e.target.value)}
            className="h-10 min-w-0 flex-1 rounded-md border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
            aria-label="Kezdő dátum"
          />
          <span className="text-muted-foreground">–</span>
          <input
            type="date"
            value={customTo}
            onChange={(e) => setCustomTo(e.target.value)}
            className="h-10 min-w-0 flex-1 rounded-md border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
            aria-label="Záró dátum"
          />
        </div>
      )}
    </div>
  )
}
