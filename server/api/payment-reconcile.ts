import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getServiceSupabase, getVerifiedFirebaseToken, isAuthError } from './_server-auth.js'

type Body = { orderId?: string; invoiceId?: string; transactionId?: string }

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
    const { orderId, invoiceId: requestedInvoiceId, transactionId } = bodyOf(req)
    if (!orderId) throw new Error('Order ID is required')
    const supabase = getServiceSupabase()
    const { data: order, error: orderError } = await supabase
      .from('orders').select('id, buyer_id, seller_id, status, order_number, product_title, subtotal, price, discount_amount, coupon_code, coupon_funding_source, escrow_fee, delivery_email').eq('id', orderId).maybeSingle()
    if (orderError) throw orderError
    if (!order || String(order.buyer_id) !== token.uid) {
      res.status(404).json({ error: 'Order not found' })
      return
    }
    // The provider normally returns invoice_id on redirect, but some mobile
    // return flows only expose transaction_id. The webhook may already have
    // stored the matching invoice, so recover it by the authenticated order.
    let invoiceId = requestedInvoiceId?.trim() || ''
    if (!invoiceId) {
      const paymentQuery = supabase.from('payments').select('invoice_id, transaction_id, status').eq('order_id', orderId).order('created_at', { ascending: false }).limit(5)
      const { data: storedPayments, error: storedPaymentError } = transactionId
        ? await paymentQuery.eq('transaction_id', transactionId.trim())
        : await paymentQuery
      if (storedPaymentError) throw storedPaymentError
      const storedPayment = storedPayments?.find((payment) => payment.invoice_id)
      invoiceId = storedPayment?.invoice_id ?? ''
      if (!invoiceId) {
        res.status(202).json({ status: order.status, message: 'পেমেন্টের invoice এখনও পাওয়া যায়নি।' })
        return
      }
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
      const email = process.env.RESEND_API_KEY
      const from = process.env.RESEND_FROM_EMAIL
      const recipient = order.delivery_email
      if (email && from && recipient) {
        const discount = Number(order.discount_amount ?? 0)
        const couponLine = discount > 0 ? `<p><strong>Coupon (${order.coupon_code ?? ''}):</strong> -৳${discount.toFixed(2)} (${order.coupon_funding_source === 'SELLER' ? 'seller-funded' : 'BikriKoro-funded'})</p>` : ''
        await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${email}`, 'Content-Type': 'application/json', 'Idempotency-Key': `bikrikoro-invoice-${order.id}` }, body: JSON.stringify({ from, to: [recipient], subject: `Payment invoice — BKCOM${order.order_number ?? order.id.slice(0, 6)}`, html: `<h2>BikriKoro payment invoice</h2><p>Product: ${order.product_title}</p><p>Subtotal: ৳${Number(order.subtotal ?? order.price).toFixed(2)}</p>${couponLine}<p>Product price: ৳${Number(order.price).toFixed(2)}</p><p>Escrow fee: ৳${Number(order.escrow_fee).toFixed(2)}</p><p><strong>Total paid: ৳${(Number(order.price) + Number(order.escrow_fee)).toFixed(2)}</strong></p>` }) })
      }
    }
    res.status(200).json({ status: paymentStatus === 'COMPLETED' ? 'ESCROW_HELD' : order.status })
  } catch (error) {
    if (isAuthError(error)) { res.status(401).json({ error: 'Firebase authentication is required' }); return }
    console.error('Payment reconciliation failed:', error)
    res.status(400).json({ error: error instanceof Error ? error.message : 'Payment could not be reconciled' })
  }
}
