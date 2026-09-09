import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { DueOccurrenceList } from "@/components/recurring/due-occurrence-list"
import { useDueRecurringOccurrences } from "@/lib/queries/recurring-rules"

/**
 * Csak az app első betöltésekor nyitunk automatikusan — navigáció közben már nem
 * ugrik fel újra. (Modulszintű, mert a komponens minden oldalváltásnál újramountolhat.)
 */
let promptedThisSession = false

/**
 * Az esedékes ismétlődő tételek felajánlása az app indulásakor. Nincs háttérben
 * futó cron: semmi nem könyvelődik el a felhasználó jóváhagyása nélkül (spec 3.5).
 */
export function DueRecurringSheet() {
  const { occurrences } = useDueRecurringOccurrences()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (promptedThisSession || occurrences.length === 0) return
    promptedThisSession = true
    setOpen(true)
  }, [occurrences.length])

  useEffect(() => {
    if (open && occurrences.length === 0) setOpen(false)
  }, [open, occurrences.length])

  if (occurrences.length === 0) return null

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent className="max-h-[90dvh]">
        <SheetHeader>
          <SheetTitle>
            Esedékes ismétlődő {occurrences.length === 1 ? "tétel" : "tételek"} (
            {occurrences.length})
          </SheetTitle>
        </SheetHeader>

        <div className="flex flex-col gap-3 overflow-y-auto px-4 pb-6">
          <p className="text-sm text-muted-foreground">
            Ezek a tételek most esedékesek. Rögzítsd őket, vagy hagyd ki azt,
            amelyik ezúttal elmaradt — magától semmi nem könyvelődik el.
          </p>

          <DueOccurrenceList occurrences={occurrences} onAllHandled={() => setOpen(false)} />

          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Későbbre
          </Button>

          <Link
            to="/recurring"
            onClick={() => setOpen(false)}
            className="text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            Ismétlődő tételek kezelése
          </Link>
        </div>
      </SheetContent>
    </Sheet>
  )
}
