import { useRef, useState } from "react"
import { DatabaseBackup, Download, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import {
  countBackup,
  describeCounts,
  formatExportedAt,
  getLastBackupAt,
  parseBackupFile,
  type BackupFile,
} from "@/lib/backup"
import {
  useDownloadBackup,
  useDownloadTransactionsCsv,
  useRestoreBackup,
} from "@/lib/queries/backup"

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === "object" && error !== null && "message" in error) {
    return String((error as { message: unknown }).message)
  }
  return "Ismeretlen hiba."
}

interface Notice {
  kind: "success" | "error"
  text: string
}

/**
 * Beállítások → „Adataid” kártya: teljes CSV export, JSON biztonsági mentés
 * és visszaállítás mentésből. A cél, hogy az adatok bármikor kivihetők
 * legyenek az appból, és egy törlés vagy projektváltás után visszahozhatók.
 */
export function DataCard() {
  const downloadCsv = useDownloadTransactionsCsv()
  const downloadBackup = useDownloadBackup()
  const restore = useRestoreBackup()

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [pendingRestore, setPendingRestore] = useState<{
    fileName: string
    backup: BackupFile
  } | null>(null)
  const [restoreError, setRestoreError] = useState<string | null>(null)
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(() => getLastBackupAt())

  const busy = downloadCsv.isPending || downloadBackup.isPending || restore.isPending

  async function handleCsv() {
    setNotice(null)
    try {
      const count = await downloadCsv.mutateAsync()
      setNotice({
        kind: "success",
        text:
          count === 0
            ? "Még nincs tranzakció — üres CSV készült."
            : `${new Intl.NumberFormat("hu-HU").format(count)} tranzakció letöltve CSV-ben.`,
      })
    } catch (error) {
      setNotice({ kind: "error", text: `A CSV export nem sikerült: ${errorMessage(error)}` })
    }
  }

  async function handleBackup() {
    setNotice(null)
    try {
      const counts = await downloadBackup.mutateAsync()
      setLastBackupAt(getLastBackupAt())
      setNotice({ kind: "success", text: `Mentés letöltve: ${describeCounts(counts)}.` })
    } catch (error) {
      setNotice({ kind: "error", text: `A mentés nem sikerült: ${errorMessage(error)}` })
    }
  }

  async function handleFileChosen(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    // Ugyanaz a fájl újra kiválasztható legyen (pl. sikertelen próbálkozás után).
    event.target.value = ""
    if (!file) return

    setNotice(null)
    setRestoreError(null)
    try {
      const backup = parseBackupFile(await file.text())
      setPendingRestore({ fileName: file.name, backup })
    } catch (error) {
      setNotice({ kind: "error", text: errorMessage(error) })
    }
  }

  async function handleRestoreConfirmed() {
    if (!pendingRestore) return
    setRestoreError(null)
    try {
      const counts = await restore.mutateAsync(pendingRestore.backup)
      setPendingRestore(null)
      setNotice({ kind: "success", text: `Visszaállítva: ${describeCounts(counts)}.` })
    } catch (error) {
      // A dialógus nyitva marad, a hiba a leírásban jelenik meg.
      setRestoreError(errorMessage(error))
    }
  }

  const restoreDescription = pendingRestore
    ? [
        `${pendingRestore.fileName} · mentve: ${formatExportedAt(pendingRestore.backup.exported_at)}`,
        describeCounts(countBackup(pendingRestore.backup.data)),
        "A mentésben szereplő tételek felülírják az azonos azonosítójú meglévőket; ami csak az appban van, az megmarad. Semmi nem törlődik.",
        restoreError ? `Hiba: ${restoreError}` : null,
      ]
        .filter(Boolean)
        .join("\n\n")
    : undefined

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Adataid</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          Az adataid a tieid. Bármikor kiviheted őket táblázatba, és készíthetsz
          teljes mentést, amiből az app mindent vissza tud állítani.
        </p>

        <Button
          type="button"
          variant="outline"
          className="justify-start"
          disabled={busy}
          onClick={() => void handleCsv()}
        >
          <Download className="size-4" aria-hidden="true" />
          {downloadCsv.isPending ? "Exportálás…" : "Minden tranzakció CSV-be"}
        </Button>

        <Button
          type="button"
          variant="outline"
          className="justify-start"
          disabled={busy}
          onClick={() => void handleBackup()}
        >
          <DatabaseBackup className="size-4" aria-hidden="true" />
          {downloadBackup.isPending ? "Mentés készül…" : "Biztonsági mentés (JSON)"}
        </Button>

        <Button
          type="button"
          variant="outline"
          className="justify-start"
          disabled={busy}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="size-4" aria-hidden="true" />
          Visszaállítás mentésből
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={(e) => void handleFileChosen(e)}
        />

        <p className="text-xs text-muted-foreground">
          {lastBackupAt
            ? `Utolsó mentés ezen az eszközön: ${formatExportedAt(lastBackupAt)}`
            : "Ezen az eszközön még nem készült mentés."}
        </p>

        {notice && (
          <p
            role={notice.kind === "error" ? "alert" : "status"}
            className={
              notice.kind === "error"
                ? "text-sm text-destructive"
                : "text-sm text-muted-foreground"
            }
          >
            {notice.text}
          </p>
        )}
      </CardContent>

      <ConfirmDialog
        open={pendingRestore !== null}
        onOpenChange={(open) => {
          if (!open && !restore.isPending) {
            setPendingRestore(null)
            setRestoreError(null)
          }
        }}
        title="Visszaállítod a mentést?"
        description={restoreDescription}
        confirmLabel="Visszaállítás"
        destructive={false}
        onConfirm={handleRestoreConfirmed}
      />
    </Card>
  )
}
