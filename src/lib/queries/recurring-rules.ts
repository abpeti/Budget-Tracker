import { useMemo } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/auth-context"
import type { RecurringFrequency, RecurringTemplate } from "@/lib/database.types"
import { transactionRelatedQueryKeys } from "@/lib/queries/transactions"
import { dueOccurrences, nextOccurrenceAfter, todayIso } from "@/lib/recurring"

export interface RecurringRule {
  id: string
  name: string | null
  template: RecurringTemplate
  frequency: RecurringFrequency
  interval_count: number
  day_of_period: number
  next_run: string
  end_date: string | null
  last_run: string | null
  is_active: boolean
  created_at: string
}

export interface RecurringRuleInput {
  name?: string | null
  template: RecurringTemplate
  frequency: RecurringFrequency
  interval_count: number
  day_of_period: number
  next_run: string
  end_date?: string | null
  is_active?: boolean
}

const SELECT_COLUMNS =
  "id, name, template, frequency, interval_count, day_of_period, next_run, end_date, last_run, is_active, created_at"

const recurringRulesKey = (userId: string | undefined) => ["recurring-rules", userId] as const

export function useRecurringRules() {
  const { user } = useAuth()

  return useQuery({
    queryKey: recurringRulesKey(user?.id),
    enabled: !!user,
    queryFn: async (): Promise<RecurringRule[]> => {
      const { data, error } = await supabase
        .from("recurring_rules")
        .select(SELECT_COLUMNS)
        .order("is_active", { ascending: false })
        .order("next_run", { ascending: true })
      if (error) throw error
      return data as RecurringRule[]
    },
  })
}

export function useCreateRecurringRule() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: RecurringRuleInput) => {
      if (!user) throw new Error("Nincs bejelentkezett felhasználó.")
      const { data, error } = await supabase
        .from("recurring_rules")
        .insert({ ...input, user_id: user.id })
        .select(SELECT_COLUMNS)
        .single()
      if (error) throw error
      return data as RecurringRule
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: recurringRulesKey(user?.id) })
    },
  })
}

export function useUpdateRecurringRule() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<RecurringRuleInput> & { id: string }) => {
      const { data, error } = await supabase
        .from("recurring_rules")
        .update(patch)
        .eq("id", id)
        .select(SELECT_COLUMNS)
        .single()
      if (error) throw error
      return data as RecurringRule
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: recurringRulesKey(user?.id) })
    },
  })
}

export function useDeleteRecurringRule() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("recurring_rules").delete().eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: recurringRulesKey(user?.id) })
    },
  })
}

export interface DueOccurrence {
  rule: RecurringRule
  /** Az esedékesség napja — ez lesz a rögzített tétel occurred_at értéke. */
  date: string
}

/**
 * A ma esedékes (és az elmaradt) előfordulások, dátum szerint növekvő sorrendben.
 * Nem cron generálja őket: az app minden indulásakor újraszámoljuk a szabályokból.
 */
export function useDueRecurringOccurrences() {
  const query = useRecurringRules()

  const occurrences = useMemo<DueOccurrence[]>(() => {
    const today = todayIso()
    const list: DueOccurrence[] = []
    for (const rule of query.data ?? []) {
      for (const date of dueOccurrences(rule, today)) {
        list.push({ rule, date })
      }
    }
    return list.sort((a, b) => a.date.localeCompare(b.date))
  }, [query.data])

  return { ...query, occurrences }
}

/** A szabály léptetése a megadott előfordulás után (rögzítés vagy kihagyás). */
async function advanceRule(rule: RecurringRule, occurrenceDate: string, recorded: boolean) {
  const next = nextOccurrenceAfter(rule, occurrenceDate)
  const finished = !!rule.end_date && next > rule.end_date

  const { error } = await supabase
    .from("recurring_rules")
    .update({
      next_run: next,
      is_active: finished ? false : rule.is_active,
      ...(recorded ? { last_run: occurrenceDate } : {}),
    })
    .eq("id", rule.id)
  if (error) throw error
}

/** Egy esedékes előfordulás rögzítése tranzakcióként, majd a szabály léptetése. */
export function usePostRecurringOccurrence() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ rule, date }: DueOccurrence) => {
      if (!user) throw new Error("Nincs bejelentkezett felhasználó.")

      // Ugyanaz a szabály ugyanarra a napra csak egyszer könyvelhet — véd a
      // dupla koppintás és a két eszközről párhuzamosan futó rögzítés ellen.
      const { data: existing, error: existingError } = await supabase
        .from("transactions")
        .select("id")
        .eq("source_rule_id", rule.id)
        .eq("occurred_at", date)
        .limit(1)
      if (existingError) throw existingError

      let transactionId = existing[0]?.id ?? null

      if (!transactionId) {
        const t = rule.template
        const isTransfer = t.direction === "transfer"
        const { data, error } = await supabase
          .from("transactions")
          .insert({
            user_id: user.id,
            occurred_at: date,
            direction: t.direction,
            amount: t.amount,
            account_id: t.account_id,
            to_account_id: isTransfer ? (t.to_account_id ?? null) : null,
            category_id: isTransfer ? null : (t.category_id ?? null),
            payee: t.payee ?? null,
            note: t.note ?? null,
            source_rule_id: rule.id,
          })
          .select("id")
          .single()
        if (error) throw error
        transactionId = data.id
      }

      await advanceRule(rule, date, true)
      return transactionId
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: recurringRulesKey(user?.id) })
      for (const key of transactionRelatedQueryKeys(user?.id)) {
        queryClient.invalidateQueries({ queryKey: key })
      }
    },
  })
}

/** Egy esedékes előfordulás kihagyása: tranzakció nélkül lép a szabály. */
export function useSkipRecurringOccurrence() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ rule, date }: DueOccurrence) => {
      await advanceRule(rule, date, false)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: recurringRulesKey(user?.id) })
    },
  })
}
