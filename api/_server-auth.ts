import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { cert, getApps, initializeApp, type App } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'

function getFirebaseApp(): App {
  const existing = getApps()[0]
  if (existing) return existing

  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  if (json) {
    const parsed = JSON.parse(json) as { project_id?: string; client_email?: string; private_key?: string }
    if (!parsed.project_id || !parsed.client_email || !parsed.private_key) throw new Error('Firebase service-account JSON is incomplete')
    return initializeApp({ credential: cert({ projectId: parsed.project_id, clientEmail: parsed.client_email, privateKey: parsed.private_key.replace(/\\n/g, '\n') }) })
  }

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL || process.env.FIREBASE_CLIENT_EMAIL
  const privateKey = (process.env.FIREBASE_ADMIN_PRIVATE_KEY || process.env.FIREBASE_PRIVATE_KEY)?.replace(/\\n/g, '\n')
  if (!projectId || !clientEmail || !privateKey) throw new Error('Firebase service-account configuration is missing')
  return initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) })
}

export async function verifyFirebaseRequest(req: VercelRequest): Promise<string> {
  const authorization = req.headers.authorization || ''
  const idToken = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : ''
  if (!idToken) throw new Error('AUTH_REQUIRED')
  const decoded = await getAuth(getFirebaseApp()).verifyIdToken(idToken)
  return decoded.uid
}

export function getServiceSupabase(): SupabaseClient {
  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) throw new Error('Supabase server configuration is missing')
  return createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
}

export function isAuthError(error: unknown) {
  return error instanceof Error && error.message === 'AUTH_REQUIRED'
}
