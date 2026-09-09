import { Outlet } from "react-router-dom"
import { BottomNav } from "./bottom-nav"
import { DueRecurringSheet } from "@/components/recurring/due-recurring-sheet"

export function AppLayout() {
  return (
    <div className="min-h-dvh bg-background">
      <main className="mx-auto max-w-md pb-20">
        <Outlet />
      </main>
      <BottomNav />
      <DueRecurringSheet />
    </div>
  )
}
