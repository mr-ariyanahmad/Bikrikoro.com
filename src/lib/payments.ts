import { auth } from '@/lib/firebase'
import { supabase } from '@/lib/supabase'

/** Reads the same customer fee rate used by the server-side checkout RPC. */
export async function getCustomerCommissionRate(): Promise<number> {
  const { data, error } = await supabase.rpc('get_public_customer_commission_rate')
  if (error) throw error
  const rate = Number(data)
  if (!Number.isFinite(rate) || rate < 0 || rate > 100) throw new Error('Invalid customer commission rate')
  return rate
}

/** Backed by create_order_pending_payment() (010_uddoktapay_payments.sql) — website-only order path. */
export async function createPendingOrder(params: {
  productId: string
  buyerId: string
  deliveryEmail?: string
  couponCode?: string
}): Promise<string> {
  if (auth.currentUser?.uid !== params.buyerId) throw new Error('আপনার checkout session পাওয়া যায়নি। আবার login করুন।')
  const idToken = await auth.currentUser.getIdToken()
  const response = await fetch('/api/pending-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ action: 'create', productId: params.productId, deliveryEmail: params.deliveryEmail?.trim() || undefined, couponCode: params.couponCode?.trim() || undefined }),
  })
  const result = await response.json().catch(() => ({})) as { orderId?: string; error?: string }
  if (!response.ok || !result.orderId) throw new Error(result.error || `Order creation failed (HTTP ${response.status})`)
  return result.orderId
}

/** Creates the pending order and starts UddoktaPay in one authenticated server request. */
export async function createOnlineCheckout(params: {
  productId: string
  buyerId: string
  deliveryEmail?: string
  couponCode?: string
}): Promise<{ orderId: string; paymentUrl: string }> {
  if (auth.currentUser?.uid !== params.buyerId) throw new Error('আপনার checkout session পাওয়া যায়নি। আবার login করুন।')
  const idToken = await auth.currentUser.getIdToken()
  const response = await fetch('/api/pending-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({
      action: 'create_online',
      productId: params.productId,
      deliveryEmail: params.deliveryEmail?.trim() || undefined,
      couponCode: params.couponCode?.trim() || undefined,
    }),
  })
  const result = await response.json().catch(() => ({})) as { orderId?: string; paymentUrl?: string; error?: string }
  if (!response.ok || !result.orderId || !result.paymentUrl) throw new Error(result.error || `Checkout failed (HTTP ${response.status})`)
  return { orderId: result.orderId, paymentUrl: result.paymentUrl }
}

/** Resumes payment for an existing pending order. */
export async function startUddoktaPayCheckout(orderId: string): Promise<string> {
  const idToken = await auth.currentUser?.getIdToken()
  if (!idToken) throw new Error('আপনার Firebase session পাওয়া যায়নি। আবার login করুন।')
  const response = await fetch('/api/pending-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ action: 'resume_online', orderId }),
  })
  const data = await response.json().catch(() => ({})) as { paymentUrl?: string; error?: string }
  if (!response.ok || !data.paymentUrl) throw new Error(data.error || `Payment could not be started (HTTP ${response.status})`)
  return data.paymentUrl
}

export async function cancelPendingOrder(orderId: string, buyerId: string) {
  if (auth.currentUser?.uid !== buyerId) throw new Error('আপনার checkout session পাওয়া যায়নি। আবার login করুন।')
  const idToken = await auth.currentUser.getIdToken()
  const response = await fetch('/api/pending-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ action: 'cancel', orderId }),
  })
  const result = await response.json().catch(() => ({})) as { error?: string }
  if (!response.ok) throw new Error(result.error || `Order cancellation failed (HTTP ${response.status})`)
}
