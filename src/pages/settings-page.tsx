import { useAuth } from "@/contexts/auth-context"
import { useTheme } from "@/contexts/theme-context"
import { useSavePosition } from "@/contexts/save-position-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export function SettingsPage() {
  const { user, signOut } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const { savePosition, setSavePosition } = useSavePosition()

  return (
    <div className="flex flex-col gap-4 p-4 pt-8">
      <h1 className="text-lg font-semibold">Beállítások</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Fiók</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">{user?.email}</p>
          <Button variant="outline" onClick={() => void signOut()}>
            Kijelentkezés
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Megjelenés</CardTitle>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={toggleTheme}>
            {theme === "dark" ? "Váltás világos módra" : "Váltás sötét módra"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Gyorsrögzítés</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            A MENTÉS gomb helye a numpadon.
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant={savePosition === "right" ? "default" : "outline"}
              className="flex-1"
              onClick={() => setSavePosition("right")}
            >
              Jobbra
            </Button>
            <Button
              type="button"
              variant={savePosition === "left" ? "default" : "outline"}
              className="flex-1"
              onClick={() => setSavePosition("left")}
            >
              Balra
            </Button>
          </div>
        </CardContent>
      </Card>

      <p className="text-muted-foreground text-sm">
        Devizajelölés, hét kezdőnapja, CSV export és BI hozzáférés — a
        3–4. fázisban készülnek el.
      </p>
    </div>
  )
}
