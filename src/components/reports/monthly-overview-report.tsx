import { useMemo } from "react"
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { format } from "date-fns"
import { hu } from "date-fns/locale"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CsvExportButton } from "@/components/reports/csv-export-button"
import { useReportTransactions } from "@/lib/queries/reports"
import { useAccounts } from "@/lib/queries/accounts"
import { useCategories } from "@/lib/queries/categories"
import { formatCentsAsHuf, toCents } from "@/lib/money"

interface MonthlyOverviewReportProps {
  from?: string
  to?: string
}

export function MonthlyOverviewReport({ from, to }: MonthlyOverviewReportProps) {
  const { data: transactions } = useReportTransactions()
  const { data: accounts } = useAccounts()
  const { data: categories } = useCategories()

  const accountMap = useMemo(() => new Map((accounts ?? []).map((a) => [a.id, a])), [accounts])
  const categoryMap = useMemo(() => new Map((categories ?? []).map((c) => [c.id, c])), [categories])

  const inPeriod = useMemo(
    () =>
      (transactions ?? []).filter(
        (tx) => (!from || tx.occurred_at >= from) && (!to || tx.occurred_at <= to)
      ),
    [transactions, from, to]
  )

  const { incomeCents, expenseCents } = useMemo(() => {
    let incomeCents = 0
    let expenseCents = 0
    for (const tx of inPeriod) {
      const cents = toCents(tx.amount)
      if (tx.direction === "income") incomeCents += cents
      else if (tx.direction === "expense") expenseCents += cents
    }
    return { incomeCents, expenseCents }
  }, [inPeriod])

  const dailySpending = useMemo(() => {
    const byDay = new Map<string, number>()
    for (const tx of inPeriod) {
      if (tx.direction !== "expense") continue
      byDay.set(tx.occurred_at, (byDay.get(tx.occurred_at) ?? 0) + toCents(tx.amount))
    }
    return [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, cents]) => ({
        date,
        label: format(new Date(date), "MMM d.", { locale: hu }),
        huf: Math.trunc(cents / 100),
      }))
  }, [inPeriod])

  const csvRows = useMemo(
    () =>
      inPeriod.map((tx) => {
        const category = tx.category_id ? categoryMap.get(tx.category_id) : null
        const parentCategory = category?.parent_id ? categoryMap.get(category.parent_id) : null
        return [
          tx.occurred_at,
          tx.direction,
          (tx.direction === "expense" ? -1 : 1) * toCents(tx.amount) / 100,
          accountMap.get(tx.account_id)?.name ?? "",
          parentCategory?.name ?? category?.name ?? "",
          parentCategory ? category?.name ?? "" : "",
          tx.payee ?? "",
          tx.note ?? "",
        ]
      }),
    [inPeriod, accountMap, categoryMap]
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-2">
        <Card className="gap-1 p-3">
          <p className="text-xs text-muted-foreground">Bevétel</p>
          <p className="truncate text-lg font-semibold tabular-nums text-income">
            {formatCentsAsHuf(incomeCents)}
          </p>
        </Card>
        <Card className="gap-1 p-3">
          <p className="text-xs text-muted-foreground">Kiadás</p>
          <p className="truncate text-lg font-semibold tabular-nums text-expense">
            {formatCentsAsHuf(expenseCents)}
          </p>
        </Card>
        <Card className="gap-1 p-3">
          <p className="text-xs text-muted-foreground">Egyenleg</p>
          <p className="truncate text-lg font-semibold tabular-nums">
            {formatCentsAsHuf(incomeCents - expenseCents)}
          </p>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Napi költés</CardTitle>
        </CardHeader>
        <CardContent>
          {dailySpending.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nincs kiadás ebben az időszakban.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={dailySpending} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--color-border)" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                  axisLine={{ stroke: "var(--color-border)" }}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                  width={48}
                  tickFormatter={(v: number) => new Intl.NumberFormat("hu-HU").format(v)}
                />
                <Tooltip
                  cursor={{ fill: "var(--color-secondary)" }}
                  contentStyle={{
                    background: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(v) => [`${new Intl.NumberFormat("hu-HU").format(Number(v ?? 0))} Ft`, "Kiadás"]}
                />
                <Bar dataKey="huf" fill="var(--color-expense)" radius={[4, 4, 0, 0]} maxBarSize={24} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <CsvExportButton
        filename="havi-attekintes.csv"
        headers={[
          "occurred_at",
          "direction",
          "signed_amount",
          "account_name",
          "parent_category_name",
          "category_name",
          "payee",
          "note",
        ]}
        rows={csvRows}
      />
    </div>
  )
}
