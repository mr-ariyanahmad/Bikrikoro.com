import { supabase } from '@/lib/supabase'
import { auth } from '@/lib/firebase'

/** Backed by create_order_pending_payment() (010_uddoktapay_payments.sql) — website-only order path. */
export async function createPendingOrder(params: {
  productId: string
  buyerId: string
  deliveryAddress: string
  couponCode?: string
}): Promise<string> {
  if (auth.currentUser?.uid !== params.buyerId) throw new Error('আপনার checkout session পাওয়া যায়নি। আবার login করুন।')
  const idToken = await auth.currentUser.getIdToken()
  const response = await fetch('/api/pending-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ action: 'create', productId: params.productId, deliveryAddress: params.deliveryAddress, couponCode: params.couponCode?.trim() || undefined }),
  })
  const result = await response.json().catch(() => ({})) as { orderId?: string; error?: string }
  if (!response.ok || !result.orderId) throw new Error(result.error || `Order creation failed (HTTP ${response.status})`)
  return result.orderId
}

/** Asks the uddoktapay-create-charge Edge Function for a hosted payment URL, then the caller redirects there. */
export async function startUddoktaPayCheckout(orderId: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke<{ payment_url?: string; error?: string }>(
    'uddoktapay-create-charge',
    { body: { orderId } }
  )
  if (error || !data?.payment_url) {
    throw new Error(data?.error || error?.message || 'Payment could not be started')
  }
  return data.payment_url
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
