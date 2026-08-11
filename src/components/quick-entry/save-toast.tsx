import { Button } from "@/components/ui/button"

interface SaveToastProps {
  onUndo: () => void
}

export function SaveToast({ onUndo }: SaveToastProps) {
  return (
    <div
      role="status"
      className="pointer-events-auto flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-lg"
    >
      <span className="text-sm font-medium">Rögzítve</span>
      <Button type="button" variant="ghost" size="sm" onClick={onUndo}>
        Visszavonás
      </Button>
    </div>
  )
}
