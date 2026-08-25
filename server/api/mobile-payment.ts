import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getServiceSupabase, getVerifiedFirebaseToken, isAuthError } from './_server-auth.js'

type Body = { orderId?: string }

function bodyOf(req: VercelRequest): Body {
  return typeof req.body === 'string' ? JSON.parse(req.body) as Body : (req.body ?? {}) as Body
}

/** Native checkout bridge: verifies the Firebase buyer before it asks the existing
 * server-side UddoktaPay function for a hosted payment URL. */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    const token = await getVerifiedFirebaseToken(req)
    const { orderId } = bodyOf(req)
    if (!orderId) throw new Error('Order ID is required')

    const supabase = getServiceSupabase()
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, buyer_id, status')
      .eq('id', orderId)
      .maybeSingle()
    if (orderError) throw orderError
    if (!order || String(order.buyer_id) !== token.uid) {
      res.status(404).json({ error: 'Order not found' })
      return
    }
    if (order.status !== 'PENDING_PAYMENT') {
      res.status(409).json({ error: 'Order is not awaiting payment' })
      return
    }

    const url = process.env.VITE_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !serviceRoleKey) throw new Error('Payment service configuration is missing')
    const chargeResponse = await fetch(`${url.replace(/\/$/, '')}/functions/v1/uddoktapay-create-charge`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
      },
      body: JSON.stringify({ orderId, returnUrl: 'bikrikoro://payment/callback' }),
    })
    const payload = await chargeResponse.json().catch(() => null) as { payment_url?: string; error?: string } | null
    if (!chargeResponse.ok || !payload?.payment_url) {
      throw new Error(payload?.error || 'Payment checkout could not be started')
    }
    res.status(200).json({ paymentUrl: payload.payment_url })
  } catch (error) {
    if (isAuthError(error)) {
      res.status(401).json({ error: 'Firebase authentication is required' })
      return
    }
    console.error('Mobile payment bridge failed:', error)
    res.status(400).json({ error: error instanceof Error ? error.message : 'Payment checkout could not be started' })
  }
}
