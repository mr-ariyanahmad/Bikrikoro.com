import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getServiceSupabase, getVerifiedFirebaseToken, isAuthError } from './_server-auth'

type Action = 'confirm_delivery' | 'buyer_cancel' | 'seller_prepare' | 'seller_ship' | 'seller_deliver' | 'seller_cancel' | 'report_dispute' | 'send_dispute_message'

type Body = {
  action?: Action
  orderId?: string
  disputeId?: string
  reason?: string
  description?: string
  evidenceUrls?: string[]
  message?: string
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
    const orderId = input.orderId?.trim()
    const action = input.action
    if (!action) throw new Error('Action is required')

    let data: unknown = null
    if (action === 'confirm_delivery') {
      if (!orderId) throw new Error('Order ID is required')
      const result = await supabase.rpc('confirm_order_delivery', { p_order_id: orderId, p_buyer_id: token.uid })
      if (result.error) throw result.error
    } else if (action === 'buyer_cancel') {
      if (!orderId) throw new Error('Order ID is required')
      const result = await supabase.rpc('buyer_cancel_order', { p_order_id: orderId, p_buyer_id: token.uid })
      if (result.error) throw result.error
    } else if (action === 'seller_prepare') {
      if (!orderId) throw new Error('Order ID is required')
      const result = await supabase.rpc('seller_mark_preparing', { p_order_id: orderId, p_seller_id: token.uid })
      if (result.error) throw result.error
    } else if (action === 'seller_ship') {
      if (!orderId) throw new Error('Order ID is required')
      const result = await supabase.rpc('seller_mark_shipped', { p_order_id: orderId, p_seller_id: token.uid })
      if (result.error) throw result.error
    } else if (action === 'seller_deliver') {
      if (!orderId) throw new Error('Order ID is required')
      const result = await supabase.rpc('seller_mark_delivered', { p_order_id: orderId, p_seller_id: token.uid })
      if (result.error) throw result.error
    } else if (action === 'seller_cancel') {
      if (!orderId) throw new Error('Order ID is required')
      const result = await supabase.rpc('seller_cancel_order', { p_order_id: orderId, p_seller_id: token.uid })
      if (result.error) throw result.error
    } else if (action === 'report_dispute') {
      if (!orderId || !input.reason || !input.description?.trim()) throw new Error('Dispute details are required')
      const result = await supabase.rpc('report_order_dispute', {
        p_order_id: orderId,
        p_buyer_id: token.uid,
        p_reason: input.reason,
        p_description: input.description.trim(),
        p_evidence_urls: Array.isArray(input.evidenceUrls) ? input.evidenceUrls : [],
      })
      if (result.error) throw result.error
      data = result.data
    } else if (action === 'send_dispute_message') {
      if (!input.disputeId || !input.message?.trim()) throw new Error('Dispute message is required')
      const result = await supabase.rpc('send_dispute_message', { p_dispute_id: input.disputeId, p_sender_id: token.uid, p_message: input.message.trim() })
      if (result.error) throw result.error
    } else {
      throw new Error('Unsupported order action')
    }

    res.status(200).json({ data })
  } catch (error) {
    if (isAuthError(error)) {
      res.status(401).json({ error: 'Firebase authentication is required' })
      return
    }
    console.error('Order action failed:', error)
    res.status(400).json({ error: error instanceof Error ? error.message : 'Order action failed' })
  }
}
