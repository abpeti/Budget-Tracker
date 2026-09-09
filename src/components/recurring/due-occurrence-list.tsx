import { useState } from "react"
import { format, parseISO } from "date-fns"
import { hu } from "date-fns/locale"
import { Button } from "@/components/ui/button"
import { formatCentsAsHuf, toCents } from "@/lib/money"
import {
  usePostRecurringOccurrence,
  useSkipRecurringOccurrence,
  type DueOccurrence,
} from "@/lib/queries/recurring-rules"
import { todayIso } from "@/lib/recurring"
import { useRecurringLabels } from "@/components/recurring/recurring-labels"
import { cn } from "@/lib/utils"

const AMOUNT_CLASS: Record<string, string> = {
  expense: "text-expense",
  income: "text-income",
  transfer: "text-transfer",
}

const occurrenceKey = (occurrence: DueOccurrence) => `${occurrence.rule.id}|${occurrence.date}`

interface DueOccurrenceListProps {
  occurrences: DueOccurrence[]
  /** Az összes esedékes tétel egyben rögzíthető. */
  showPostAll?: boolean
  onAllHandled?: () => void
}

/**
 * Az esedékes (és elmaradt) előfordulások listája — tételenként rögzíthető vagy
 * kihagyható. Ugyanezt használja az indításkori felajánlás és a kezelőoldal.
 */
export function DueOccurrenceList({
  occurrences,
  showPostAll = true,
  onAllHandled,
}: DueOccurrenceListProps) {
  const labels = useRecurringLabels()
  const postOccurrence = usePostRecurringOccurrence()
  const skipOccurrence = useSkipRecurringOccurrence()

  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [postingAll, setPostingAll] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const today = todayIso()

  const run = async (action: () => Promise<unknown>, key: string | null) => {
    setError(null)
    setBusyKey(key)
    try {
      await action()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ismeretlen hiba történt.")
    } finally {
      setBusyKey(null)
    }
  }

  const handlePostAll = async () => {
    setError(null)
    setPostingAll(true)
    try {
      // Dátum szerint sorban, egyesével: a szabály next_run értéke minden
      // rögzítés után lép, így a végén a helyes következő esedékesség marad.
      for (const occurrence of occurrences) {
        await postOccurrence.mutateAsync(occurrence)
      }
      onAllHandled?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ismeretlen hiba történt.")
    } finally {
      setPostingAll(false)
    }
  }

  const busy = postingAll || busyKey !== null

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2">
        {occurrences.map((occurrence) => {
          const { rule, date } = occurrence
          const key = occurrenceKey(occurrence)
          const overdue = date < today

          return (
            <li key={key} className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{labels.title(rule)}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(parseISO(date), "yyyy. MMMM d.", { locale: hu })}
                    {overdue && <span className="text-destructive"> · elmaradt</span>}
                    {" · "}
                    {labels.accountPath(rule)}
                  </p>
                </div>
                <p
                  className={cn(
                    "shrink-0 font-medium tabular-nums",
                    AMOUNT_CLASS[rule.template.direction]
                  )}
                >
                  {formatCentsAsHuf(toCents(rule.template.amount))}
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  className="flex-1"
                  disabled={busy}
                  onClick={() => void run(() => postOccurrence.mutateAsync(occurrence), key)}
                >
                  {busyKey === key ? "…" : "Rögzítés"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  disabled={busy}
                  onClick={() => void run(() => skipOccurrence.mutateAsync(occurrence), key)}
                >
                  Kihagyás
                </Button>
              </div>
            </li>
          )
        })}
      </ul>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {showPostAll && occurrences.length > 1 && (
        <Button type="button" size="lg" disabled={busy} onClick={() => void handlePostAll()}>
          {postingAll ? "Rögzítés…" : `Mind rögzítése (${occurrences.length})`}
        </Button>
      )}
    </div>
  )
}
