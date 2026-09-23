import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getServiceSupabase, getVerifiedFirebaseToken, isAuthError } from './_server-auth.js'

type Body = { orderId?: string; invoiceId?: string; transactionId?: string }
function bodyOf(req: VercelRequest): Body { return typeof req.body === 'string' ? JSON.parse(req.body) as Body : (req.body ?? {}) as Body }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); res.status(405).json({ error: 'Method not allowed' }); return }
  try {
    const token = await getVerifiedFirebaseToken(req)
    const { orderId, invoiceId: requestedInvoiceId, transactionId } = bodyOf(req)
    if (!orderId) throw new Error('Order ID is required')
    const supabase = getServiceSupabase()
    const { data: order, error: orderError } = await supabase.from('orders').select('id, buyer_id, status').eq('id', orderId).maybeSingle()
    if (orderError) throw orderError
    if (!order || String(order.buyer_id) !== token.uid) { res.status(404).json({ error: 'Order not found' }); return }

    let invoiceId = requestedInvoiceId?.trim() || ''
    if (!invoiceId && transactionId?.trim()) {
      const { data: payment, error: paymentError } = await supabase.from('payments').select('invoice_id').eq('order_id', orderId).eq('transaction_id', transactionId.trim()).order('created_at', { ascending: false }).limit(1).maybeSingle()
      if (paymentError) throw paymentError
      invoiceId = payment?.invoice_id ?? ''
    }

    const { data: result, error: reconcileError } = await supabase.functions.invoke<{ status?: string; paymentStatus?: string; error?: string }>('uddoktapay-reconcile-payment', {
      body: { orderId, invoiceId: invoiceId || undefined },
    })
    if (reconcileError) throw reconcileError
    if (result?.error && result.status !== 'ESCROW_HELD' && result.status !== 'DIGITAL_DELIVERED' && result.status !== 'COMPLETED') {
      res.status(result.status === order.status ? 202 : 400).json({ status: result.status ?? order.status, error: result.error })
      return
    }
    res.status(200).json({ status: result?.status ?? order.status })
  } catch (error) {
    if (isAuthError(error)) { res.status(401).json({ error: 'Firebase authentication is required' }); return }
    console.error('Payment reconciliation failed:', error)
    res.status(400).json({ error: error instanceof Error ? error.message : 'Payment could not be reconciled' })
  }
}
