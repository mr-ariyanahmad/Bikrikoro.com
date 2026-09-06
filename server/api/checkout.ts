import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getServiceSupabase, getVerifiedFirebaseToken, isAuthError } from './_server-auth.js'

type Body = {
  action?: 'create_online'
  productId?: string
  deliveryEmail?: string
  couponCode?: string
}

type SupabaseErrorLike = { message?: unknown; details?: unknown; hint?: unknown; code?: unknown }

function bodyOf(req: VercelRequest): Body {
  if (typeof req.body === 'string') return JSON.parse(req.body) as Body
  return (req.body ?? {}) as Body
}

function errorMessage(error: unknown) {
  if (error && typeof error === 'object') {
    const value = error as SupabaseErrorLike
    return [value.message, value.details, value.hint].filter((item): item is string => typeof item === 'string' && item.trim()).join(' ')
  }
  return error instanceof Error ? error.message : ''
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  let buyerId = ''
  let orderId: string | null = null
  try {
    const token = await getVerifiedFirebaseToken(req)
    buyerId = token.uid
    const input = bodyOf(req)
    if (input.action !== 'create_online' || !input.productId) {
      res.status(400).json({ error: 'A digital product is required' })
      return
    }

    const supabase = getServiceSupabase()
    const result = input.couponCode?.trim()
      ? await supabase.rpc('create_order_pending_payment_with_coupon', {
          p_product_id: input.productId,
          p_buyer_id: buyerId,
          p_delivery_address: null,
          p_delivery_email: input.deliveryEmail?.trim() || null,
          p_coupon_code: input.couponCode.trim(),
        })
      : await supabase.rpc('create_order_pending_payment', {
          p_product_id: input.productId,
          p_buyer_id: buyerId,
          p_delivery_address: null,
          p_delivery_email: input.deliveryEmail?.trim() || null,
        })
    if (result.error) throw result.error
    orderId = typeof result.data === 'string' ? result.data : null
    if (!orderId) throw new Error('Order could not be created')

    const { data: charge, error: chargeError } = await supabase.functions.invoke<{ payment_url?: string; error?: string }>('uddoktapay-create-charge', {
      body: { orderId },
    })
    if (chargeError || !charge?.payment_url) {
      throw new Error(charge?.error || errorMessage(chargeError) || 'Payment could not be started')
    }

    res.status(200).json({ orderId, paymentUrl: charge.payment_url })
  } catch (error) {
    if (orderId) {
      await getServiceSupabase().rpc('buyer_cancel_pending_order', { p_order_id: orderId, p_buyer_id: buyerId }).catch(() => {})
    }
    if (isAuthError(error)) {
      res.status(401).json({ error: 'Firebase authentication is required' })
      return
    }
    console.error('Combined checkout failed:', error)
    res.status(400).json({ error: errorMessage(error) || 'Checkout could not be started' })
  }
}
