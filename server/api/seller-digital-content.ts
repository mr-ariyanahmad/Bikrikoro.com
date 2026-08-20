import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getServiceSupabase, getVerifiedFirebaseToken, isAuthError } from './_server-auth.js'

type Action = 'get' | 'save' | 'clear'
type Body = {
  action?: Action
  productId?: string
  deliveryType?: 'INSTRUCTIONS' | 'LICENSE_KEY' | 'DOWNLOAD_LINK'
  deliveryText?: string
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
    const productId = input.productId?.trim()
    if (!productId) throw new Error('Product ID is required')
    if (!input.action) throw new Error('Action is required')

    const supabase = getServiceSupabase()
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('id, seller_id, is_digital')
      .eq('id', productId)
      .maybeSingle()
    if (productError) throw productError
    if (!product || product.seller_id !== token.uid || product.is_digital !== true) {
      res.status(404).json({ error: 'Digital listing not found or not yours' })
      return
    }

    if (input.action === 'get') {
      const { data, error } = await supabase
        .from('digital_product_contents')
        .select('delivery_type, delivery_text, updated_at')
        .eq('product_id', productId)
        .maybeSingle()
      if (error) throw error
      res.status(200).json({ content: data ?? null })
      return
    }

    if (input.action === 'save') {
      if (!input.deliveryType || !input.deliveryText?.trim()) throw new Error('Digital delivery details are required')
      const { error } = await supabase.rpc('seller_upsert_digital_content', {
        p_seller_id: token.uid,
        p_product_id: productId,
        p_delivery_type: input.deliveryType,
        p_delivery_text: input.deliveryText.trim(),
      })
      if (error) throw error
      res.status(200).json({ ok: true })
      return
    }

    if (input.action === 'clear') {
      const { error } = await supabase.rpc('seller_clear_digital_content', {
        p_seller_id: token.uid,
        p_product_id: productId,
      })
      if (error) throw error
      res.status(200).json({ ok: true })
      return
    }

    throw new Error('Unsupported digital-content action')
  } catch (error) {
    if (isAuthError(error)) {
      res.status(401).json({ error: 'Firebase authentication is required' })
      return
    }
    console.error('Seller digital-content action failed:', error)
    res.status(400).json({ error: error instanceof Error ? error.message : 'Digital delivery data could not be saved' })
  }
}
