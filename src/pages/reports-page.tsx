import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PeriodSelector, getDefaultRange, type ReportRange } from "@/components/reports/period-selector"
import { MonthlyOverviewReport } from "@/components/reports/monthly-overview-report"
import { CategoryBreakdownReport } from "@/components/reports/category-breakdown-report"
import { TrendReport } from "@/components/reports/trend-report"
import { BudgetsReport } from "@/components/reports/budgets-report"
import { AccountBalancesReport } from "@/components/reports/account-balances-report"

export function ReportsPage() {
  const [range, setRange] = useState<ReportRange>(getDefaultRange)

  return (
    <div className="flex flex-col gap-4 p-4 pt-6">
      <h1 className="text-lg font-semibold">Riportok</h1>

      <PeriodSelector value={range} onChange={setRange} />

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Havi áttekintés</TabsTrigger>
          <TabsTrigger value="categories">Kategóriabontás</TabsTrigger>
          <TabsTrigger value="trend">Trend</TabsTrigger>
          <TabsTrigger value="budgets">Keretek</TabsTrigger>
          <TabsTrigger value="accounts">Számlaegyenlegek</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="pt-4">
          <MonthlyOverviewReport from={range.from} to={range.to} />
        </TabsContent>
        <TabsContent value="categories" className="pt-4">
          <CategoryBreakdownReport from={range.from} to={range.to} />
        </TabsContent>
        <TabsContent value="trend" className="pt-4">
          <TrendReport />
        </TabsContent>
        <TabsContent value="budgets" className="pt-4">
          <BudgetsReport />
        </TabsContent>
        <TabsContent value="accounts" className="pt-4">
          <AccountBalancesReport />
        </TabsContent>
      </Tabs>
    </div>
  )
}
