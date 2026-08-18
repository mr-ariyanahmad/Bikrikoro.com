import type { VercelRequest } from '@vercel/node'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { DecodedIdToken } from 'firebase-admin/auth'
type FirebaseApp = import('firebase-admin/app').App

async function getFirebaseApp(): Promise<FirebaseApp> {
  const { cert, getApps, initializeApp } = await import('firebase-admin/app')
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

export async function getVerifiedFirebaseToken(req: VercelRequest): Promise<DecodedIdToken> {
  const authorization = req.headers.authorization || ''
  const idToken = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : ''
  if (!idToken) throw new Error('AUTH_REQUIRED')
  const { getAuth } = await import('firebase-admin/auth')
  return getAuth(await getFirebaseApp()).verifyIdToken(idToken)
}

export async function verifyFirebaseRequest(req: VercelRequest): Promise<string> {
  const decoded = await getVerifiedFirebaseToken(req)
  return decoded.uid
}

let serviceSupabase: SupabaseClient | null = null

export function getServiceSupabase(): SupabaseClient {
  if (serviceSupabase) return serviceSupabase
  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) throw new Error('Supabase server configuration is missing')
  serviceSupabase = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
  return serviceSupabase
}

export function isAuthError(error: unknown) {
  return error instanceof Error && error.message === 'AUTH_REQUIRED'
}
