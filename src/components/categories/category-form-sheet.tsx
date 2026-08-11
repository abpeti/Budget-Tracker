import { useEffect, useState } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  useCreateCategory,
  useUpdateCategory,
  type Category,
  type CategoryWithChildren,
} from "@/lib/queries/categories"
import type { CategoryKind } from "@/lib/database.types"

const COLOR_PRESETS = [
  "#f43f5e",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
  "#8b5cf6",
  "#64748b",
]

interface CategoryFormSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  kind: CategoryKind
  /** Ha meg van adva, szerkesztés — egyébként létrehozás. */
  category?: Category | null
  /** Új alkategória létrehozásakor a kezdő szülő. */
  initialParentId?: string | null
  /** Elérhető főkategóriák (szülőválasztáshoz, csak alkategóriánál). */
  mainCategories: CategoryWithChildren[]
  nextSortOrder: number
}

export function CategoryFormSheet({
  open,
  onOpenChange,
  kind,
  category,
  initialParentId = null,
  mainCategories,
  nextSortOrder,
}: CategoryFormSheetProps) {
  const isEdit = !!category
  const isSub = isEdit ? !!category?.parent_id : initialParentId !== null
  const createCategory = useCreateCategory()
  const updateCategory = useUpdateCategory()

  const [name, setName] = useState("")
  const [icon, setIcon] = useState("")
  const [color, setColor] = useState<string | null>(null)
  const [parentId, setParentId] = useState<string | null>(initialParentId)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setName(category?.name ?? "")
      setIcon(category?.icon ?? "")
      setColor(category?.color ?? null)
      setParentId(category?.parent_id ?? initialParentId)
      setError(null)
    }
  }, [open, category, initialParentId])

  const saving = createCategory.isPending || updateCategory.isPending

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError("Adj meg egy nevet.")
      return
    }
    if (isSub && !parentId) {
      setError("Válassz főkategóriát.")
      return
    }

    try {
      if (isEdit && category) {
        await updateCategory.mutateAsync({
          id: category.id,
          name: name.trim(),
          icon: icon.trim() || null,
          color,
          parent_id: isSub ? parentId : null,
        })
      } else {
        await createCategory.mutateAsync({
          name: name.trim(),
          kind,
          parent_id: isSub ? parentId : null,
          icon: icon.trim() || null,
          color,
          sort_order: nextSortOrder,
        })
      }
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ismeretlen hiba történt.")
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>
            {isEdit ? "Kategória szerkesztése" : isSub ? "Új alkategória" : "Új főkategória"}
          </SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-4 pb-6">
          <div className="flex flex-col gap-2">
            <Label htmlFor="category-name">Név</Label>
            <Input id="category-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="category-icon">Ikon (emoji, opcionális)</Label>
            <Input
              id="category-icon"
              value={icon}
              maxLength={2}
              onChange={(e) => setIcon(e.target.value)}
              placeholder="🛒"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Szín</Label>
            <div className="flex flex-wrap gap-2">
              {COLOR_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  aria-label={`Szín: ${preset}`}
                  aria-pressed={color === preset}
                  onClick={() => setColor(color === preset ? null : preset)}
                  className={cn(
                    "size-9 rounded-full border-2",
                    color === preset ? "border-foreground" : "border-transparent"
                  )}
                  style={{ backgroundColor: preset }}
                />
              ))}
            </div>
          </div>

          {isSub && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="category-parent">Főkategória</Label>
              <select
                id="category-parent"
                value={parentId ?? ""}
                onChange={(e) => setParentId(e.target.value || null)}
                className="h-12 w-full rounded-md border border-input bg-transparent px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                <option value="" disabled>
                  Válassz…
                </option>
                {mainCategories
                  .filter((m) => m.id !== category?.id)
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
              </select>
            </div>
          )}

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <Button type="submit" size="lg" disabled={saving}>
            {saving ? "Mentés…" : "Mentés"}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  )
}
