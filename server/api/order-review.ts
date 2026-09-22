import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getServiceSupabase, getVerifiedFirebaseToken, isAuthError } from './_server-auth.js'

type Body = { orderId?: string; productId?: string; sellerId?: string; buyerName?: string; rating?: number; comment?: string }

function bodyOf(req: VercelRequest): Body {
  if (typeof req.body === 'string') return JSON.parse(req.body) as Body
  return (req.body ?? {}) as Body
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); res.status(405).json({ error: 'Method not allowed' }); return }
  try {
    const token = await getVerifiedFirebaseToken(req)
    const input = bodyOf(req)
    const rating = Number(input.rating)
    if (!input.orderId?.trim() || !input.productId?.trim() || !input.sellerId?.trim() || !Number.isInteger(rating) || rating < 1 || rating > 5) {
      res.status(400).json({ error: 'রিভিউর তথ্য অসম্পূর্ণ বা rating সঠিক নয়।' }); return
    }
    const { data, error } = await getServiceSupabase().rpc('submit_order_review', {
      p_review_id: crypto.randomUUID(), p_order_id: input.orderId.trim(), p_product_id: input.productId.trim(), p_seller_id: input.sellerId.trim(),
      p_buyer_id: token.uid, p_buyer_name: input.buyerName?.trim() || '', p_rating: rating, p_comment: input.comment?.trim() || '',
    })
    if (error) throw error
    res.status(200).json({ ok: true, result: data ?? null })
  } catch (error) {
    if (isAuthError(error)) { res.status(401).json({ error: 'Firebase authentication is required' }); return }
    const message = error instanceof Error ? error.message : ''
    if (message.includes('duplicate key') || message.includes('unique')) { res.status(409).json({ error: 'এই অর্ডারের জন্য আগেই রিভিউ দেওয়া হয়েছে।' }); return }
    if (message.includes('Only completed orders')) { res.status(400).json({ error: 'শুধু সম্পন্ন অর্ডারের জন্য রিভিউ দেওয়া যাবে।' }); return }
    if (message.includes('Not authorized') || message.includes('do not match')) { res.status(403).json({ error: 'এই অর্ডারের জন্য আপনার রিভিউ দেওয়ার অনুমতি নেই।' }); return }
    console.error('Order review submission failed:', error)
    res.status(400).json({ error: 'রিভিউ জমা দেওয়া যায়নি — আবার চেষ্টা করুন।' })
  }
}
