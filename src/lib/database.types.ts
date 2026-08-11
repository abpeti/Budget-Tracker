// Kézzel karbantartott típusok a supabase/migrations séma alapján.
// Ha a séma változik (pl. supabase gen types futtatásával éles projekten),
// ezt a fájlt frissíteni kell.

export type AccountType = "cash" | "bank" | "card" | "savings" | "credit" | "other"
export type CategoryKind = "expense" | "income"
export type TransactionDirection = "expense" | "income" | "transfer"
export type RecurringFrequency = "monthly" | "weekly" | "yearly"

export interface Database {
  public: {
    Tables: {
      accounts: {
        Row: {
          id: string
          user_id: string
          name: string
          type: AccountType
          currency: string
          opening_balance: number
          icon: string | null
          color: string | null
          is_archived: boolean
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          type: AccountType
          currency?: string
          opening_balance?: number
          icon?: string | null
          color?: string | null
          is_archived?: boolean
          sort_order?: number
          created_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["accounts"]["Insert"]>
      }
      categories: {
        Row: {
          id: string
          user_id: string
          parent_id: string | null
          name: string
          kind: CategoryKind
          icon: string | null
          color: string | null
          is_archived: boolean
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          parent_id?: string | null
          name: string
          kind: CategoryKind
          icon?: string | null
          color?: string | null
          is_archived?: boolean
          sort_order?: number
          created_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["categories"]["Insert"]>
      }
      transactions: {
        Row: {
          id: string
          user_id: string
          occurred_at: string
          direction: TransactionDirection
          amount: number
          account_id: string
          to_account_id: string | null
          category_id: string | null
          payee: string | null
          note: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          occurred_at?: string
          direction: TransactionDirection
          amount: number
          account_id: string
          to_account_id?: string | null
          category_id?: string | null
          payee?: string | null
          note?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["transactions"]["Insert"]>
      }
      budgets: {
        Row: {
          id: string
          user_id: string
          category_id: string
          amount: number
          valid_from: string
          valid_to: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          category_id: string
          amount: number
          valid_from: string
          valid_to?: string | null
          created_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["budgets"]["Insert"]>
      }
      recurring_rules: {
        Row: {
          id: string
          user_id: string
          template: Record<string, unknown>
          frequency: RecurringFrequency
          day_of_period: number
          next_run: string
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          template: Record<string, unknown>
          frequency: RecurringFrequency
          day_of_period: number
          next_run: string
          is_active?: boolean
          created_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["recurring_rules"]["Insert"]>
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}
