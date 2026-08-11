import { useMemo } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/auth-context"
import type { TransactionDirection } from "@/lib/database.types"

export interface Transaction {
  id: string
  occurred_at: string
  direction: TransactionDirection
  amount: number
  account_id: string
  to_account_id: string | null
  category_id: string | null
  payee: string | null
  note: string | null
  created_at: string
}

const transactionsKey = (userId: string | undefined) => ["transactions", userId] as const
const frequentCategoriesKey = (userId: string | undefined) =>
  ["frequent-categories", userId] as const
const accountBalancesKey = (userId: string | undefined) =>
  ["account-balances", userId] as const

export interface NewTransactionInput {
  direction: TransactionDirection
  amount: number
  account_id: string
  to_account_id?: string | null
  category_id?: string | null
  occurred_at: string
  payee?: string | null
  note?: string | null
}

export function useCreateTransaction() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: NewTransactionInput) => {
      if (!user) throw new Error("Nincs bejelentkezett felhasználó.")
      const { data, error } = await supabase
        .from("transactions")
        .insert({ ...input, user_id: user.id })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: transactionsKey(user?.id) })
      queryClient.invalidateQueries({ queryKey: frequentCategoriesKey(user?.id) })
      queryClient.invalidateQueries({ queryKey: accountBalancesKey(user?.id) })
    },
  })
}

export function useDeleteTransaction() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("transactions").delete().eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: transactionsKey(user?.id) })
      queryClient.invalidateQueries({ queryKey: frequentCategoriesKey(user?.id) })
      queryClient.invalidateQueries({ queryKey: accountBalancesKey(user?.id) })
    },
  })
}

/** Az elmúlt 30 nap leggyakrabban használt kategóriái, használat szerint rendezve. */
export function useFrequentCategoryIds(limit = 8) {
  const { user } = useAuth()

  const query = useQuery({
    queryKey: frequentCategoriesKey(user?.id),
    enabled: !!user,
    queryFn: async (): Promise<string[]> => {
      const since = new Date()
      since.setDate(since.getDate() - 30)
      const sinceStr = since.toISOString().slice(0, 10)

      const { data, error } = await supabase
        .from("transactions")
        .select("category_id")
        .not("category_id", "is", null)
        .gte("occurred_at", sinceStr)

      if (error) throw error

      const counts = new Map<string, number>()
      for (const row of data) {
        const id = row.category_id as string
        counts.set(id, (counts.get(id) ?? 0) + 1)
      }

      return [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([id]) => id)
    },
  })

  const ids = useMemo(() => query.data?.slice(0, limit) ?? [], [query.data, limit])

  return { ...query, ids }
}
