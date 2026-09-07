import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getServiceSupabase, getVerifiedFirebaseToken, isAuthError } from './_server-auth.js'
import { sendNewOrderEmail, sendPendingPaymentReminderEmail } from '../lib/resendEmail.js'

type Body = { action?: 'create' | 'create_wallet' | 'create_online' | 'cancel'; productId?: string; deliveryEmail?: string; couponCode?: string; orderId?: string }
type SupabaseErrorLike = { message?: unknown; details?: unknown; hint?: unknown; code?: unknown }

function supabaseErrorMessage(error: unknown) {
  if (error && typeof error === 'object') {
    const value = error as SupabaseErrorLike
    const message = typeof value.message === 'string' ? value.message.trim() : ''
    const details = typeof value.details === 'string' ? value.details.trim() : ''
    const hint = typeof value.hint === 'string' ? value.hint.trim() : ''
    return [message, details, hint].filter(Boolean).join(' ')
  }
  return error instanceof Error ? error.message : ''
}

function bodyOf(req: VercelRequest): Body {
  if (typeof req.body === 'string') return JSON.parse(req.body) as Body
  return (req.body ?? {}) as Body
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    const token = await getVerifiedFirebaseToken(req)
    const input = bodyOf(req)
    const supabase = getServiceSupabase()
    try { await supabase.rpc('expire_pending_payment_orders', { p_limit: 500 }) } catch { /* expiry cleanup must never block order loading */ }
    if (input.action === 'create' || input.action === 'create_wallet' || input.action === 'create_online') {
      if (!input.productId) throw new Error('Digital product is required')
      const walletPayment = input.action === 'create_wallet'
      const onlinePayment = input.action === 'create_online'
      const result = walletPayment
        ? input.couponCode?.trim()
          ? await supabase.rpc('create_order_wallet_payment_with_coupon', { p_product_id: input.productId, p_buyer_id: token.uid, p_delivery_address: null, p_delivery_email: input.deliveryEmail?.trim() || null, p_coupon_code: input.couponCode.trim() })
          : await supabase.rpc('create_order_wallet_payment', { p_product_id: input.productId, p_buyer_id: token.uid, p_delivery_address: null, p_delivery_email: input.deliveryEmail?.trim() || null })
        : input.couponCode?.trim()
          ? await supabase.rpc('create_order_pending_payment_with_coupon', { p_product_id: input.productId, p_buyer_id: token.uid, p_delivery_address: null, p_delivery_email: input.deliveryEmail?.trim() || null, p_coupon_code: input.couponCode.trim() })
          : await supabase.rpc('create_order_pending_payment', { p_product_id: input.productId, p_buyer_id: token.uid, p_delivery_address: null, p_delivery_email: input.deliveryEmail?.trim() || null })
      if (result.error) throw result.error
      const orderId = typeof result.data === 'string' ? result.data : ''
      if (!orderId) throw new Error('Order could not be created')
      const { data: createdOrder } = await supabase.from('orders').select('id, order_number, product_title, price, escrow_fee, status, buyer_id, seller_id, delivery_email').eq('id', orderId).maybeSingle()
      if (createdOrder) {
        const participantIds = [createdOrder.buyer_id, createdOrder.seller_id].filter((value): value is string => Boolean(value))
        const { data: profiles } = participantIds.length > 0 ? await supabase.from('profiles').select('id, name, email').in('id', participantIds) : { data: [] as Array<{ id: string; name: string | null; email: string | null }> }
        const buyer = (profiles ?? []).find((profile) => profile.id === createdOrder.buyer_id)
        const seller = (profiles ?? []).find((profile) => profile.id === createdOrder.seller_id)
        const amount = Number(createdOrder.price) + Number(createdOrder.escrow_fee)
        const orderLink = `https://www.bikrikoro.com/orders/${orderId}`
        const emailTasks = []
        if (!onlinePayment && seller?.email) emailTasks.push(sendNewOrderEmail({ orderId, orderNumber: createdOrder.order_number, role: 'SELLER', to: seller.email, productTitle: createdOrder.product_title, price: amount, status: createdOrder.status, customerName: buyer?.name ?? 'Customer', sellerName: seller.name ?? 'Seller', orderLink }))
        if (!onlinePayment && (createdOrder.delivery_email || buyer?.email)) emailTasks.push(sendNewOrderEmail({ orderId, orderNumber: createdOrder.order_number, role: 'CUSTOMER', to: createdOrder.delivery_email || buyer?.email || '', productTitle: createdOrder.product_title, price: amount, status: createdOrder.status, customerName: buyer?.name ?? 'Customer', sellerName: seller?.name ?? 'Seller', orderLink }))
        if (emailTasks.length > 0) void Promise.all(emailTasks).catch((emailError) => console.error('New order email delivery failed:', emailError))
      }
      if (onlinePayment) {
        const { data: charge, error: chargeError } = await supabase.functions.invoke<{ payment_url?: string; error?: string }>('uddoktapay-create-charge', { body: { orderId } })
        if (chargeError || !charge?.payment_url) {
          try { await supabase.rpc('buyer_cancel_pending_order', { p_order_id: orderId, p_buyer_id: token.uid }) } catch { /* best-effort rollback */ }
          throw new Error(charge?.error || chargeError?.message || 'Payment could not be started')
        }
        const { data: reminderOrder } = await supabase.from('orders').select('order_number, product_title, price, escrow_fee, payment_expires_at, delivery_email').eq('id', orderId).maybeSingle()
        if (reminderOrder?.payment_expires_at) {
          const { data: profile } = reminderOrder.delivery_email ? { data: null } : await supabase.from('profiles').select('email').eq('id', token.uid).maybeSingle()
          const recipient = reminderOrder.delivery_email || profile?.email || ''
          if (recipient) {
            void sendPendingPaymentReminderEmail({
              orderId,
              orderNumber: reminderOrder.order_number,
              to: recipient,
              productTitle: reminderOrder.product_title,
              amount: Number(reminderOrder.price) + Number(reminderOrder.escrow_fee),
              expiresAt: reminderOrder.payment_expires_at,
              orderLink: `https://www.bikrikoro.com/orders/${orderId}`,
            }).then((result) => {
              if (!result.skipped) return supabase.from('orders').update({ pending_payment_reminder_sent_at: new Date().toISOString() }).eq('id', orderId)
              return null
            }).catch((reminderError) => console.error('Pending payment reminder failed:', reminderError))
          }
        }
        res.status(200).json({ orderId, paymentUrl: charge.payment_url, paymentMethod: 'ONLINE' })
        return
      }
      res.status(200).json({ orderId, paymentMethod: walletPayment ? 'WALLET' : 'ONLINE' })
      return
    }
    if (input.action === 'cancel') {
      if (!input.orderId) throw new Error('Order ID is required')
      const result = await supabase.rpc('buyer_cancel_pending_order', { p_order_id: input.orderId, p_buyer_id: token.uid })
      if (result.error) throw result.error
      res.status(200).json({ ok: true })
      return
    }
    throw new Error('Unsupported pending-order action')
  } catch (error) {
    if (isAuthError(error)) {
      res.status(401).json({ error: 'Firebase authentication is required' })
      return
    }
    console.error('Pending order action failed:', error)
    const message = supabaseErrorMessage(error) || 'Checkout order action failed'
    const code = error && typeof error === 'object' && typeof (error as SupabaseErrorLike).code === 'string' ? (error as SupabaseErrorLike).code : undefined
    res.status(400).json({ error: message, ...(code ? { code } : {}) })
  }
}
