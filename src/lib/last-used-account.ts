const STORAGE_KEY = "koltsegkoveto-last-account-id"

export function getLastUsedAccountId(): string | null {
  if (typeof window === "undefined") return null
  return window.localStorage.getItem(STORAGE_KEY)
}

export function setLastUsedAccountId(id: string) {
  window.localStorage.setItem(STORAGE_KEY, id)
}
