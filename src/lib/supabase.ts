import { createClient } from "@supabase/supabase-js"
import type { Database } from "./database.types"

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Hiányzó Supabase környezeti változók. Másold a .env.example fájlt .env néven, és töltsd ki a VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY értékeket."
  )
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storageKey: "koltsegkoveto-auth",
  },
})
