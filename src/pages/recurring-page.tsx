import { useState } from "react"
import { Link } from "react-router-dom"
import { format, parseISO } from "date-fns"
import { hu } from "date-fns/locale"
import { ArrowLeft, Pause, Pencil, Play, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { RecurringFormSheet } from "@/components/recurring/recurring-form-sheet"
import { DueOccurrenceList } from "@/components/recurring/due-occurrence-list"
import { useRecurringLabels } from "@/components/recurring/recurring-labels"
import {
  useDueRecurringOccurrences,
  useUpdateRecurringRule,
  type RecurringRule,
} from "@/lib/queries/recurring-rules"
import { describeAnchor, describeSchedule, isFinished } from "@/lib/recurring"
import { formatCentsAsHuf, toCents } from "@/lib/money"
import { cn } from "@/lib/utils"

const AMOUNT_CLASS: Record<string, string> = {
  expense: "text-expense",
  income: "text-income",
  transfer: "text-transfer",
}

export function RecurringPage() {
  const { data: rules, isLoading, occurrences } = useDueRecurringOccurrences()
  const updateRule = useUpdateRecurringRule()

  const [formOpen, setFormOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<RecurringRule | null>(null)

  const active = (rules ?? []).filter((r) => r.is_active)
  const inactive = (rules ?? []).filter((r) => !r.is_active)

  const openCreate = () => {
    setEditingRule(null)
    setFormOpen(true)
  }

  const openEdit = (rule: RecurringRule) => {
    setEditingRule(rule)
    setFormOpen(true)
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
          <h1 className="text-lg font-semibold">Ismétlődő tételek</h1>
          <p className="text-sm text-muted-foreground">
            Az esedékes tételeket az app felajánlja — automatikusan nem könyvel.
          </p>
        </div>
        <Button type="button" size="icon" onClick={openCreate} aria-label="Új ismétlődő tétel">
          <Plus className="size-5" />
        </Button>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Betöltés…</p>}

      {occurrences.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold">Most esedékes ({occurrences.length})</h2>
          <DueOccurrenceList occurrences={occurrences} />
        </section>
      )}

      {!isLoading && (rules?.length ?? 0) === 0 && (
        <p className="text-sm text-muted-foreground">
          Még nincs ismétlődő tétel. Vedd fel az albérletet, az előfizetéseket vagy a
          biztosítást — a jobb felső gombbal.
        </p>
      )}

      {active.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold">Aktív szabályok</h2>
          <ul className="flex flex-col gap-2">
            {active.map((rule) => (
              <RuleRow
                key={rule.id}
                rule={rule}
                onEdit={() => openEdit(rule)}
                onToggleActive={() => updateRule.mutate({ id: rule.id, is_active: false })}
              />
            ))}
          </ul>
        </section>
      )}

      {inactive.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="mt-2 text-sm font-semibold text-muted-foreground">Szüneteltetett</h2>
          <ul className="flex flex-col gap-2">
            {inactive.map((rule) => (
              <RuleRow
                key={rule.id}
                rule={rule}
                paused
                onEdit={() => openEdit(rule)}
                onToggleActive={() => updateRule.mutate({ id: rule.id, is_active: true })}
              />
            ))}
          </ul>
        </section>
      )}

      <RecurringFormSheet open={formOpen} onOpenChange={setFormOpen} rule={editingRule} />
    </div>
  )
}

function RuleRow({
  rule,
  paused,
  onEdit,
  onToggleActive,
}: {
  rule: RecurringRule
  paused?: boolean
  onEdit: () => void
  onToggleActive: () => void
}) {
  const labels = useRecurringLabels()
  const anchor = describeAnchor(rule)
  const finished = isFinished(rule)

  return (
    <li className={cn("flex flex-col gap-2 rounded-xl border border-border bg-card p-3", paused && "opacity-70")}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{labels.title(rule)}</p>
          <p className="text-xs text-muted-foreground">
            {describeSchedule(rule.frequency, rule.interval_count)}
            {anchor && ` · ${anchor}`}
            {" · "}
            {labels.accountPath(rule)}
          </p>
        </div>
        <p className={cn("shrink-0 font-medium tabular-nums", AMOUNT_CLASS[rule.template.direction])}>
          {formatCentsAsHuf(toCents(rule.template.amount))}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
          {finished
            ? `Lezárult ${format(parseISO(rule.end_date!), "yyyy. MMM d.", { locale: hu })}`
            : `Következő: ${format(parseISO(rule.next_run), "yyyy. MMM d.", { locale: hu })}`}
          {rule.end_date && !finished &&
            ` · eddig: ${format(parseISO(rule.end_date), "yyyy. MMM d.", { locale: hu })}`}
        </p>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={paused ? "Folytatás" : "Szüneteltetés"}
          onClick={onToggleActive}
        >
          {paused ? <Play className="size-4" /> : <Pause className="size-4" />}
        </Button>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Szerkesztés" onClick={onEdit}>
          <Pencil className="size-4" />
        </Button>
      </div>
    </li>
  )
}
