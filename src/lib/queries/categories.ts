import { useMemo } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/auth-context"
import type { CategoryKind } from "@/lib/database.types"

export interface Category {
  id: string
  parent_id: string | null
  name: string
  kind: CategoryKind
  icon: string | null
  color: string | null
  is_archived: boolean
  sort_order: number
}

export interface CategoryWithChildren extends Category {
  children: Category[]
}

const categoriesKey = (userId: string | undefined) => ["categories", userId] as const

export function useCategories(options?: { includeArchived?: boolean }) {
  const { user } = useAuth()
  const includeArchived = options?.includeArchived ?? false

  return useQuery({
    queryKey: [...categoriesKey(user?.id), { includeArchived }],
    enabled: !!user,
    queryFn: async (): Promise<Category[]> => {
      let query = supabase
        .from("categories")
        .select("id, parent_id, name, kind, icon, color, is_archived, sort_order")
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

/** Fő- és alkategóriák fastruktúrába rendezve, iránytípus szerint szűrve. */
export function useCategoryTree(kind: CategoryKind, options?: { includeArchived?: boolean }) {
  const { data, ...rest } = useCategories({ includeArchived: options?.includeArchived })

  const tree = useMemo<CategoryWithChildren[]>(() => {
    if (!data) return []
    const byKind = data.filter((c) => c.kind === kind)
    const mains = byKind
      .filter((c) => c.parent_id === null)
      .sort((a, b) => a.sort_order - b.sort_order)
    return mains.map((main) => ({
      ...main,
      children: byKind
        .filter((c) => c.parent_id === main.id)
        .sort((a, b) => a.sort_order - b.sort_order),
    }))
  }, [data, kind])

  return { tree, ...rest }
}

export function useCreateCategory() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: {
      name: string
      kind: CategoryKind
      parent_id?: string | null
      icon?: string | null
      color?: string | null
      sort_order?: number
    }) => {
      if (!user) throw new Error("Nincs bejelentkezett felhasználó.")
      const { data, error } = await supabase
        .from("categories")
        .insert({ ...input, user_id: user.id })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: categoriesKey(user?.id) })
    },
  })
}

export function useUpdateCategory() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      ...patch
    }: {
      id: string
      name?: string
      parent_id?: string | null
      icon?: string | null
      color?: string | null
      is_archived?: boolean
      sort_order?: number
    }) => {
      const { data, error } = await supabase
        .from("categories")
        .update(patch)
        .eq("id", id)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: categoriesKey(user?.id) })
    },
  })
}
