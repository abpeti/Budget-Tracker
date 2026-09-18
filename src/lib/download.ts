// Böngészős fájlletöltés egy Blob-ból — a CSV export és a JSON mentés is
// ezen keresztül ad át fájlt a felhasználónak. PWA-ban (Android Chrome, iOS
// Safari) is működik: a letöltés a rendszer Letöltések mappájába kerül.

export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  // Az objectURL visszavonását késleltetjük: egyes böngészők (főleg iOS
  // Safari) még a click után kezdik el olvasni a blobot.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
