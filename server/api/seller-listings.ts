import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getServiceSupabase, getVerifiedFirebaseToken, isAuthError } from './_server-auth.js'

function bodyOf(req: VercelRequest) {
  if (typeof req.body === 'string') return JSON.parse(req.body) as { action?: string; productId?: string }
  return (req.body ?? {}) as { action?: string; productId?: string }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!['GET', 'POST'].includes(req.method ?? '')) {
    res.setHeader('Allow', 'GET, POST')
    res.status(405).json({ error: 'Method not allowed' })
    return
  }
  try {
    const token = await getVerifiedFirebaseToken(req)
    const supabase = getServiceSupabase()
    if (req.method === 'GET') {
      const { data, error } = await supabase.from('products').select('*').eq('seller_id', token.uid).order('created_at', { ascending: false }).limit(100)
      if (error) throw error
      res.status(200).json({ products: data ?? [] })
      return
    }
    const input = bodyOf(req)
    if (!['archive', 'get'].includes(input.action ?? '') || !input.productId?.trim()) {
      res.status(400).json({ error: 'A valid seller listing action and productId are required' })
      return
    }
    if (input.action === 'get') {
      const { data, error } = await supabase.from('products').select('*').eq('id', input.productId.trim()).eq('seller_id', token.uid).maybeSingle()
      if (error) throw error
      res.status(200).json({ product: data ?? null })
      return
    }
    const { error } = await supabase.from('products').update({ is_hidden: true }).eq('id', input.productId.trim()).eq('seller_id', token.uid)
    if (error) throw error
    res.status(200).json({ ok: true })
  } catch (error) {
    if (isAuthError(error)) {
      res.status(401).json({ error: 'Firebase authentication is required' })
      return
    }
    console.error('Seller listings action failed:', error)
    res.status(400).json({ error: error instanceof Error ? error.message : 'Seller listings could not be loaded' })
  }
}
