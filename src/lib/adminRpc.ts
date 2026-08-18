import { auth } from '@/lib/firebase'

export type AdminRpcError = { message: string; code?: string }

const READ_ONLY_RPCS = new Set([
  'admin_count_pending_seller_verifications', 'admin_find_user_profile', 'admin_get_customer_overview', 'admin_get_dashboard_overview',
  'admin_get_settings', 'admin_get_system_status', 'admin_list_banners', 'admin_list_categories', 'admin_list_chat_threads',
  'admin_list_content', 'admin_list_coupons', 'admin_list_customers', 'admin_list_digital_deliveries', 'admin_list_members',
  'admin_list_orders', 'admin_list_pending_disputes', 'admin_list_product_approval_history', 'admin_list_products', 'admin_list_reviews',
  'admin_list_roles', 'admin_list_withdrawals', 'admin_list_withdrawals_reconciled',
])
const ADMIN_REQUEST_TIMEOUT_MS = 20000

const wait = (milliseconds: number) => new Promise((resolve) => window.setTimeout(resolve, milliseconds))

export async function adminRpc<T = any>(rpc: string, args: Record<string, unknown> = {}): Promise<{ data: T | null; error: AdminRpcError | null }> {
  const currentUser = auth.currentUser
  if (!currentUser) return { data: null, error: { message: 'আপনার Firebase session পাওয়া যায়নি। আবার login করুন।' } }

  try {
    const idToken = await currentUser.getIdToken()
    const maxAttempts = READ_ONLY_RPCS.has(rpc) ? 2 : 1
    let lastError: unknown = null
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const controller = new AbortController()
      const timeout = window.setTimeout(() => controller.abort(), ADMIN_REQUEST_TIMEOUT_MS)
      try {
        const response = await fetch('/api/admin-rpc', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
          body: JSON.stringify({ rpc, args }),
          signal: controller.signal,
        })
        const payload = await response.json().catch(() => ({})) as { data?: T; error?: string; code?: string }
        if (!response.ok) return { data: null, error: { message: payload.error || `Admin operation failed (HTTP ${response.status})`, code: payload.code } }
        return { data: payload.data ?? null, error: null }
      } catch (error) {
        lastError = error
        if (attempt + 1 < maxAttempts) await wait(250)
      } finally {
        window.clearTimeout(timeout)
      }
    }
    const isTimeout = lastError instanceof DOMException && lastError.name === 'AbortError'
    const message = isTimeout ? 'Admin server response দিতে দেরি হচ্ছে। আবার চেষ্টা করুন।' : lastError instanceof Error ? lastError.message : 'Admin operation failed'
    console.error(`Admin RPC ${rpc} failed:`, lastError)
    return { data: null, error: { message } }
  } catch (error) {
    console.error(`Admin RPC ${rpc} failed:`, error)
    return { data: null, error: { message: error instanceof Error ? error.message : 'Admin operation failed' } }
  }
}
