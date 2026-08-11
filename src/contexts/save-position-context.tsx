import { createContext, useContext, useEffect, useState, type ReactNode } from "react"

type SavePosition = "left" | "right"

interface SavePositionContextValue {
  savePosition: SavePosition
  setSavePosition: (position: SavePosition) => void
}

const STORAGE_KEY = "koltsegkoveto-save-position"

const SavePositionContext = createContext<SavePositionContextValue | null>(null)

function getInitial(): SavePosition {
  if (typeof window === "undefined") return "right"
  return window.localStorage.getItem(STORAGE_KEY) === "left" ? "left" : "right"
}

export function SavePositionProvider({ children }: { children: ReactNode }) {
  const [savePosition, setSavePositionState] = useState<SavePosition>(getInitial)

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, savePosition)
  }, [savePosition])

  return (
    <SavePositionContext.Provider
      value={{ savePosition, setSavePosition: setSavePositionState }}
    >
      {children}
    </SavePositionContext.Provider>
  )
}

export function useSavePosition() {
  const ctx = useContext(SavePositionContext)
  if (!ctx) throw new Error("useSavePosition csak SavePositionProvider-en belül használható.")
  return ctx
}
