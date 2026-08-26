import { useQuery } from "@tanstack/react-query"
import { endOfMonth, format, startOfMonth, subMonths } from "date-fns"
import { hu } from "date-fns/locale"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/auth-context"
import type { TransactionDirection } from "@/lib/database.types"

export interface ReportMonth {
  key: string
  label: string
  from: string
  to: string
}

/** Az elmúlt 12 naptári hónap (a jelenlegit is beleértve), időrendben. */
export function getLast12Months(): ReportMonth[] {
  return Array.from({ length: 12 }, (_, i) => {
    const d = subMonths(new Date(), 11 - i)
    return {
      key: format(d, "yyyy-MM"),
      label: format(d, "MMM", { locale: hu }),
      from: format(startOfMonth(d), "yyyy-MM-dd"),
      to: format(endOfMonth(d), "yyyy-MM-dd"),
    }
  })
}

export interface ReportTransaction {
  id: string
  occurred_at: string
  direction: TransactionDirection
  amount: number
  account_id: string
  to_account_id: string | null
  category_id: string | null
  payee: string | null
  note: string | null
}

const reportTransactionsKey = (userId: string | undefined) =>
  ["report-transactions", userId] as const

/**
 * A teljes tranzakciótörténet egyszeri lekérése — a riportok (havi áttekintés,
 * kategóriabontás, trend, számlaegyenleg-történet) mind ebből a gyorsítótárazott
 * tömbből számolnak kliensoldalon, ahogy az account-balances.ts is teszi a
 * v_* nézetek elkészültéig.
 */
export function useReportTransactions() {
  const { user } = useAuth()

  return useQuery({
    queryKey: reportTransactionsKey(user?.id),
    enabled: !!user,
    queryFn: async (): Promise<ReportTransaction[]> => {
      const { data, error } = await supabase
        .from("transactions")
        .select(
          "id, occurred_at, direction, amount, account_id, to_account_id, category_id, payee, note"
        )
        .order("occurred_at", { ascending: true })
      if (error) throw error
      return data
    },
  })
}
