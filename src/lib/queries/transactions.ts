import { useMemo } from "react"
import {
  useQuery,
  useMutation,
  useQueryClient,
  useInfiniteQuery,
  type InfiniteData,
} from "@tanstack/react-query"
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
const categoryAccountSuggestionsKey = (userId: string | undefined) =>
  ["category-account-suggestions", userId] as const

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
      queryClient.invalidateQueries({ queryKey: categoryAccountSuggestionsKey(user?.id) })
    },
  })
}

export interface UpdateTransactionInput {
  id: string
  amount?: number
  account_id?: string
  to_account_id?: string | null
  category_id?: string | null
  occurred_at?: string
  payee?: string | null
  note?: string | null
}

export function useUpdateTransaction() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...patch }: UpdateTransactionInput) => {
      const { data, error } = await supabase
        .from("transactions")
        .update(patch)
        .eq("id", id)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: transactionsKey(user?.id) })
      queryClient.invalidateQueries({ queryKey: accountBalancesKey(user?.id) })
      queryClient.invalidateQueries({ queryKey: categoryAccountSuggestionsKey(user?.id) })
    },
  })
}

export interface TransactionFilters {
  from?: string
  to?: string
  accountId?: string | null
  categoryId?: string | null
  direction?: TransactionDirection | null
  search?: string
}

const PAGE_SIZE = 30

export function useTransactionsInfinite(filters: TransactionFilters) {
  const { user } = useAuth()

  return useInfiniteQuery<Transaction[], Error, InfiniteData<Transaction[]>, readonly unknown[], number>({
    queryKey: [...transactionsKey(user?.id), "list", filters],
    enabled: !!user,
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length < PAGE_SIZE ? undefined : allPages.length * PAGE_SIZE,
    queryFn: async ({ pageParam }): Promise<Transaction[]> => {
      let query = supabase
        .from("transactions")
        .select(
          "id, occurred_at, direction, amount, account_id, to_account_id, category_id, payee, note, created_at"
        )
        .order("occurred_at", { ascending: false })
        .order("created_at", { ascending: false })
        .range(pageParam, pageParam + PAGE_SIZE - 1)

      if (filters.from) query = query.gte("occurred_at", filters.from)
      if (filters.to) query = query.lte("occurred_at", filters.to)
      if (filters.accountId) {
        query = query.or(
          `account_id.eq.${filters.accountId},to_account_id.eq.${filters.accountId}`
        )
      }
      if (filters.categoryId) query = query.eq("category_id", filters.categoryId)
      if (filters.direction) query = query.eq("direction", filters.direction)
      if (filters.search) {
        const term = filters.search.replace(/[%,]/g, "")
        query = query.or(`payee.ilike.%${term}%,note.ilike.%${term}%`)
      }

      const { data, error } = await query
      if (error) throw error
      return data
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
      queryClient.invalidateQueries({ queryKey: categoryAccountSuggestionsKey(user?.id) })
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

/** Kategóriánként a legtöbbször használt számla azonosítója, a teljes tranzakciótörténet alapján. */
export function useCategoryAccountSuggestions() {
  const { user } = useAuth()

  return useQuery({
    queryKey: categoryAccountSuggestionsKey(user?.id),
    enabled: !!user,
    queryFn: async (): Promise<Map<string, string>> => {
      const { data, error } = await supabase
        .from("transactions")
        .select("category_id, account_id")
        .not("category_id", "is", null)

      if (error) throw error

      const counts = new Map<string, Map<string, number>>()
      for (const row of data) {
        const categoryId = row.category_id as string
        const accountCounts = counts.get(categoryId) ?? new Map<string, number>()
        accountCounts.set(row.account_id, (accountCounts.get(row.account_id) ?? 0) + 1)
        counts.set(categoryId, accountCounts)
      }

      const suggestions = new Map<string, string>()
      for (const [categoryId, accountCounts] of counts) {
        let bestAccountId: string | null = null
        let bestCount = 0
        for (const [accountId, count] of accountCounts) {
          if (count > bestCount) {
            bestCount = count
            bestAccountId = accountId
          }
        }
        if (bestAccountId) suggestions.set(categoryId, bestAccountId)
      }

      return suggestions
    },
  })
}
