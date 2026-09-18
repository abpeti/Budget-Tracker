// CSV export a riportokhoz és a teljes tranzakcióexporthoz — UTF-8 BOM-mal
// (spec 7.3), hogy az Excel ne rontsa el az ékezeteket. A dátumok már ISO
// formátumban vannak a DB-ben.

import { downloadBlob } from "@/lib/download"

export type CsvCell = string | number | null | undefined

function escapeCsvCell(value: CsvCell): string {
  if (value === null || value === undefined) return ""
  const str = String(value)
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

/** Fejléc + sorok → CSV szöveg (CRLF sorvégekkel, BOM nélkül). */
export function toCsvText(headers: readonly string[], rows: CsvCell[][]): string {
  const lines = [headers, ...rows].map((row) => row.map(escapeCsvCell).join(","))
  return lines.join("\r\n")
}

export function downloadCsv(
  filename: string,
  headers: readonly string[],
  rows: CsvCell[][]
): void {
  const csv = toCsvText(headers, rows)
  downloadBlob(filename, new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" }))
}
