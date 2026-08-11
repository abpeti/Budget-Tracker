import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/auth-context"
import type { AccountType } from "@/lib/database.types"

export interface Account {
  id: string
  name: string
  type: AccountType
  currency: string
  opening_balance: number
  icon: string | null
  color: string | null
  is_archived: boolean
  sort_order: number
}

const accountsKey = (userId: string | undefined) => ["accounts", userId] as const

export function useAccounts(options?: { includeArchived?: boolean }) {
  const { user } = useAuth()
  const includeArchived = options?.includeArchived ?? false

  return useQuery({
    queryKey: [...accountsKey(user?.id), { includeArchived }],
    enabled: !!user,
    queryFn: async (): Promise<Account[]> => {
      let query = supabase
        .from("accounts")
        .select(
          "id, name, type, currency, opening_balance, icon, color, is_archived, sort_order"
        )
        .order("sort_order", { ascending: true })

      if (!includeArchived) {
        query = query.eq("is_archived", false)
      }

      const { data, error } = await query
      if (error) throw error
      return data
    },
  })
}

export function useCreateAccount() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: {
      name: string
      type: AccountType
      opening_balance?: number
      icon?: string | null
      color?: string | null
      sort_order?: number
    }) => {
      if (!user) throw new Error("Nincs bejelentkezett felhasználó.")
      const { data, error } = await supabase
        .from("accounts")
        .insert({ ...input, user_id: user.id })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: accountsKey(user?.id) })
    },
  })
}

export function useUpdateAccount() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      ...patch
    }: {
      id: string
      name?: string
      type?: AccountType
      icon?: string | null
      color?: string | null
      is_archived?: boolean
      sort_order?: number
    }) => {
      const { data, error } = await supabase
        .from("accounts")
        .update(patch)
        .eq("id", id)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: accountsKey(user?.id) })
    },
  })
}
