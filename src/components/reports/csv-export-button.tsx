import { Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { downloadCsv } from "@/lib/csv-export"

interface CsvExportButtonProps {
  filename: string
  headers: string[]
  rows: (string | number)[][]
}

export function CsvExportButton({ filename, headers, rows }: CsvExportButtonProps) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={rows.length === 0}
      onClick={() => downloadCsv(filename, headers, rows)}
    >
      <Download className="size-4" />
      Adatok CSV-be
    </Button>
  )
}
