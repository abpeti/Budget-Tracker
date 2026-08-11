import { useMemo } from "react"
import { useFrequentCategoryIds } from "@/lib/queries/transactions"
import { useCategories, type Category } from "@/lib/queries/categories"
import type { CategoryKind } from "@/lib/database.types"
import { cn } from "@/lib/utils"

interface FrequentCategoryChipsProps {
  kind: CategoryKind
  selectedId: string | null
  onSelect: (category: Category) => void
}

export function FrequentCategoryChips({
  kind,
  selectedId,
  onSelect,
}: FrequentCategoryChipsProps) {
  const { ids } = useFrequentCategoryIds(8)
  const { data: categories } = useCategories()

  const chips = useMemo(() => {
    if (!categories) return []
    const byId = new Map(categories.map((c) => [c.id, c]))
    return ids
      .map((id) => byId.get(id))
      .filter((c): c is Category => !!c && c.kind === kind)
  }, [ids, categories, kind])

  if (chips.length === 0) return null

  return (
    <div
      className="flex gap-2 overflow-x-auto px-4 py-2 [scrollbar-width:none]"
      role="group"
      aria-label="Gyakori kategóriák"
    >
      {chips.map((category) => (
        <button
          key={category.id}
          type="button"
          onClick={() => onSelect(category)}
          className={cn(
            "flex h-10 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors active:scale-95",
            selectedId === category.id
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-secondary text-secondary-foreground hover:bg-secondary/80"
          )}
        >
          <span aria-hidden="true">{category.icon ?? "•"}</span>
          {category.name}
        </button>
      ))}
    </div>
  )
}
