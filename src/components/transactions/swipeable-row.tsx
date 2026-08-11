import { useRef, useState, type ReactNode, type PointerEvent as ReactPointerEvent } from "react"
import { Trash2 } from "lucide-react"

const REVEAL_WIDTH = 76
const OPEN_THRESHOLD = 40

interface SwipeableRowProps {
  children: ReactNode
  onDelete: () => void
  deleteLabel?: string
}

export function SwipeableRow({ children, onDelete, deleteLabel = "Törlés" }: SwipeableRowProps) {
  const [offset, setOffset] = useState(0)
  const dragState = useRef<{ startX: number; startOffset: number; dragging: boolean } | null>(null)

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    dragState.current = { startX: e.clientX, startOffset: offset, dragging: false }
  }

  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragState.current) return
    const dx = e.clientX - dragState.current.startX
    if (Math.abs(dx) > 4) {
      dragState.current.dragging = true
      e.currentTarget.setPointerCapture(e.pointerId)
    }
    if (!dragState.current.dragging) return
    const next = Math.min(0, Math.max(-REVEAL_WIDTH, dragState.current.startOffset + dx))
    setOffset(next)
  }

  const handlePointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragState.current) return
    if (dragState.current.dragging) {
      setOffset(offset < -OPEN_THRESHOLD ? -REVEAL_WIDTH : 0)
      // A húzást lezáró kattintás ne érje el a sor tartalmát (pl. ne nyissa meg a szerkesztést).
      e.preventDefault()
    }
    dragState.current = null
  }

  return (
    <div className="relative overflow-hidden">
      <div className="absolute inset-y-0 right-0 flex items-center">
        <button
          type="button"
          aria-label={deleteLabel}
          onClick={() => {
            setOffset(0)
            onDelete()
          }}
          className="flex h-full items-center justify-center bg-destructive text-destructive-foreground"
          style={{ width: REVEAL_WIDTH }}
        >
          <Trash2 className="size-5" />
        </button>
      </div>
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{
          transform: `translateX(${offset}px)`,
          transition: dragState.current?.dragging ? "none" : "transform 150ms ease-out",
          touchAction: "pan-y",
        }}
        className="relative bg-background"
      >
        {children}
      </div>
    </div>
  )
}
