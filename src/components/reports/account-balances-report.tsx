import { useMemo } from "react"
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CsvExportButton } from "@/components/reports/csv-export-button"
import { useAccountBalances } from "@/lib/queries/account-balances"
import { useAccounts } from "@/lib/queries/accounts"
import { useReportTransactions, getLast12Months } from "@/lib/queries/reports"
import { formatCentsAsHuf, toCents } from "@/lib/money"

const MONTHS = getLast12Months()

export function AccountBalancesReport() {
  const { data: accounts } = useAccounts()
  const { balances, netWorth } = useAccountBalances()
  const { data: transactions } = useReportTransactions()

  const netWorthHistory = useMemo(() => {
    const running = new Map<string, number>()
    for (const account of accounts ?? []) {
      running.set(account.id, toCents(account.opening_balance))
    }

    const sorted = transactions ?? []
    let idx = 0
    return MONTHS.map((m) => {
      while (idx < sorted.length && sorted[idx].occurred_at <= m.to) {
        const tx = sorted[idx]
        const cents = toCents(tx.amount)
        if (tx.direction === "expense") {
          running.set(tx.account_id, (running.get(tx.account_id) ?? 0) - cents)
        } else if (tx.direction === "income") {
          running.set(tx.account_id, (running.get(tx.account_id) ?? 0) + cents)
        } else if (tx.direction === "transfer") {
          running.set(tx.account_id, (running.get(tx.account_id) ?? 0) - cents)
          if (tx.to_account_id) {
            running.set(tx.to_account_id, (running.get(tx.to_account_id) ?? 0) + cents)
          }
        }
        idx++
      }
      const total = [...running.values()].reduce((sum, v) => sum + v, 0)
      return { label: m.label, month: m.key, huf: Math.trunc(total / 100) }
    })
  }, [accounts, transactions])

  const csvRows = [
    ...(accounts ?? []).map((a) => ["account", a.name, Math.trunc((balances.get(a.id) ?? 0) / 100)]),
    ...netWorthHistory.map((row) => ["net_worth", row.month, row.huf]),
  ]

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Számlaegyenlegek</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {(accounts ?? []).map((account) => (
            <div key={account.id} className="flex items-center justify-between text-sm">
              <span>{account.name}</span>
              <span className="tabular-nums font-medium">
                {formatCentsAsHuf(balances.get(account.id) ?? 0)}
              </span>
            </div>
          ))}
          <div className="mt-2 flex items-center justify-between border-t border-border pt-2 text-sm font-semibold">
            <span>Összvagyon</span>
            <span className="tabular-nums">{formatCentsAsHuf(netWorth)}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Összvagyon alakulása (elmúlt 12 hónap)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={netWorthHistory} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
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
                formatter={(v) => [`${new Intl.NumberFormat("hu-HU").format(Number(v ?? 0))} Ft`, "Összvagyon"]}
              />
              <Line
                type="monotone"
                dataKey="huf"
                stroke="var(--color-primary)"
                strokeWidth={2}
                dot={{ r: 4, strokeWidth: 2, stroke: "var(--color-card)" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <CsvExportButton
        filename="szamlaegyenlegek.csv"
        headers={["type", "label", "amount"]}
        rows={csvRows}
      />
    </div>
  )
}
