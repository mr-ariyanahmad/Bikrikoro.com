import { auth } from '@/lib/firebase'

export type AdminHealthState = 'OK' | 'ERROR' | 'MANUAL'
export type AdminHealthCheck = { key: string; label: string; state: AdminHealthState; value: string; detail: string }
export type AdminHealthResponse = { checked_at: string; checks: AdminHealthCheck[] }

export async function loadAdminHealth(): Promise<AdminHealthResponse> {
  const currentUser = auth.currentUser
  if (!currentUser) throw new Error('আপনার Firebase session পাওয়া যায়নি। আবার login করুন।')
  const idToken = await currentUser.getIdToken()
  const response = await fetch('/api/admin-health', {
    method: 'GET',
    headers: { Authorization: `Bearer ${idToken}` },
    cache: 'no-store',
  })
  const payload = await response.json().catch(() => ({})) as { checks?: AdminHealthCheck[]; checked_at?: string; error?: string }
  if (!response.ok || !payload.checks || !payload.checked_at) {
    throw new Error(payload.error || `System health check failed (HTTP ${response.status})`)
  }
  return { checked_at: payload.checked_at, checks: payload.checks }
}
