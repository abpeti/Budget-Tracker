// Teljes adatletöltés és visszaállítás Supabase-ből — a lib/backup.ts tiszta
// logikájának hálózati párja.
//
// Lapozva olvasunk: a PostgREST alapból legfeljebb 1000 sort ad vissza egy
// kérésre, egy több éves tranzakciótörténet ennél hosszabb is lehet.

import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { PostgrestError } from "@supabase/supabase-js"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/auth-context"
import { downloadBlob } from "@/lib/download"
import { downloadCsv } from "@/lib/csv-export"
import {
  backupFilename,
  buildBackupFile,
  buildFlatCsvRows,
  countBackup,
  FLAT_CSV_HEADERS,
  serializeBackup,
  setLastBackupAt,
  transactionsCsvFilename,
  type BackupCounts,
  type BackupData,
  type BackupFile,
} from "@/lib/backup"

const PAGE_SIZE = 1000
const UPSERT_CHUNK = 200

type PageResult<T> = PromiseLike<{ data: T[] | null; error: PostgrestError | null }>

async function fetchAllPages<T>(run: (from: number, to: number) => PageResult<T>): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await run(from, from + PAGE_SIZE - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    rows.push(...data)
    if (data.length < PAGE_SIZE) break
  }
  return rows
}

/** Minden tábla minden sora a bejelentkezett felhasználótól (RLS szűri). */
export async function fetchAllData(): Promise<BackupData> {
  const [accounts, categories, recurring_rules, transactions, budgets] = await Promise.all([
    fetchAllPages((from, to) =>
      supabase
        .from("accounts")
        .select(
          "id, name, type, currency, opening_balance, icon, color, is_archived, sort_order, created_at"
        )
        .order("created_at")
        .order("id")
        .range(from, to)
    ),
    fetchAllPages((from, to) =>
      supabase
        .from("categories")
        .select("id, parent_id, name, kind, icon, color, is_archived, sort_order, created_at")
        .order("created_at")
        .order("id")
        .range(from, to)
    ),
    fetchAllPages((from, to) =>
      supabase
        .from("recurring_rules")
        .select(
          "id, name, template, frequency, interval_count, day_of_period, next_run, end_date, last_run, is_active, created_at"
        )
        .order("created_at")
        .order("id")
        .range(from, to)
    ),
    fetchAllPages((from, to) =>
      supabase
        .from("transactions")
        .select(
          "id, occurred_at, direction, amount, account_id, to_account_id, category_id, payee, note, source_rule_id, created_at, updated_at"
        )
        .order("occurred_at")
        .order("created_at")
        .order("id")
        .range(from, to)
    ),
    fetchAllPages((from, to) =>
      supabase
        .from("budgets")
        .select("id, category_id, amount, valid_from, valid_to, created_at")
        .order("created_at")
        .order("id")
        .range(from, to)
    ),
  ])

  return { accounts, categories, recurring_rules, transactions, budgets }
}

/** Teljes JSON mentés letöltése. Visszaadja a mentett tételszámokat. */
export function useDownloadBackup() {
  return useMutation({
    mutationFn: async (): Promise<BackupCounts> => {
      const data = await fetchAllData()
      const backup = buildBackupFile(data)
      downloadBlob(
        backupFilename(),
        new Blob([serializeBackup(backup)], { type: "application/json;charset=utf-8;" })
      )
      setLastBackupAt(backup.exported_at)
      return countBackup(data)
    },
  })
}

/** Teljes tranzakciótörténet CSV-be (v_transactions_flat szerkezet). */
export function useDownloadTransactionsCsv() {
  return useMutation({
    mutationFn: async (): Promise<number> => {
      const data = await fetchAllData()
      downloadCsv(transactionsCsvFilename(), FLAT_CSV_HEADERS, buildFlatCsvRows(data))
      return data.transactions.length
    },
  })
}

async function upsertChunked<T>(
  rows: T[],
  run: (chunk: T[]) => PromiseLike<{ error: PostgrestError | null }>
): Promise<void> {
  for (let i = 0; i < rows.length; i += UPSERT_CHUNK) {
    const { error } = await run(rows.slice(i, i + UPSERT_CHUNK))
    if (error) throw error
  }
}

/**
 * Visszaállítás mentésből — ÖSSZEFÉSÜLÉS, nem törlés-és-újratöltés.
 *
 * Minden sor id szerint upsert: ami a mentésben szerepel, az felülírja az
 * azonos id-jú meglévőt; ami csak az adatbázisban van, az érintetlen marad.
 * Így egy véletlen törlés után a mentés visszahozza a hiányzó tételeket, egy
 * üres (új) Supabase-projektbe pedig minden egy az egyben átkerül, és a
 * művelet többszöri futtatása is ugyanazt az állapotot adja.
 *
 * Sorrend az idegen kulcsok miatt: számlák → főkategóriák → alkategóriák →
 * ismétlődő szabályok → tranzakciók → keretek. Az adatbázis triggerei
 * (kategória–irány egyezés, számla tulajdonosa stb.) itt is futnak, ezért
 * egy manipulált fájl sem tud inkonzisztens adatot bevinni.
 */
export function useRestoreBackup() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (backup: BackupFile): Promise<BackupCounts> => {
      if (!user) throw new Error("Nincs bejelentkezett felhasználó.")
      const userId = user.id
      const { data } = backup

      await upsertChunked(
        data.accounts.map((row) => ({ ...row, user_id: userId })),
        (chunk) => supabase.from("accounts").upsert(chunk, { onConflict: "id" })
      )

      const mainCategories = data.categories.filter((c) => c.parent_id === null)
      const subCategories = data.categories.filter((c) => c.parent_id !== null)
      await upsertChunked(
        mainCategories.map((row) => ({ ...row, user_id: userId })),
        (chunk) => supabase.from("categories").upsert(chunk, { onConflict: "id" })
      )
      await upsertChunked(
        subCategories.map((row) => ({ ...row, user_id: userId })),
        (chunk) => supabase.from("categories").upsert(chunk, { onConflict: "id" })
      )

      await upsertChunked(
        data.recurring_rules.map((row) => ({ ...row, user_id: userId })),
        (chunk) => supabase.from("recurring_rules").upsert(chunk, { onConflict: "id" })
      )

      await upsertChunked(
        data.transactions.map((row) => ({ ...row, user_id: userId })),
        (chunk) => supabase.from("transactions").upsert(chunk, { onConflict: "id" })
      )

      await upsertChunked(
        data.budgets.map((row) => ({ ...row, user_id: userId })),
        (chunk) => supabase.from("budgets").upsert(chunk, { onConflict: "id" })
      )

      return countBackup(data)
    },
    onSettled: () => {
      // Részleges siker után is frissüljön minden lista/riport — a hiba előtt
      // beírt sorok már az adatbázisban vannak.
      void queryClient.invalidateQueries()
    },
  })
}
