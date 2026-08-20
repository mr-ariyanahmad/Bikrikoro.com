import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getServiceSupabase, getVerifiedFirebaseToken, isAuthError } from './_server-auth.js'

type Action = 'get' | 'save' | 'add-keys'
type Body = {
  action?: Action
  productId?: string
  specifications?: Record<string, unknown>
  autoDeliveryEnabled?: boolean
  deactivateWhenOutOfStock?: boolean
  stockMode?: 'UNLIMITED' | 'QUANTITY' | 'KEY_POOL'
  stockQuantity?: number
  fulfillmentWindowMinutes?: number
  regionCode?: string
  subscriptionPeriod?: string
  warrantyPeriod?: string
  deliveryNote?: string
  keys?: string[]
}

function bodyOf(req: VercelRequest): Body {
  if (typeof req.body === 'string') return JSON.parse(req.body) as Body
  return (req.body ?? {}) as Body
}

function cleanSpecifications(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

function cleanKeys(value: unknown) {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
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
    const action = input.action
    const productId = input.productId?.trim()
    if (!productId) throw new Error('Product ID is required')
    if (action !== 'get' && action !== 'save' && action !== 'add-keys') throw new Error('Unsupported listing-options action')

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

    if (action === 'get') {
      const [{ data: options, error: optionsError }, { data: content, error: contentError }] = await Promise.all([
        supabase.from('product_digital_specs').select('product_id, specifications, auto_delivery_enabled, deactivate_when_out_of_stock, stock_mode, stock_quantity, fulfillment_window_minutes, region_code, subscription_period, warranty_period, delivery_note, updated_at').eq('product_id', productId).maybeSingle(),
        supabase.from('digital_product_contents').select('delivery_type, delivery_text, updated_at').eq('product_id', productId).maybeSingle(),
      ])
      if (optionsError) throw optionsError
      if (contentError) throw contentError
      const { count: availableKeyCount, error: keyError } = await supabase
        .from('digital_license_inventory')
        .select('id', { count: 'exact', head: true })
        .eq('product_id', productId)
        .eq('status', 'AVAILABLE')
      if (keyError) throw keyError
      res.status(200).json({ options: options ?? null, content: content ?? null, availableKeyCount: availableKeyCount ?? 0 })
      return
    }

    if (action === 'add-keys') {
      const keys = cleanKeys(input.keys)
      if (keys.length === 0) throw new Error('কমপক্ষে একটি license key দিন')
      if (keys.length > 500) throw new Error('একবারে সর্বোচ্চ ৫০০টি key যোগ করা যাবে')
      const { data, error } = await supabase.rpc('seller_add_license_keys', {
        p_seller_id: token.uid,
        p_product_id: productId,
        p_keys: keys,
      })
      if (error) throw error
      res.status(200).json({ added: Number(data ?? 0) })
      return
    }

    const stockQuantity = Math.max(0, Math.floor(Number(input.stockQuantity ?? 0)))
    const fulfillmentWindowMinutes = Math.max(0, Math.floor(Number(input.fulfillmentWindowMinutes ?? 0)))
    const stockMode = input.stockMode ?? 'UNLIMITED'
    if (!['UNLIMITED', 'QUANTITY', 'KEY_POOL'].includes(stockMode)) throw new Error('Invalid stock mode')
    if (stockMode === 'QUANTITY' && stockQuantity < 1) throw new Error('Quantity stock mode-এর জন্য stock quantity দিন')
    if (stockMode === 'KEY_POOL' && input.autoDeliveryEnabled === false) throw new Error('Key pool listing-এ automatic delivery চালু রাখতে হবে')

    const { error } = await supabase.rpc('seller_upsert_digital_listing_options', {
      p_seller_id: token.uid,
      p_product_id: productId,
      p_specifications: cleanSpecifications(input.specifications),
      p_auto_delivery_enabled: input.autoDeliveryEnabled !== false,
      p_deactivate_when_out_of_stock: input.deactivateWhenOutOfStock === true,
      p_stock_mode: stockMode,
      p_stock_quantity: stockQuantity,
      p_fulfillment_window_minutes: fulfillmentWindowMinutes,
      p_region_code: input.regionCode?.trim() || 'GLOBAL',
      p_subscription_period: input.subscriptionPeriod?.trim() || '',
      p_warranty_period: input.warrantyPeriod?.trim() || '',
      p_delivery_note: input.deliveryNote?.trim() || '',
    })
    if (error) throw error
    res.status(200).json({ ok: true })
  } catch (error) {
    if (isAuthError(error)) {
      res.status(401).json({ error: 'Firebase authentication is required' })
      return
    }
    console.error('Seller listing-options action failed:', error)
    res.status(400).json({ error: error instanceof Error ? error.message : 'Listing options could not be saved' })
  }
}
