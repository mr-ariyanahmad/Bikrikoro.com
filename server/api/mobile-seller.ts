import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getServiceSupabase, getVerifiedFirebaseToken, isAuthError } from './_server-auth.js'

/** Returns only the seller's own listing management summary for the native dashboard. */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    res.status(405).json({ error: 'Method not allowed' })
    return
  }
  try {
    const token = await getVerifiedFirebaseToken(req)
    const supabase = getServiceSupabase()
    const { data, error } = await supabase.rpc('seller_list_products', { p_seller_id: token.uid })
    if (error) throw error
    const listings = (data ?? []).map((product) => ({
      id: product.id,
      title: product.title,
      price: product.price,
      images: Array.isArray(product.images) ? product.images : [],
      approval_status: product.approval_status,
      is_hidden: product.is_hidden,
      created_at: product.created_at,
    }))
    res.status(200).json({ listings })
  } catch (error) {
    if (isAuthError(error)) {
      res.status(401).json({ error: 'Firebase authentication is required' })
      return
    }
    console.error('Mobile seller dashboard failed:', error)
    res.status(400).json({ error: error instanceof Error ? error.message : 'Seller dashboard could not be loaded' })
  }
}
