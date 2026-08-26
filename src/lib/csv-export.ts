// CSV export a riportokhoz — UTF-8 BOM-mal (spec 7.3), hogy az Excel ne
// rontsa el az ékezeteket. A dátumok már ISO formátumban vannak a DB-ben.

function escapeCsvCell(value: string | number): string {
  const str = String(value)
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export function downloadCsv(
  filename: string,
  headers: string[],
  rows: (string | number)[][]
): void {
  const lines = [headers, ...rows].map((row) => row.map(escapeCsvCell).join(","))
  const csv = lines.join("\r\n")
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
