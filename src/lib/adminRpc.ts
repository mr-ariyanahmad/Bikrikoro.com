import { auth } from '@/lib/firebase'

export type AdminRpcError = { message: string; code?: string }

export async function adminRpc<T = any>(rpc: string, args: Record<string, unknown> = {}): Promise<{ data: T | null; error: AdminRpcError | null }> {
  const currentUser = auth.currentUser
  if (!currentUser) return { data: null, error: { message: 'আপনার Firebase session পাওয়া যায়নি। আবার login করুন।' } }

  try {
    const idToken = await currentUser.getIdToken()
    const response = await fetch('/api/admin-rpc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ rpc, args }),
    })
    const payload = await response.json().catch(() => ({})) as { data?: T; error?: string }
    if (!response.ok) return { data: null, error: { message: payload.error || `Admin operation failed (HTTP ${response.status})` } }
    return { data: payload.data ?? null, error: null }
  } catch (error) {
    console.error(`Admin RPC ${rpc} failed:`, error)
    return { data: null, error: { message: error instanceof Error ? error.message : 'Admin operation failed' } }
  }
}
