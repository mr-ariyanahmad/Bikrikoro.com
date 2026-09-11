import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getServiceSupabase, getVerifiedFirebaseToken, isAuthError } from './_server-auth.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); res.status(405).json({ error: 'Method not allowed' }); return }
  try {
    const token = await getVerifiedFirebaseToken(req)
    const body = typeof req.body === 'string' ? JSON.parse(req.body) as { categoryId?: string; weight?: number } : (req.body ?? {}) as { categoryId?: string; weight?: number }
    const categoryId = body.categoryId?.trim()
    if (!categoryId) { res.status(400).json({ error: 'categoryId is required' }); return }
    const { error } = await getServiceSupabase().rpc('record_product_category_interest', { p_user_id: token.uid, p_category_id: categoryId, p_weight: Math.min(Math.max(Number(body.weight ?? 1), 0.5), 5) })
    if (error) throw error
    res.status(200).json({ ok: true })
  } catch (error) {
    if (isAuthError(error)) { res.status(401).json({ error: 'Firebase authentication is required' }); return }
    console.error('Product interest recording failed:', error)
    res.status(400).json({ error: error instanceof Error ? error.message : 'Interest could not be recorded' })
  }
}
