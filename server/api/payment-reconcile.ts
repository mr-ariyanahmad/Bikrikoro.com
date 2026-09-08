import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getServiceSupabase, getVerifiedFirebaseToken, isAuthError } from './_server-auth.js'

type Body = { orderId?: string; invoiceId?: string }

function bodyOf(req: VercelRequest): Body {
  return typeof req.body === 'string' ? JSON.parse(req.body) as Body : (req.body ?? {}) as Body
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    res.status(405).json({ error: 'Method not allowed' })
    return
  }
  try {
    const token = await getVerifiedFirebaseToken(req)
    const { orderId, invoiceId } = bodyOf(req)
    if (!orderId || !invoiceId) throw new Error('Order ID and invoice ID are required')
    const supabase = getServiceSupabase()
    const { data: order, error: orderError } = await supabase
      .from('orders').select('id, buyer_id, status').eq('id', orderId).maybeSingle()
    if (orderError) throw orderError
    if (!order || String(order.buyer_id) !== token.uid) {
      res.status(404).json({ error: 'Order not found' })
      return
    }
    const apiKey = process.env.UDDOKTAPAY_API_KEY
    const baseUrl = (process.env.UDDOKTAPAY_BASE_URL ?? 'https://sandbox.uddoktapay.com').replace(/\/+$/, '').replace(/\/api$/, '')
    if (!apiKey) throw new Error('Payment service configuration is missing')
    const verifyResponse = await fetch(`${baseUrl}/api/verify-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'RT-UDDOKTAPAY-API-KEY': apiKey },
      body: JSON.stringify({ invoice_id: invoiceId }),
    })
    if (!verifyResponse.ok) throw new Error('Payment verification failed')
    const verified = await verifyResponse.json() as Record<string, unknown>
    const paymentStatus = String(verified.status ?? 'PENDING').toUpperCase()
    const { error: paymentError } = await supabase.from('payments').upsert({
      order_id: orderId,
      invoice_id: invoiceId,
      amount: Number(verified.amount ?? 0),
      fee: Number(verified.fee ?? 0),
      payment_method: typeof verified.payment_method === 'string' ? verified.payment_method.toUpperCase() : null,
      sender_number: verified.sender_number ?? null,
      transaction_id: verified.transaction_id ?? null,
      status: paymentStatus,
      raw_payload: verified,
    }, { onConflict: 'invoice_id' })
    if (paymentError) throw paymentError
    if (paymentStatus === 'COMPLETED') {
      const { error: updateError } = await supabase.from('orders').update({
        status: 'ESCROW_HELD',
        payment_method: typeof verified.payment_method === 'string' ? verified.payment_method.toUpperCase() : null,
        updated_at: new Date().toISOString(),
      }).eq('id', orderId).eq('buyer_id', token.uid).eq('status', 'PENDING_PAYMENT')
      if (updateError) throw updateError
    }
    res.status(200).json({ status: paymentStatus === 'COMPLETED' ? 'ESCROW_HELD' : order.status })
  } catch (error) {
    if (isAuthError(error)) { res.status(401).json({ error: 'Firebase authentication is required' }); return }
    console.error('Payment reconciliation failed:', error)
    res.status(400).json({ error: error instanceof Error ? error.message : 'Payment could not be reconciled' })
  }
}
