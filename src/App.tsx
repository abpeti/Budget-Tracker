import { BrowserRouter, Routes, Route } from "react-router-dom"
import { ProtectedRoute } from "@/components/auth/protected-route"
import { AppLayout } from "@/components/layout/app-layout"
import { LoginPage } from "@/pages/login-page"
import { QuickEntryPage } from "@/pages/quick-entry-page"
import { TransactionsPage } from "@/pages/transactions-page"
import { ReportsPage } from "@/pages/reports-page"
import { AccountsPage } from "@/pages/accounts-page"
import { CategoriesPage } from "@/pages/categories-page"
import { SettingsPage } from "@/pages/settings-page"

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<QuickEntryPage />} />
          <Route path="/transactions" element={<TransactionsPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/accounts" element={<AccountsPage />} />
          <Route path="/categories" element={<CategoriesPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
