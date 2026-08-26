import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/auth-context"

export interface Budget {
  id: string
  category_id: string
  amount: number
  valid_from: string
  valid_to: string | null
}

const budgetsKey = (userId: string | undefined) => ["budgets", userId] as const

export function useBudgets() {
  const { user } = useAuth()

  return useQuery({
    queryKey: budgetsKey(user?.id),
    enabled: !!user,
    queryFn: async (): Promise<Budget[]> => {
      const { data, error } = await supabase
        .from("budgets")
        .select("id, category_id, amount, valid_from, valid_to")
        .order("valid_from", { ascending: false })
      if (error) throw error
      return data
    },
  })
}

/** Egy keret aktív-e egy adott (ISO) dátumon: valid_from <= date <= valid_to (vagy nyitott végű). */
export function isBudgetActiveOn(budget: Budget, isoDate: string): boolean {
  return budget.valid_from <= isoDate && (!budget.valid_to || budget.valid_to >= isoDate)
}

export function useCreateBudget() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: {
      category_id: string
      amount: number
      valid_from: string
      valid_to?: string | null
    }) => {
      if (!user) throw new Error("Nincs bejelentkezett felhasználó.")
      const { data, error } = await supabase
        .from("budgets")
        .insert({ ...input, user_id: user.id })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: budgetsKey(user?.id) })
    },
  })
}

export function useUpdateBudget() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      ...patch
    }: {
      id: string
      category_id?: string
      amount?: number
      valid_from?: string
      valid_to?: string | null
    }) => {
      const { data, error } = await supabase
        .from("budgets")
        .update(patch)
        .eq("id", id)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: budgetsKey(user?.id) })
    },
  })
}

export function useDeleteBudget() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("budgets").delete().eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: budgetsKey(user?.id) })
    },
  })
}
