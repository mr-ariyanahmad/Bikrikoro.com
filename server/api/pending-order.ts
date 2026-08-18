import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getServiceSupabase, getVerifiedFirebaseToken, isAuthError } from './_server-auth.js'

type Body = { action?: 'create' | 'create_wallet' | 'cancel'; productId?: string; deliveryAddress?: string; couponCode?: string; orderId?: string }
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
    if (input.action === 'create' || input.action === 'create_wallet') {
      if (!input.productId || !input.deliveryAddress?.trim()) throw new Error('Product and delivery address are required')
      const walletPayment = input.action === 'create_wallet'
      const result = walletPayment
        ? input.couponCode?.trim()
          ? await supabase.rpc('create_order_wallet_payment_with_coupon', { p_product_id: input.productId, p_buyer_id: token.uid, p_delivery_address: input.deliveryAddress.trim(), p_coupon_code: input.couponCode.trim() })
          : await supabase.rpc('create_order_wallet_payment', { p_product_id: input.productId, p_buyer_id: token.uid, p_delivery_address: input.deliveryAddress.trim() })
        : input.couponCode?.trim()
          ? await supabase.rpc('create_order_pending_payment_with_coupon', { p_product_id: input.productId, p_buyer_id: token.uid, p_delivery_address: input.deliveryAddress.trim(), p_coupon_code: input.couponCode.trim() })
          : await supabase.rpc('create_order_pending_payment', { p_product_id: input.productId, p_buyer_id: token.uid, p_delivery_address: input.deliveryAddress.trim() })
      if (result.error) throw result.error
      res.status(200).json({ orderId: result.data, paymentMethod: walletPayment ? 'WALLET' : 'ONLINE' })
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
