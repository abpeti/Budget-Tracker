import { useMemo } from "react"
import { useAccounts } from "@/lib/queries/accounts"
import { useCategories } from "@/lib/queries/categories"
import type { RecurringRule } from "@/lib/queries/recurring-rules"

export interface RecurringLabels {
  /** A szabály neve, vagy — ha nincs — a kategória/átvezetés megnevezése. */
  title: (rule: RecurringRule) => string
  /** A számla (átvezetésnél "Honnan → Hova"). */
  accountPath: (rule: RecurringRule) => string
}

/**
 * Az ismétlődő szabályok emberi címkéi. Archivált kategóriát/számlát is felold,
 * hogy egy régi szabály se váljon névtelenné a listában.
 */
export function useRecurringLabels(): RecurringLabels {
  const { data: accounts } = useAccounts({ includeArchived: true })
  const { data: categories } = useCategories({ includeArchived: true })

  return useMemo(() => {
    const accountMap = new Map((accounts ?? []).map((a) => [a.id, a]))
    const categoryMap = new Map((categories ?? []).map((c) => [c.id, c]))

    const categoryPath = (categoryId: string | null | undefined): string | null => {
      if (!categoryId) return null
      const category = categoryMap.get(categoryId)
      if (!category) return null
      const parent = category.parent_id ? categoryMap.get(category.parent_id) : null
      return parent ? `${parent.name} › ${category.name}` : category.name
    }

    return {
      title: (rule) => {
        if (rule.name?.trim()) return rule.name.trim()
        if (rule.template.direction === "transfer") return "Átvezetés"
        return categoryPath(rule.template.category_id) ?? "Névtelen tétel"
      },
      accountPath: (rule) => {
        const from = accountMap.get(rule.template.account_id)?.name ?? "?"
        if (rule.template.direction !== "transfer") return from
        const to = rule.template.to_account_id
          ? (accountMap.get(rule.template.to_account_id)?.name ?? "?")
          : "?"
        return `${from} → ${to}`
      },
    }
  }, [accounts, categories])
}
