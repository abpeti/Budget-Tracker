import { useEffect, useState } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface NoteSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  value: string
  onSave: (note: string) => void
}

export function NoteSheet({ open, onOpenChange, value, onSave }: NoteSheetProps) {
  const [draft, setDraft] = useState(value)

  useEffect(() => {
    if (open) setDraft(value)
  }, [open, value])

  const handleSave = () => {
    onSave(draft.trim())
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Megjegyzés</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-3 px-4 pb-6">
          <Input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave()
            }}
            placeholder="Pl. szülinapi ajándék"
            maxLength={200}
          />
          <div className="flex gap-2">
            {value && (
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setDraft("")
                  onSave("")
                  onOpenChange(false)
                }}
              >
                Törlés
              </Button>
            )}
            <Button type="button" className="flex-1" onClick={handleSave}>
              Kész
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
