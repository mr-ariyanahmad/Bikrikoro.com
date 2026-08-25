import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getServiceSupabase, getVerifiedFirebaseToken, isAuthError } from './_server-auth.js'

const PRODUCT_FIELDS = 'id, title, description, price, original_price, images, category_id, condition, location, is_digital, seller_id, view_count, is_escrow_protected, supports_cod, free_delivery, fast_delivery, free_return, created_at'
type Body = { action?: 'list' | 'status' | 'toggle'; productId?: string }

function bodyOf(req: VercelRequest): Body { return typeof req.body === 'string' ? JSON.parse(req.body) as Body : (req.body ?? {}) as Body }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); res.status(405).json({ error: 'Method not allowed' }); return }
  try {
    const token = await getVerifiedFirebaseToken(req)
    const { action, productId } = bodyOf(req)
    const supabase = getServiceSupabase()
    if (action === 'list') {
      const { data: favorites, error } = await supabase.from('favorites').select('product_id').eq('user_id', token.uid)
      if (error) throw error
      const ids = (favorites ?? []).map((item) => item.product_id)
      if (ids.length === 0) { res.status(200).json({ products: [] }); return }
      const { data, error: productError } = await supabase.from('public_products').select(PRODUCT_FIELDS).in('id', ids).eq('is_digital', true)
      if (productError) throw productError
      res.status(200).json({ products: data ?? [] })
      return
    }
    if (!productId?.trim()) throw new Error('Product ID is required')
    const id = productId.trim()
    if (action === 'status') {
      const { data, error } = await supabase.from('favorites').select('product_id').eq('user_id', token.uid).eq('product_id', id).maybeSingle()
      if (error) throw error
      res.status(200).json({ favorited: Boolean(data) })
      return
    }
    if (action === 'toggle') {
      const { data: existing, error: existingError } = await supabase.from('favorites').select('product_id').eq('user_id', token.uid).eq('product_id', id).maybeSingle()
      if (existingError) throw existingError
      if (existing) {
        const { error } = await supabase.from('favorites').delete().eq('user_id', token.uid).eq('product_id', id)
        if (error) throw error
        res.status(200).json({ favorited: false })
      } else {
        const { error } = await supabase.from('favorites').insert({ user_id: token.uid, product_id: id })
        if (error) throw error
        res.status(200).json({ favorited: true })
      }
      return
    }
    res.status(400).json({ error: 'Unsupported favourites action' })
  } catch (error) {
    if (isAuthError(error)) { res.status(401).json({ error: 'Firebase authentication is required' }); return }
    console.error('Mobile favorites request failed:', error)
    res.status(400).json({ error: error instanceof Error ? error.message : 'Favorites could not be updated' })
  }
}
