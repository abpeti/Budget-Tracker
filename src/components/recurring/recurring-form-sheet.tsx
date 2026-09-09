import { useEffect, useMemo, useState } from "react"
import { format, parseISO } from "date-fns"
import { hu } from "date-fns/locale"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { DirectionSwitch } from "@/components/quick-entry/direction-switch"
import { CategoryPickerSheet } from "@/components/quick-entry/category-picker-sheet"
import { AccountPickerSheet } from "@/components/quick-entry/account-picker-sheet"
import { useAccounts } from "@/lib/queries/accounts"
import { useCategories, type Category } from "@/lib/queries/categories"
import {
  useCreateRecurringRule,
  useDeleteRecurringRule,
  useUpdateRecurringRule,
  type RecurringRule,
} from "@/lib/queries/recurring-rules"
import { centsToAmount, parseAmountInputToCents } from "@/lib/money"
import { deriveDayOfPeriod, describeSchedule, occurrencesFrom, todayIso } from "@/lib/recurring"
import type { RecurringFrequency, TransactionDirection } from "@/lib/database.types"
import { cn } from "@/lib/utils"

interface RecurringFormSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  rule?: RecurringRule | null
}

interface Preset {
  key: string
  label: string
  frequency: RecurringFrequency
  interval: number
}

/** A gyakori ütemezések egy koppintással; minden más az "Egyedi" alatt állítható. */
const PRESETS: Preset[] = [
  { key: "monthly", label: "Havonta", frequency: "monthly", interval: 1 },
  { key: "quarterly", label: "Negyedévente", frequency: "monthly", interval: 3 },
  { key: "half-yearly", label: "Félévente", frequency: "monthly", interval: 6 },
  { key: "yearly", label: "Évente", frequency: "yearly", interval: 1 },
  { key: "weekly", label: "Hetente", frequency: "weekly", interval: 1 },
  { key: "biweekly", label: "Kéthetente", frequency: "weekly", interval: 2 },
]

const PERIOD_UNIT_LABELS: Record<RecurringFrequency, string> = {
  daily: "naponta",
  weekly: "hetente",
  monthly: "havonta",
  yearly: "évente",
}

function matchingPresetKey(frequency: RecurringFrequency, interval: number): string {
  return PRESETS.find((p) => p.frequency === frequency && p.interval === interval)?.key ?? "custom"
}

export function RecurringFormSheet({ open, onOpenChange, rule }: RecurringFormSheetProps) {
  const isEdit = !!rule
  const { data: accounts } = useAccounts()
  const { data: categories } = useCategories()
  const createRule = useCreateRecurringRule()
  const updateRule = useUpdateRecurringRule()
  const deleteRule = useDeleteRecurringRule()

  const [name, setName] = useState("")
  const [direction, setDirection] = useState<TransactionDirection>("expense")
  const [amountText, setAmountText] = useState("")
  const [accountId, setAccountId] = useState<string | null>(null)
  const [toAccountId, setToAccountId] = useState<string | null>(null)
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [note, setNote] = useState("")

  const [presetKey, setPresetKey] = useState<string>("monthly")
  const [frequency, setFrequency] = useState<RecurringFrequency>("monthly")
  const [intervalCount, setIntervalCount] = useState(1)
  const [lastDayOfMonth, setLastDayOfMonth] = useState(false)
  const [startDate, setStartDate] = useState(todayIso)
  const [endDate, setEndDate] = useState("")

  const [error, setError] = useState<string | null>(null)
  const [categorySheetOpen, setCategorySheetOpen] = useState(false)
  const [accountSheetOpen, setAccountSheetOpen] = useState(false)
  const [toAccountSheetOpen, setToAccountSheetOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (!open) return

    if (rule) {
      const t = rule.template
      setName(rule.name ?? "")
      setDirection(t.direction)
      setAmountText(String(t.amount))
      setAccountId(t.account_id)
      setToAccountId(t.to_account_id ?? null)
      setCategoryId(t.category_id ?? null)
      setNote(t.note ?? "")
      setFrequency(rule.frequency)
      setIntervalCount(rule.interval_count)
      setPresetKey(matchingPresetKey(rule.frequency, rule.interval_count))
      setLastDayOfMonth(rule.day_of_period >= 31)
      setStartDate(rule.next_run)
      setEndDate(rule.end_date ?? "")
    } else {
      setName("")
      setDirection("expense")
      setAmountText("")
      setAccountId(null)
      setToAccountId(null)
      setCategoryId(null)
      setNote("")
      setFrequency("monthly")
      setIntervalCount(1)
      setPresetKey("monthly")
      setLastDayOfMonth(false)
      setStartDate(todayIso())
      setEndDate("")
    }
    setError(null)
  }, [open, rule])

  const account = accounts?.find((a) => a.id === accountId) ?? null
  const toAccount = accounts?.find((a) => a.id === toAccountId) ?? null
  const category = categories?.find((c) => c.id === categoryId) ?? null

  const categoryLabel = (cat: Category) => {
    const parent = cat.parent_id ? categories?.find((c) => c.id === cat.parent_id) : null
    return parent ? `${parent.name} › ${cat.name}` : cat.name
  }

  const dayOfPeriod = deriveDayOfPeriod(frequency, startDate || todayIso(), lastDayOfMonth)

  const preview = useMemo(
    () =>
      occurrencesFrom(
        { frequency, interval_count: Math.max(1, intervalCount), day_of_period: dayOfPeriod },
        startDate || todayIso(),
        3
      ),
    [frequency, intervalCount, dayOfPeriod, startDate]
  )

  const handleDirectionChange = (next: TransactionDirection) => {
    setDirection(next)
    setError(null)
    if (next === "transfer") {
      setCategoryId(null)
    } else {
      setToAccountId(null)
      if (category && category.kind !== next) setCategoryId(null)
    }
  }

  const applyPreset = (preset: Preset) => {
    setPresetKey(preset.key)
    setFrequency(preset.frequency)
    setIntervalCount(preset.interval)
  }

  const saving = createRule.isPending || updateRule.isPending

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const cents = parseAmountInputToCents(amountText.replace(",", "."))
    if (cents <= 0) {
      setError("Adj meg egy összeget.")
      return
    }
    if (!accountId) {
      setError("Válassz számlát.")
      return
    }
    if (direction === "transfer" && (!toAccountId || toAccountId === accountId)) {
      setError("Válassz érvényes cél számlát.")
      return
    }
    if (direction !== "transfer" && !categoryId) {
      setError("Válassz kategóriát.")
      return
    }
    if (!startDate) {
      setError("Add meg az első esedékesség dátumát.")
      return
    }
    if (endDate && endDate < startDate) {
      setError("A befejezés dátuma nem lehet korábbi az esedékességnél.")
      return
    }
    if (intervalCount < 1 || intervalCount > 99) {
      setError("Az ismétlődés száma 1 és 99 között lehet.")
      return
    }

    const input = {
      name: name.trim() || null,
      template: {
        direction,
        amount: centsToAmount(cents),
        account_id: accountId,
        to_account_id: direction === "transfer" ? toAccountId : null,
        category_id: direction === "transfer" ? null : categoryId,
        note: note.trim() || null,
      },
      frequency,
      interval_count: intervalCount,
      day_of_period: dayOfPeriod,
      next_run: startDate,
      end_date: endDate || null,
    }

    try {
      if (isEdit) {
        // Szerkesztésnél a megadott dátum a KÖVETKEZŐ esedékesség, és a szabály
        // újra aktívvá válik — így egy lezárult ismétlődés is újraindítható.
        await updateRule.mutateAsync({ id: rule.id, ...input, is_active: true })
      } else {
        await createRule.mutateAsync(input)
      }
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ismeretlen hiba történt mentéskor.")
    }
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="max-h-[92dvh]">
          <SheetHeader>
            <SheetTitle>{isEdit ? "Ismétlődő tétel szerkesztése" : "Új ismétlődő tétel"}</SheetTitle>
          </SheetHeader>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4 overflow-y-auto px-4 pb-6">
            <DirectionSwitch value={direction} onChange={handleDirectionChange} />

            <div className="flex flex-col gap-2">
              <Label htmlFor="recurring-name">Megnevezés (opcionális)</Label>
              <Input
                id="recurring-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="pl. Albérlet, Netflix, Biztosítás"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="recurring-amount">Összeg (Ft)</Label>
              <Input
                id="recurring-amount"
                inputMode="decimal"
                value={amountText}
                onChange={(e) => setAmountText(e.target.value)}
                placeholder="pl. 185000"
              />
            </div>

            {direction !== "transfer" && (
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

            {direction === "transfer" && (
              <div className="flex flex-col gap-2">
                <Label>Cél számla</Label>
                <Button type="button" variant="outline" onClick={() => setToAccountSheetOpen(true)}>
                  {toAccount?.name ?? "Válassz cél számlát"}
                </Button>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <Label>Ismétlődés</Label>
              <div className="flex flex-wrap gap-2">
                {PRESETS.map((preset) => (
                  <button
                    key={preset.key}
                    type="button"
                    onClick={() => applyPreset(preset)}
                    className={cn(
                      "min-h-11 rounded-lg border px-3 text-sm font-medium transition-colors",
                      presetKey === preset.key
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-input text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {preset.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setPresetKey("custom")}
                  className={cn(
                    "min-h-11 rounded-lg border px-3 text-sm font-medium transition-colors",
                    presetKey === "custom"
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input text-muted-foreground hover:text-foreground"
                  )}
                >
                  Egyedi
                </button>
              </div>
            </div>

            {presetKey === "custom" && (
              <div className="flex gap-2">
                <div className="flex w-24 flex-col gap-2">
                  <Label htmlFor="recurring-interval">Minden</Label>
                  <Input
                    id="recurring-interval"
                    inputMode="numeric"
                    value={String(intervalCount)}
                    onChange={(e) => setIntervalCount(Number(e.target.value.replace(/\D/g, "")) || 0)}
                  />
                </div>
                <div className="flex flex-1 flex-col gap-2">
                  <Label htmlFor="recurring-frequency">Periódus</Label>
                  <select
                    id="recurring-frequency"
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value as RecurringFrequency)}
                    className="h-12 w-full rounded-md border border-input bg-transparent px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
                  >
                    {(Object.keys(PERIOD_UNIT_LABELS) as RecurringFrequency[]).map((f) => (
                      <option key={f} value={f}>
                        {PERIOD_UNIT_LABELS[f]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {(frequency === "monthly" || frequency === "yearly") && (
              <label className="flex min-h-11 items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={lastDayOfMonth}
                  onChange={(e) => setLastDayOfMonth(e.target.checked)}
                  className="size-5 accent-primary"
                />
                <span>A hónap utolsó napján (a rövidebb hónapokban is)</span>
              </label>
            )}

            <div className="flex gap-2">
              <div className="flex flex-1 flex-col gap-2">
                <Label htmlFor="recurring-start">
                  {isEdit ? "Következő esedékesség" : "Első esedékesség"}
                </Label>
                <input
                  id="recurring-start"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="h-12 w-full rounded-md border border-input bg-transparent px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
                />
              </div>
              <div className="flex flex-1 flex-col gap-2">
                <Label htmlFor="recurring-end">Vége (opcionális)</Label>
                <input
                  id="recurring-end"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="h-12 w-full rounded-md border border-input bg-transparent px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="recurring-note">Megjegyzés (opcionális)</Label>
              <Input
                id="recurring-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="A rögzített tételekre is rákerül"
              />
            </div>

            <p className="rounded-lg bg-secondary p-3 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">
                {describeSchedule(frequency, intervalCount)}
              </span>{" "}
              — következő alkalmak:{" "}
              {preview.map((d) => format(parseISO(d), "yyyy. MMM d.", { locale: hu })).join(" · ")}
            </p>

            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}

            <Button type="submit" size="lg" disabled={saving}>
              {saving ? "Mentés…" : "Mentés"}
            </Button>

            {isEdit && (
              <Button
                type="button"
                variant="outline"
                className="text-destructive"
                onClick={() => setConfirmDelete(true)}
              >
                Ismétlődés törlése
              </Button>
            )}
          </form>
        </SheetContent>
      </Sheet>

      {direction !== "transfer" && (
        <CategoryPickerSheet
          open={categorySheetOpen}
          onOpenChange={setCategorySheetOpen}
          kind={direction}
          onSelect={(c) => setCategoryId(c.id)}
        />
      )}

      <AccountPickerSheet
        open={accountSheetOpen}
        onOpenChange={setAccountSheetOpen}
        value={accountId}
        onSelect={(a) => setAccountId(a.id)}
        excludeId={direction === "transfer" ? (toAccountId ?? undefined) : undefined}
      />

      {direction === "transfer" && (
        <AccountPickerSheet
          open={toAccountSheetOpen}
          onOpenChange={setToAccountSheetOpen}
          value={toAccountId}
          onSelect={(a) => setToAccountId(a.id)}
          excludeId={accountId ?? undefined}
          title="Cél számla"
        />
      )}

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Ismétlődés törlése"
        description="A szabály törlődik, a korábban belőle rögzített tételek megmaradnak."
        onConfirm={async () => {
          if (!rule) return
          await deleteRule.mutateAsync(rule.id)
          setConfirmDelete(false)
          onOpenChange(false)
        }}
      />
    </>
  )
}
