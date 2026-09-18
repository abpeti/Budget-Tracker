// Teljes adatexport és biztonsági mentés — hogy az adataid ne ragadjanak be
// az appba.
//
// Két formátum:
//   - CSV: minden tranzakció a v_transactions_flat nézet szerkezetében, nevekkel
//     (nem id-kkal), Excel/Google Sheets/bármilyen más app számára olvashatóan.
//   - JSON: veszteségmentes mentés minden tábláról (számlák, kategóriák,
//     ismétlődő szabályok, tranzakciók, keretek), az eredeti id-kkal — ebből
//     az app vissza tudja állítani az adatokat (lásd queries/backup.ts).
//
// Ez a modul tiszta logika: nincs benne hálózat, csak típusok, validálás és
// átalakítás. A Supabase-hívások a queries/backup.ts-ben vannak.

import { z } from "zod"
import { format, parseISO } from "date-fns"
import { hu } from "date-fns/locale"
import { toCents } from "@/lib/money"
import type { CsvCell } from "@/lib/csv-export"

export const BACKUP_FORMAT = "koltsegkoveto-backup"
export const BACKUP_VERSION = 1

// ---------------------------------------------------------------------------
// Séma — a mentésfájl validálása visszaállítás előtt.
//
// Az ismeretlen mezőket a zod eldobja (strip), így egy későbbi, bővebb
// verzióból származó fájl alapmezői is beolvashatók. A user_id szándékosan
// nincs benne: visszaállításkor mindig a bejelentkezett felhasználóé lesz.
// ---------------------------------------------------------------------------

const isoDate = z.iso.date()
const timestamp = z.string().min(1)

const accountSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1),
  type: z.enum(["cash", "bank", "card", "savings", "credit", "other"]),
  currency: z.string().length(3),
  opening_balance: z.number(),
  icon: z.string().nullable(),
  color: z.string().nullable(),
  is_archived: z.boolean(),
  sort_order: z.int(),
  created_at: timestamp,
})

const categorySchema = z.object({
  id: z.uuid(),
  parent_id: z.uuid().nullable(),
  name: z.string().min(1),
  kind: z.enum(["expense", "income"]),
  icon: z.string().nullable(),
  color: z.string().nullable(),
  is_archived: z.boolean(),
  sort_order: z.int(),
  created_at: timestamp,
})

const recurringTemplateSchema = z.object({
  direction: z.enum(["expense", "income", "transfer"]),
  amount: z.number().positive(),
  account_id: z.uuid(),
  to_account_id: z.uuid().nullable().optional(),
  category_id: z.uuid().nullable().optional(),
  payee: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
})

const recurringRuleSchema = z.object({
  id: z.uuid(),
  name: z.string().nullable(),
  template: recurringTemplateSchema,
  frequency: z.enum(["daily", "weekly", "monthly", "yearly"]),
  interval_count: z.int().min(1).max(99),
  day_of_period: z.int().min(1).max(31),
  next_run: isoDate,
  end_date: isoDate.nullable(),
  last_run: isoDate.nullable(),
  is_active: z.boolean(),
  created_at: timestamp,
})

const transactionSchema = z.object({
  id: z.uuid(),
  occurred_at: isoDate,
  direction: z.enum(["expense", "income", "transfer"]),
  amount: z.number().positive(),
  account_id: z.uuid(),
  to_account_id: z.uuid().nullable(),
  category_id: z.uuid().nullable(),
  payee: z.string().nullable(),
  note: z.string().nullable(),
  source_rule_id: z.uuid().nullable(),
  created_at: timestamp,
  updated_at: timestamp,
})

const budgetSchema = z.object({
  id: z.uuid(),
  category_id: z.uuid(),
  amount: z.number().positive(),
  valid_from: isoDate,
  valid_to: isoDate.nullable(),
  created_at: timestamp,
})

export const backupFileSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  version: z.int().min(1),
  exported_at: timestamp,
  data: z.object({
    accounts: z.array(accountSchema),
    categories: z.array(categorySchema),
    recurring_rules: z.array(recurringRuleSchema),
    transactions: z.array(transactionSchema),
    budgets: z.array(budgetSchema),
  }),
})

export type BackupFile = z.infer<typeof backupFileSchema>
export type BackupData = BackupFile["data"]
export type BackupAccount = z.infer<typeof accountSchema>
export type BackupCategory = z.infer<typeof categorySchema>
export type BackupRecurringRule = z.infer<typeof recurringRuleSchema>
export type BackupTransaction = z.infer<typeof transactionSchema>
export type BackupBudget = z.infer<typeof budgetSchema>

// ---------------------------------------------------------------------------
// Fájl összeállítása és beolvasása
// ---------------------------------------------------------------------------

export function buildBackupFile(data: BackupData, exportedAt = new Date()): BackupFile {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exported_at: exportedAt.toISOString(),
    data,
  }
}

export function serializeBackup(backup: BackupFile): string {
  return JSON.stringify(backup, null, 2)
}

export class BackupParseError extends Error {}

/**
 * Egy felhasználó által kiválasztott fájl szövegéből mentésobjektum.
 * Minden hibát magyar, a felületen megjeleníthető üzenettel dob.
 */
export function parseBackupFile(text: string): BackupFile {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new BackupParseError(
      "A fájl nem érvényes JSON. Biztos, hogy az app mentésfájlját választottad ki?"
    )
  }

  if (
    typeof raw !== "object" ||
    raw === null ||
    (raw as { format?: unknown }).format !== BACKUP_FORMAT
  ) {
    throw new BackupParseError(
      "Ez nem az app mentésfájlja. A visszaállításhoz a „Biztonsági mentés (JSON)” gombbal készített fájl kell."
    )
  }

  const version = (raw as { version?: unknown }).version
  if (typeof version === "number" && version > BACKUP_VERSION) {
    throw new BackupParseError(
      `A mentés újabb formátumú (v${version}), mint amit ez az app kezel (v${BACKUP_VERSION}). Frissítsd az appot.`
    )
  }

  const result = backupFileSchema.safeParse(raw)
  if (!result.success) {
    const first = result.error.issues[0]
    const path = first?.path.length ? ` (${first.path.join(".")})` : ""
    throw new BackupParseError(
      `A mentésfájl sérült vagy hiányos${path}: ${first?.message ?? "ismeretlen hiba"}`
    )
  }
  return result.data
}

// ---------------------------------------------------------------------------
// Összegzés a megerősítő dialógushoz
// ---------------------------------------------------------------------------

export interface BackupCounts {
  accounts: number
  categories: number
  recurring_rules: number
  transactions: number
  budgets: number
}

export function countBackup(data: BackupData): BackupCounts {
  return {
    accounts: data.accounts.length,
    categories: data.categories.length,
    recurring_rules: data.recurring_rules.length,
    transactions: data.transactions.length,
    budgets: data.budgets.length,
  }
}

const huNumber = new Intl.NumberFormat("hu-HU")

export function describeCounts(counts: BackupCounts): string {
  return [
    `${huNumber.format(counts.transactions)} tranzakció`,
    `${huNumber.format(counts.accounts)} számla`,
    `${huNumber.format(counts.categories)} kategória`,
    `${huNumber.format(counts.recurring_rules)} ismétlődő tétel`,
    `${huNumber.format(counts.budgets)} keret`,
  ].join(" · ")
}

export function formatExportedAt(iso: string): string {
  try {
    return format(parseISO(iso), "yyyy. MMM d. HH:mm", { locale: hu })
  } catch {
    return iso
  }
}

// ---------------------------------------------------------------------------
// Fájlnevek
// ---------------------------------------------------------------------------

export function backupFilename(date = new Date()): string {
  return `koltsegkoveto-mentes-${format(date, "yyyy-MM-dd")}.json`
}

export function transactionsCsvFilename(date = new Date()): string {
  return `koltsegkoveto-tranzakciok-${format(date, "yyyy-MM-dd")}.csv`
}

// ---------------------------------------------------------------------------
// Teljes tranzakcióexport — a v_transactions_flat nézet szerkezete (spec 7.3),
// kliensoldalon összerakva, hogy a BI-nézet és a CSV egy nyelvet beszéljen.
// ---------------------------------------------------------------------------

export const FLAT_CSV_HEADERS = [
  "id",
  "occurred_at",
  "year",
  "month",
  "direction",
  "amount",
  "signed_amount",
  "account_name",
  "account_type",
  "to_account_name",
  "category_name",
  "parent_category_name",
  "category_path",
  "payee",
  "note",
  "created_at",
  "recurring_rule_id",
  "recurring_name",
] as const

export function buildFlatCsvRows(data: BackupData): CsvCell[][] {
  const accounts = new Map(data.accounts.map((a) => [a.id, a]))
  const categories = new Map(data.categories.map((c) => [c.id, c]))
  const rules = new Map(data.recurring_rules.map((r) => [r.id, r]))

  const sorted = [...data.transactions].sort(
    (a, b) =>
      a.occurred_at.localeCompare(b.occurred_at) || a.created_at.localeCompare(b.created_at)
  )

  return sorted.map((tx) => {
    const account = accounts.get(tx.account_id)
    const toAccount = tx.to_account_id ? accounts.get(tx.to_account_id) : undefined
    const category = tx.category_id ? categories.get(tx.category_id) : undefined
    const parent = category?.parent_id ? categories.get(category.parent_id) : undefined
    const rule = tx.source_rule_id ? rules.get(tx.source_rule_id) : undefined

    const cents = toCents(tx.amount)
    const signedCents =
      tx.direction === "expense" ? -cents : tx.direction === "income" ? cents : 0
    const [year, month] = tx.occurred_at.split("-")

    return [
      tx.id,
      tx.occurred_at,
      Number(year),
      Number(month),
      tx.direction,
      cents / 100,
      signedCents / 100,
      account?.name ?? "",
      account?.type ?? "",
      toAccount?.name ?? null,
      category?.name ?? null,
      parent?.name ?? null,
      category ? (parent ? `${parent.name} › ${category.name}` : category.name) : null,
      tx.payee,
      tx.note,
      tx.created_at,
      tx.source_rule_id,
      rule?.name ?? null,
    ]
  })
}

// ---------------------------------------------------------------------------
// „Utolsó mentés” — csak emlékeztető a Beállítások képernyőn, eszközönként.
// ---------------------------------------------------------------------------

const LAST_BACKUP_KEY = "koltsegkoveto-last-backup"

export function getLastBackupAt(): string | null {
  try {
    return window.localStorage.getItem(LAST_BACKUP_KEY)
  } catch {
    return null
  }
}

export function setLastBackupAt(iso: string): void {
  try {
    window.localStorage.setItem(LAST_BACKUP_KEY, iso)
  } catch {
    // privát mód / letiltott tárhely — az emlékeztető nem kritikus
  }
}
