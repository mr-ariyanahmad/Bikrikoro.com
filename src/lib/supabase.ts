import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  // Loud failure on purpose — a silently-undefined client produces
  // confusing "fetch failed" errors deep in every page instead of one
  // clear message at startup.
  throw new Error(
    'Missing Supabase env vars. Copy .env.example to .env and fill in VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.'
  )
}

/**
 * Same Supabase project the Android app talks to
 * (lrwvbwkkapmwehvxkqlt.supabase.co) — same tables, same RLS policies,
 * same migrations. This is intentionally the ONLY place in the website
 * that touches wallet_balances / wallet_ledger / wallet_withdrawal_requests
 * (see supabase/migrations/008_wallet.sql) — the Android app never does.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
