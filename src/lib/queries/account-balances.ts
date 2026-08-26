import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/auth-context"
import { useAccounts } from "@/lib/queries/accounts"
import { toCents } from "@/lib/money"

interface TxEffectRow {
  direction: "expense" | "income" | "transfer"
  amount: number
  account_id: string
  to_account_id: string | null
}

/**
 * Számlaegyenlegek kliensoldali számítása, kizárólag egész fillér
 * aritmetikával (nincs lebegőpontos összegzés). A v_account_balances
 * nézet a 3. fázisban (BI-szerződés) készül el — addig ugyanezt a
 * logikát itt, a tranzakciók összesítésével számoljuk.
 *
 * A visszaadott Map és netWorth értékek fillérben (egész szám) vannak —
 * megjelenítéshez formatCentsAsHuf-fal alakítandók.
 */
export function useAccountBalances() {
  const { user } = useAuth()
  const { data: accounts } = useAccounts()

  const effects = useQuery({
    queryKey: ["account-balances", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<TxEffectRow[]> => {
      const { data, error } = await supabase
        .from("transactions")
        .select("direction, amount, account_id, to_account_id")
      if (error) throw error
      return data
    },
  })

  const balances = useMemo(() => {
    const map = new Map<string, number>()
    for (const account of accounts ?? []) {
      map.set(account.id, toCents(account.opening_balance))
    }
    for (const tx of effects.data ?? []) {
      const cents = toCents(tx.amount)
      if (tx.direction === "expense") {
        map.set(tx.account_id, (map.get(tx.account_id) ?? 0) - cents)
      } else if (tx.direction === "income") {
        map.set(tx.account_id, (map.get(tx.account_id) ?? 0) + cents)
      } else if (tx.direction === "transfer") {
        map.set(tx.account_id, (map.get(tx.account_id) ?? 0) - cents)
        if (tx.to_account_id) {
          map.set(tx.to_account_id, (map.get(tx.to_account_id) ?? 0) + cents)
        }
      }
    }
    return map
  }, [accounts, effects.data])

  const netWorth = useMemo(
    () => (accounts ?? []).reduce((sum, a) => sum + (balances.get(a.id) ?? 0), 0),
    [accounts, balances]
  )

  return { balances, netWorth, isLoading: effects.isLoading }
}
