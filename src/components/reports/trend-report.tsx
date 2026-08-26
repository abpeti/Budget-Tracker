import { useMemo, useState } from "react"
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CsvExportButton } from "@/components/reports/csv-export-button"
import { useReportTransactions, getLast12Months } from "@/lib/queries/reports"
import { useCategories } from "@/lib/queries/categories"
import { toCents } from "@/lib/money"

const MONTHS = getLast12Months()

export function TrendReport() {
  const [categoryId, setCategoryId] = useState<string>("")

  const { data: transactions } = useReportTransactions()
  const { data: categories } = useCategories()

  const selectedCategory = categories?.find((c) => c.id === categoryId)
  const scopeIds = useMemo(() => {
    if (!categoryId) return null
    const ids = new Set([categoryId])
    for (const c of categories ?? []) {
      if (c.parent_id === categoryId) ids.add(c.id)
    }
    return ids
  }, [categoryId, categories])

  const data = useMemo(() => {
    return MONTHS.map((m) => {
      let expense = 0
      let income = 0
      for (const tx of transactions ?? []) {
        if (tx.occurred_at < m.from || tx.occurred_at > m.to) continue
        if (scopeIds && (!tx.category_id || !scopeIds.has(tx.category_id))) continue
        const cents = toCents(tx.amount)
        if (tx.direction === "expense") expense += cents
        else if (tx.direction === "income") income += cents
      }
      return {
        label: m.label,
        month: m.key,
        expense: Math.trunc(expense / 100),
        income: Math.trunc(income / 100),
      }
    })
  }, [transactions, scopeIds])

  const singleSeriesKey = selectedCategory?.kind === "income" ? "income" : "expense"

  const csvRows = data.map((row) =>
    selectedCategory ? [row.month, row[singleSeriesKey]] : [row.month, row.expense, row.income]
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="h-12 w-full rounded-md border border-input bg-transparent px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <option value="">Összes kategória</option>
          {categories?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.parent_id ? `— ${c.name}` : c.name}
            </option>
          ))}
        </select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Trend (elmúlt 12 hónap)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                axisLine={{ stroke: "var(--color-border)" }}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                axisLine={false}
                tickLine={false}
                width={48}
                tickFormatter={(v: number) => new Intl.NumberFormat("hu-HU").format(v)}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--color-card)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(v) => `${new Intl.NumberFormat("hu-HU").format(Number(v ?? 0))} Ft`}
              />
              {selectedCategory ? (
                <Line
                  type="monotone"
                  dataKey={singleSeriesKey}
                  name={selectedCategory.name}
                  stroke={selectedCategory.color ?? "var(--color-primary)"}
                  strokeWidth={2}
                  dot={{ r: 4, strokeWidth: 2, stroke: "var(--color-card)" }}
                />
              ) : (
                <>
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line
                    type="monotone"
                    dataKey="expense"
                    name="Kiadás"
                    stroke="var(--color-expense)"
                    strokeWidth={2}
                    dot={{ r: 4, strokeWidth: 2, stroke: "var(--color-card)" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="income"
                    name="Bevétel"
                    stroke="var(--color-income)"
                    strokeWidth={2}
                    dot={{ r: 4, strokeWidth: 2, stroke: "var(--color-card)" }}
                  />
                </>
              )}
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <CsvExportButton
        filename="trend.csv"
        headers={selectedCategory ? ["month", "total"] : ["month", "expense_total", "income_total"]}
        rows={csvRows}
      />
    </div>
  )
}
