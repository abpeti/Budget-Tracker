import { format, subDays } from "date-fns"
import { hu } from "date-fns/locale"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

interface DatePickerSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  value: string // yyyy-MM-dd
  onSelect: (date: string) => void
}

export function DatePickerSheet({ open, onOpenChange, value, onSelect }: DatePickerSheetProps) {
  const today = format(new Date(), "yyyy-MM-dd")
  const yesterday = format(subDays(new Date(), 1), "yyyy-MM-dd")

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Dátum</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-3 px-4 pb-6">
          <div className="flex gap-2">
            <Button
              type="button"
              variant={value === today ? "default" : "outline"}
              className="flex-1"
              onClick={() => {
                onSelect(today)
                onOpenChange(false)
              }}
            >
              Ma
            </Button>
            <Button
              type="button"
              variant={value === yesterday ? "default" : "outline"}
              className="flex-1"
              onClick={() => {
                onSelect(yesterday)
                onOpenChange(false)
              }}
            >
              Tegnap
            </Button>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="custom-date">Egyéb dátum</Label>
            <input
              id="custom-date"
              type="date"
              defaultValue={value}
              max={today}
              onChange={(e) => {
                if (e.target.value) {
                  onSelect(e.target.value)
                  onOpenChange(false)
                }
              }}
              className="h-12 w-full rounded-md border border-input bg-transparent px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
            />
          </div>

          <p className="text-center text-sm text-muted-foreground">
            {format(new Date(value), "yyyy. MMMM d., EEEE", { locale: hu })}
          </p>
        </div>
      </SheetContent>
    </Sheet>
  )
}
