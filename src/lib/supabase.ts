import { createClient } from '@supabase/supabase-js'

const configuredUrl = import.meta.env.VITE_SUPABASE_URL
const configuredAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
export const supabaseConfigured = Boolean(configuredUrl && configuredAnonKey)
if (!supabaseConfigured) {
  console.warn('Supabase is not configured. Public shell can render, but live data requires VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.')
}
const supabaseUrl = configuredUrl || 'https://bikrikoro-local.supabase.co'
const supabaseAnonKey = configuredAnonKey || 'bikrikoro-local-placeholder-anon-key'

/**
 * Same Supabase project the Android app talks to
 * (lrwvbwkkapmwehvxkqlt.supabase.co) — same tables, same RLS policies,
 * same migrations. This is intentionally the ONLY place in the website
 * that touches wallet_balances / wallet_ledger / wallet_withdrawal_requests
 * (see supabase/migrations/008_wallet.sql) — the Android app never does.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
