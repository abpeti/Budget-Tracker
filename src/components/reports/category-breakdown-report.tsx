import { useCallback, useMemo, useState } from "react"
import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { ChevronLeft } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CsvExportButton } from "@/components/reports/csv-export-button"
import { useReportTransactions, type ReportTransaction } from "@/lib/queries/reports"
import { useAccounts } from "@/lib/queries/accounts"
import { useCategories, type Category } from "@/lib/queries/categories"
import { formatCentsAsHuf, toCents } from "@/lib/money"
import { cn } from "@/lib/utils"

interface CategoryBreakdownReportProps {
  from?: string
  to?: string
}

type Direction = "expense" | "income"

type Drill =
  | { level: "main" }
  | { level: "sub"; mainId: string }
  | { level: "tx"; categoryId: string; label: string; back: Drill }

const NO_CATEGORY_ID = "__none__"

function bucketLabel(cat: Category | undefined) {
  return cat?.name ?? "Nincs kategória"
}

export function CategoryBreakdownReport({ from, to }: CategoryBreakdownReportProps) {
  const [direction, setDirection] = useState<Direction>("expense")
  const [drill, setDrill] = useState<Drill>({ level: "main" })

  const { data: transactions } = useReportTransactions()
  const { data: accounts } = useAccounts()
  const { data: categories } = useCategories()

  const categoryMap = useMemo(() => new Map((categories ?? []).map((c) => [c.id, c])), [categories])
  const accountMap = useMemo(() => new Map((accounts ?? []).map((a) => [a.id, a])), [accounts])

  const inPeriod = useMemo(
    () =>
      (transactions ?? []).filter(
        (tx) =>
          tx.direction === direction &&
          (!from || tx.occurred_at >= from) &&
          (!to || tx.occurred_at <= to)
      ),
    [transactions, direction, from, to]
  )

  const mainIdOf = useCallback(
    (tx: ReportTransaction): { id: string; cat: Category | undefined } => {
      if (!tx.category_id) return { id: NO_CATEGORY_ID, cat: undefined }
      const cat = categoryMap.get(tx.category_id)
      if (!cat) return { id: NO_CATEGORY_ID, cat: undefined }
      if (!cat.parent_id) return { id: cat.id, cat }
      const parent = categoryMap.get(cat.parent_id)
      return parent ? { id: parent.id, cat: parent } : { id: cat.id, cat }
    },
    [categoryMap]
  )

  const mainTotals = useMemo(() => {
    const totals = new Map<string, { cat: Category | undefined; cents: number }>()
    for (const tx of inPeriod) {
      const { id, cat } = mainIdOf(tx)
      const entry = totals.get(id) ?? { cat, cents: 0 }
      entry.cents += toCents(tx.amount)
      totals.set(id, entry)
    }
    return [...totals.entries()]
      .map(([id, v]) => ({
        id,
        name: bucketLabel(v.cat),
        color: v.cat?.color ?? "var(--color-muted-foreground)",
        huf: Math.trunc(v.cents / 100),
      }))
      .sort((a, b) => b.huf - a.huf)
  }, [inPeriod, mainIdOf])

  const childrenOfMain = useMemo(() => {
    if (drill.level !== "sub") return []
    return (categories ?? []).filter((c) => c.parent_id === drill.mainId)
  }, [categories, drill])

  const subTotals = useMemo(() => {
    if (drill.level !== "sub") return []
    const childIds = new Set(childrenOfMain.map((c) => c.id))
    const totals = new Map<string, { cat: Category | undefined; cents: number }>()
    for (const tx of inPeriod) {
      if (!tx.category_id) continue
      if (tx.category_id !== drill.mainId && !childIds.has(tx.category_id)) continue
      const cat = categoryMap.get(tx.category_id)
      const entry = totals.get(tx.category_id) ?? { cat, cents: 0 }
      entry.cents += toCents(tx.amount)
      totals.set(tx.category_id, entry)
    }
    return [...totals.entries()]
      .map(([id, v]) => ({
        id,
        name: bucketLabel(v.cat),
        color: v.cat?.color ?? "var(--color-muted-foreground)",
        huf: Math.trunc(v.cents / 100),
      }))
      .sort((a, b) => b.huf - a.huf)
  }, [inPeriod, drill, childrenOfMain, categoryMap])

  const txList = useMemo(() => {
    if (drill.level !== "tx") return []
    return inPeriod
      .filter((tx) => (drill.categoryId === NO_CATEGORY_ID ? !tx.category_id : tx.category_id === drill.categoryId))
      .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))
  }, [inPeriod, drill])

  const chartData = drill.level === "sub" ? subTotals : mainTotals
  const barHeight = Math.max(chartData.length * 36, 60)

  const handleBarClick = (id: string) => {
    if (drill.level === "main") {
      const hasChildren = (categories ?? []).some((c) => c.parent_id === id)
      if (id !== NO_CATEGORY_ID && hasChildren) {
        setDrill({ level: "sub", mainId: id })
      } else {
        const entry = mainTotals.find((m) => m.id === id)
        setDrill({ level: "tx", categoryId: id, label: entry?.name ?? "", back: drill })
      }
    } else if (drill.level === "sub") {
      const entry = subTotals.find((s) => s.id === id)
      setDrill({ level: "tx", categoryId: id, label: entry?.name ?? "", back: drill })
    }
  }

  const csvRows = useMemo(() => {
    if (drill.level === "tx") {
      return txList.map((tx) => [
        tx.occurred_at,
        accountMap.get(tx.account_id)?.name ?? "",
        Math.trunc(toCents(tx.amount) / 100),
        tx.payee ?? "",
        tx.note ?? "",
      ])
    }
    return chartData.map((row) => [row.name, row.huf])
  }, [drill, txList, chartData, accountMap])

  return (
    <div className="flex flex-col gap-4">
      {drill.level === "main" && (
        <div className="flex gap-2">
          {(["expense", "income"] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDirection(d)}
              className={cn(
                "min-h-9 rounded-full border px-3 text-sm",
                direction === d
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-secondary text-secondary-foreground"
              )}
            >
              {d === "expense" ? "Kiadás" : "Bevétel"}
            </button>
          ))}
        </div>
      )}

      {drill.level !== "main" && (
        <button
          type="button"
          onClick={() => setDrill(drill.level === "tx" ? drill.back : { level: "main" })}
          className="flex items-center gap-1 self-start text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          Vissza
        </button>
      )}

      {drill.level !== "tx" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">
              {drill.level === "main" ? "Főkategóriák" : "Alkategóriák"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {chartData.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Nincs adat.</p>
            ) : (
              <ResponsiveContainer width="100%" height={barHeight}>
                <BarChart
                  data={chartData}
                  layout="vertical"
                  margin={{ left: 0, right: 48, top: 4, bottom: 4 }}
                >
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={100}
                    tick={{ fontSize: 12, fill: "var(--color-foreground)" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: "var(--color-secondary)" }}
                    contentStyle={{
                      background: "var(--color-card)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    formatter={(v) => [`${new Intl.NumberFormat("hu-HU").format(Number(v ?? 0))} Ft`, "Összeg"]}
                  />
                  <Bar
                    dataKey="huf"
                    radius={[0, 4, 4, 0]}
                    maxBarSize={24}
                    onClick={(d) => handleBarClick((d as unknown as { payload: { id: string } }).payload.id)}
                    className="cursor-pointer"
                  >
                    {chartData.map((entry) => (
                      <Cell key={entry.id} fill={entry.color ?? undefined} />
                    ))}
                    <LabelList
                      dataKey="huf"
                      position="right"
                      formatter={(v) => new Intl.NumberFormat("hu-HU").format(Number(v ?? 0))}
                      style={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{drill.label}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {txList.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Nincs tranzakció.</p>
            ) : (
              <ul className="flex flex-col overflow-hidden rounded-xl border border-border">
                {txList.map((tx) => (
                  <li
                    key={tx.id}
                    className="flex items-center justify-between gap-3 border-b border-border bg-card px-3 py-3 last:border-b-0"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{tx.payee || "—"}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {[accountMap.get(tx.account_id)?.name, tx.note].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <p
                      className={cn(
                        "shrink-0 tabular-nums font-medium",
                        direction === "expense" ? "text-expense" : "text-income"
                      )}
                    >
                      {direction === "expense" ? "−" : "+"}
                      {formatCentsAsHuf(toCents(tx.amount))}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      <CsvExportButton
        filename="kategoriabontas.csv"
        headers={
          drill.level === "tx"
            ? ["occurred_at", "account_name", "amount", "payee", "note"]
            : ["category_name", "amount"]
        }
        rows={csvRows}
      />
    </div>
  )
}
