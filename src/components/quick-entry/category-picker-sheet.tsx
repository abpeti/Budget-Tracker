import { useMemo, useState } from "react"
import { ChevronLeft, Search } from "lucide-react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import type { CategoryKind } from "@/lib/database.types"
import { useCategoryTree, type Category, type CategoryWithChildren } from "@/lib/queries/categories"

interface CategoryPickerSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  kind: CategoryKind
  onSelect: (category: Category) => void
}

export function CategoryPickerSheet({
  open,
  onOpenChange,
  kind,
  onSelect,
}: CategoryPickerSheetProps) {
  const { tree, isLoading } = useCategoryTree(kind)
  const [activeMain, setActiveMain] = useState<CategoryWithChildren | null>(null)
  const [search, setSearch] = useState("")

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setActiveMain(null)
      setSearch("")
    }
    onOpenChange(next)
  }

  const filteredMains = useMemo(() => {
    if (!search.trim()) return tree
    const q = search.trim().toLowerCase()
    return tree.filter((c) => c.name.toLowerCase().includes(q))
  }, [tree, search])

  const filteredSubs = useMemo(() => {
    if (!activeMain) return []
    if (!search.trim()) return activeMain.children
    const q = search.trim().toLowerCase()
    return activeMain.children.filter((c) => c.name.toLowerCase().includes(q))
  }, [activeMain, search])

  const handleMainTap = (main: CategoryWithChildren) => {
    if (main.children.length === 0) {
      onSelect(main)
      handleOpenChange(false)
      return
    }
    setActiveMain(main)
    setSearch("")
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        className="pb-[env(safe-area-inset-bottom)]"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <SheetHeader className="flex flex-row items-center gap-2">
          {activeMain && (
            <button
              type="button"
              className="rounded-md p-1 text-muted-foreground hover:text-foreground"
              aria-label="Vissza a főkategóriákhoz"
              onClick={() => {
                setActiveMain(null)
                setSearch("")
              }}
            >
              <ChevronLeft className="size-5" />
            </button>
          )}
          <SheetTitle>{activeMain ? activeMain.name : "Kategória"}</SheetTitle>
        </SheetHeader>

        <div className="px-4 pb-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Keresés…"
              className="pl-9"
              // Szándékosan nincs autoFocus — ne ugorjon fel a billentyűzet megnyitáskor.
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {isLoading && (
            <p className="py-8 text-center text-sm text-muted-foreground">Betöltés…</p>
          )}

          {!isLoading && !activeMain && (
            <div className="grid grid-cols-3 gap-2">
              {filteredMains.map((main) => (
                <CategoryTile
                  key={main.id}
                  category={main}
                  hasChildren={main.children.length > 0}
                  onTap={() => handleMainTap(main)}
                />
              ))}
              {filteredMains.length === 0 && (
                <p className="col-span-3 py-8 text-center text-sm text-muted-foreground">
                  Nincs találat.
                </p>
              )}
            </div>
          )}

          {!isLoading && activeMain && (
            <div className="grid grid-cols-3 gap-2">
              <CategoryTile
                category={activeMain}
                hasChildren={false}
                label={`Csak ${activeMain.name}`}
                onTap={() => {
                  onSelect(activeMain)
                  handleOpenChange(false)
                }}
              />
              {filteredSubs.map((sub) => (
                <CategoryTile
                  key={sub.id}
                  category={sub}
                  hasChildren={false}
                  onTap={() => {
                    onSelect(sub)
                    handleOpenChange(false)
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function CategoryTile({
  category,
  hasChildren,
  label,
  onTap,
}: {
  category: Category
  hasChildren: boolean
  label?: string
  onTap: () => void
}) {
  return (
    <button
      type="button"
      onClick={onTap}
      className={cn(
        "flex min-h-20 flex-col items-center justify-center gap-1 rounded-xl bg-secondary p-2 text-center transition-colors active:scale-95 hover:bg-secondary/80"
      )}
    >
      <span
        className="flex size-9 items-center justify-center rounded-full text-base"
        style={{ backgroundColor: category.color ?? "var(--color-muted)" }}
        aria-hidden="true"
      >
        {category.icon ?? category.name.charAt(0)}
      </span>
      <span className="line-clamp-2 text-xs leading-tight font-medium">
        {label ?? category.name}
        {hasChildren && !label && <span className="text-muted-foreground"> ›</span>}
      </span>
    </button>
  )
}
