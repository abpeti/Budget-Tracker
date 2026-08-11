import { useState } from "react"
import { Link } from "react-router-dom"
import { ArrowDown, ArrowLeft, ArrowUp, Archive, ArchiveRestore, Pencil, Plus, Trash2 } from "lucide-react"
import { useCategoryTree, useUpdateCategory, type Category } from "@/lib/queries/categories"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { CategoryFormSheet } from "@/components/categories/category-form-sheet"
import type { CategoryKind } from "@/lib/database.types"
import { cn } from "@/lib/utils"

export function CategoriesPage() {
  const [kind, setKind] = useState<CategoryKind>("expense")
  const { tree } = useCategoryTree(kind, { includeArchived: true })
  const updateCategory = useUpdateCategory()

  const [formOpen, setFormOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [newSubParentId, setNewSubParentId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const openCreateMain = () => {
    setEditingCategory(null)
    setNewSubParentId(null)
    setFormOpen(true)
  }

  const openCreateSub = (parentId: string) => {
    setEditingCategory(null)
    setNewSubParentId(parentId)
    setFormOpen(true)
  }

  const openEdit = (category: Category) => {
    setEditingCategory(category)
    setNewSubParentId(null)
    setFormOpen(true)
  }

  const moveWithin = (list: Category[], index: number, dir: -1 | 1) => {
    const target = list[index + dir]
    const current = list[index]
    if (!target) return
    updateCategory.mutate({ id: current.id, sort_order: target.sort_order })
    updateCategory.mutate({ id: target.id, sort_order: current.sort_order })
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleteError(null)
    const { error } = await supabase.from("categories").delete().eq("id", deleteTarget.id)
    if (error) {
      setDeleteError(
        error.code === "23503"
          ? "Ez a kategória nem törölhető, mert vannak hozzá tartozó alkategóriák vagy tranzakciók. Archiváld helyette."
          : error.message
      )
      return
    }
    setDeleteTarget(null)
  }

  return (
    <div className="flex flex-col gap-4 p-4 pt-6">
      <Link
        to="/settings"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Beállítások
      </Link>
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Kategóriák</h1>
        <Button type="button" size="icon" onClick={openCreateMain} aria-label="Új főkategória">
          <Plus className="size-5" />
        </Button>
      </div>

      <div className="flex gap-1 rounded-xl bg-secondary p-1">
        {(["expense", "income"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className={cn(
              "min-h-11 flex-1 rounded-lg text-sm font-medium transition-colors",
              kind === k ? "bg-primary text-primary-foreground" : "text-muted-foreground"
            )}
          >
            {k === "expense" ? "Kiadás" : "Bevétel"}
          </button>
        ))}
      </div>

      {tree.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Még nincs kategória ebben a csoportban.
        </p>
      )}

      <ul className="flex flex-col gap-3">
        {tree.map((main, mainIndex) => (
          <li key={main.id} className="rounded-xl border border-border bg-card">
            <CategoryRow
              category={main}
              onEdit={() => openEdit(main)}
              onArchive={() => updateCategory.mutate({ id: main.id, is_archived: !main.is_archived })}
              onDelete={() => {
                setDeleteError(null)
                setDeleteTarget(main)
              }}
              onMoveUp={mainIndex > 0 ? () => moveWithin(tree, mainIndex, -1) : undefined}
              onMoveDown={mainIndex < tree.length - 1 ? () => moveWithin(tree, mainIndex, 1) : undefined}
              trailing={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Alkategória hozzáadása ehhez: ${main.name}`}
                  onClick={() => openCreateSub(main.id)}
                >
                  <Plus className="size-4" />
                </Button>
              }
            />
            {main.children.length > 0 && (
              <ul className="flex flex-col gap-1 border-t border-border p-2 pl-6">
                {main.children.map((sub, subIndex) => (
                  <CategoryRow
                    key={sub.id}
                    category={sub}
                    compact
                    onEdit={() => openEdit(sub)}
                    onArchive={() => updateCategory.mutate({ id: sub.id, is_archived: !sub.is_archived })}
                    onDelete={() => {
                      setDeleteError(null)
                      setDeleteTarget(sub)
                    }}
                    onMoveUp={subIndex > 0 ? () => moveWithin(main.children, subIndex, -1) : undefined}
                    onMoveDown={
                      subIndex < main.children.length - 1
                        ? () => moveWithin(main.children, subIndex, 1)
                        : undefined
                    }
                  />
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>

      <CategoryFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        kind={kind}
        category={editingCategory}
        initialParentId={newSubParentId}
        mainCategories={tree}
        nextSortOrder={
          newSubParentId
            ? (tree.find((m) => m.id === newSubParentId)?.children.length ?? 0) + 1
            : tree.length + 1
        }
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={`"${deleteTarget?.name}" törlése`}
        description={deleteError ?? "Ez a művelet nem vonható vissza."}
        onConfirm={handleDelete}
      />
    </div>
  )
}

function CategoryRow({
  category,
  compact,
  trailing,
  onEdit,
  onArchive,
  onDelete,
  onMoveUp,
  onMoveDown,
}: {
  category: Category
  compact?: boolean
  trailing?: React.ReactNode
  onEdit: () => void
  onArchive: () => void
  onDelete: () => void
  onMoveUp?: () => void
  onMoveDown?: () => void
}) {
  return (
    <div className={cn("flex flex-col gap-1", compact ? "p-1" : "p-3")}>
      <div className="flex items-center gap-2">
        <span
          className="flex size-8 shrink-0 items-center justify-center rounded-full text-sm"
          style={{ backgroundColor: category.color ?? "var(--color-muted)" }}
          aria-hidden="true"
        >
          {category.icon ?? category.name.charAt(0)}
        </span>
        <p className={cn("min-w-0 flex-1 truncate", compact ? "text-sm" : "font-medium")}>
          {category.name}
          {category.is_archived && (
            <span className="ml-2 text-xs text-muted-foreground">(archiválva)</span>
          )}
        </p>
      </div>
      <div className="flex items-center justify-end gap-1">
        {trailing}
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Feljebb" disabled={!onMoveUp} onClick={onMoveUp}>
          <ArrowUp className="size-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Lejjebb" disabled={!onMoveDown} onClick={onMoveDown}>
          <ArrowDown className="size-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Szerkesztés" onClick={onEdit}>
          <Pencil className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={category.is_archived ? "Visszaállítás" : "Archiválás"}
          onClick={onArchive}
        >
          {category.is_archived ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
        </Button>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Törlés" onClick={onDelete}>
          <Trash2 className="size-4" />
        </Button>
      </div>
    </div>
  )
}
