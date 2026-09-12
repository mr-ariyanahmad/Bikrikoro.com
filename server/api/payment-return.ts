import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getServiceSupabase } from './_server-auth.js'
function queryValue(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value }
function money(value: unknown) { return Math.round(Number(value ?? 0) * 100) / 100 }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); res.status(405).send('Method not allowed'); return }
  const invoiceId = queryValue(req.query.invoice_id) || queryValue(req.query.invoice)
  const requestedOrderId = queryValue(req.query.order_id)
  const siteUrl = (process.env.SITE_URL || 'https://bikrikoro.com').replace(/\/$/, '')
  if (!invoiceId) { res.redirect(302, `${siteUrl}/orders/payment-callback?order_id=${encodeURIComponent(requestedOrderId || '')}`); return }
  try {
    const apiKey = process.env.UDDOKTAPAY_API_KEY
    const baseUrl = (process.env.UDDOKTAPAY_BASE_URL || 'https://sandbox.uddoktapay.com').replace(/\/+$/, '').replace(/\/api$/, '')
    if (!apiKey) throw new Error('Payment service configuration is missing')
    const verifyResponse = await fetch(`${baseUrl}/api/verify-payment`, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'RT-UDDOKTAPAY-API-KEY': apiKey }, body: JSON.stringify({ invoice_id: invoiceId }) })
    if (!verifyResponse.ok) throw new Error('Payment verification failed')
    const verified = await verifyResponse.json() as Record<string, unknown>
    const status = String(verified.status || 'PENDING').toUpperCase()
    const metadata = verified.metadata && typeof verified.metadata === 'object' ? verified.metadata as Record<string, unknown> : {}
    const orderId = typeof metadata.order_id === 'string' ? metadata.order_id : ''
    if (!orderId || (requestedOrderId && requestedOrderId !== orderId)) throw new Error('Payment order reference mismatch')
    const supabase = getServiceSupabase()
    const { data: order, error: orderError } = await supabase.from('orders').select('id, status, price, escrow_fee').eq('id', orderId).maybeSingle()
    if (orderError) throw orderError
    if (!order) throw new Error('Order not found')
    const providerAmount = money(verified.charged_amount ?? verified.amount)
    const expectedAmount = money(Number(order.price) + Number(order.escrow_fee))
    if (status === 'COMPLETED' && providerAmount !== expectedAmount) throw new Error('Payment amount mismatch')
    const { error: paymentError } = await supabase.from('payments').upsert({ order_id: order.id, invoice_id: invoiceId, amount: providerAmount, fee: money(verified.fee), payment_method: typeof verified.payment_method === 'string' ? verified.payment_method.toUpperCase() : null, sender_number: verified.sender_number || null, transaction_id: verified.transaction_id || null, status, raw_payload: verified }, { onConflict: 'invoice_id' })
    if (paymentError) throw paymentError
    if (status === 'COMPLETED') {
      const { error: transitionError } = await supabase.from('orders').update({ status: 'ESCROW_HELD', payment_method: typeof verified.payment_method === 'string' ? verified.payment_method.toUpperCase() : null, updated_at: new Date().toISOString() }).eq('id', order.id).eq('status', 'PENDING_PAYMENT').select('id').maybeSingle()
      if (transitionError) throw transitionError
    }
    res.redirect(302, `${siteUrl}/orders/payment-callback?order_id=${encodeURIComponent(order.id)}&invoice_id=${encodeURIComponent(invoiceId)}`)
  } catch (error) {
    console.error('UddoktaPay return reconciliation failed:', error)
    res.redirect(302, `${siteUrl}/orders/payment-callback?order_id=${encodeURIComponent(requestedOrderId || '')}&invoice_id=${encodeURIComponent(invoiceId)}&reconcile_error=1`)
  }
}
