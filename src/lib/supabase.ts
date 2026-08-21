import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const configuredUrl = import.meta.env.VITE_SUPABASE_URL?.trim()
const configuredAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()
export const supabaseConfigured = Boolean(configuredUrl && configuredAnonKey)

const unavailableError = () => ({ message: 'Supabase configuration is missing. VITE_SUPABASE_URL এবং VITE_SUPABASE_ANON_KEY সেট করুন।', code: 'SUPABASE_NOT_CONFIGURED' })

function createUnavailableQuery() {
  const result = { data: null, error: unavailableError() }
  const chain = new Proxy({}, {
    get(_target, property) {
      if (property === 'then') return (resolve: (value: typeof result) => unknown, reject?: (reason: unknown) => unknown) => Promise.resolve(result).then(resolve, reject)
      if (property === 'data') return null
      if (property === 'error') return result.error
      if (property === 'getPublicUrl') return () => ({ data: { publicUrl: '' }, error: result.error })
      return () => chain
    },
  })
  return chain
}

function createUnavailableSupabase(): SupabaseClient {
  const namespace = new Proxy({}, {
    get(_target, property) {
      if (property === 'from') return () => createUnavailableQuery()
      if (property === 'getPublicUrl') return () => ({ data: { publicUrl: '' }, error: unavailableError() })
      return () => createUnavailableQuery()
    },
  })
  return new Proxy({}, {
    get(_target, property) {
      if (property === 'from' || property === 'rpc') return () => createUnavailableQuery()
      if (property === 'storage' || property === 'functions' || property === 'auth') return namespace
      return () => createUnavailableQuery()
    },
  }) as unknown as SupabaseClient
}

/**
 * Same Supabase project the Android app talks to (lrwvbwkkapmwehvxkqlt).
 * When variables are missing, this is deliberately a no-op client—not a
 * fake project. Public shell rendering can continue, while live data and
 * mutations fail with a clear configuration error.
 */
export const supabase: SupabaseClient = supabaseConfigured
  ? createClient(configuredUrl!, configuredAnonKey!)
  : createUnavailableSupabase()

if (!supabaseConfigured) {
  console.warn('Supabase is not configured. Live data and storage are disabled until VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are provided.')
}
