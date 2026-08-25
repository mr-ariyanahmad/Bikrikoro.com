import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const PRODUCT_FIELDS = 'id, title, description, price, original_price, images, category_id, condition, location, is_digital, seller_id, view_count, is_escrow_protected, supports_cod, free_delivery, fast_delivery, free_return, created_at'
const MAX_PAGE_SIZE = 24

function queryValue(value: string | string[] | undefined) {
  return typeof value === 'string' ? value.trim() : ''
}

function boundedInteger(value: string, fallback: number, maximum: number) {
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? Math.max(0, Math.min(parsed, maximum)) : fallback
}

/**
 * Native clients receive only the same public listing fields exposed on the
 * website. Seller credentials, delivery text, license keys and base-table-only
 * data remain unavailable through this endpoint.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) {
    res.status(503).json({ error: 'Marketplace is temporarily unavailable' })
    return
  }

  const action = queryValue(req.query.action) || 'products'
  const supabase = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } })

  try {
    if (action === 'categories') {
      const { data, error } = await supabase
        .from('categories')
        .select('id, name, icon_url, sort_order')
        .order('sort_order')
        .limit(MAX_PAGE_SIZE)
      if (error) throw error
      res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=900')
      res.status(200).json({ categories: data ?? [] })
      return
    }

    if (action === 'product') {
      const id = queryValue(req.query.id)
      if (!id) {
        res.status(400).json({ error: 'Product ID is required' })
        return
      }
      const { data, error } = await supabase
        .from('public_products')
        .select(PRODUCT_FIELDS)
        .eq('id', id)
        .eq('is_digital', true)
        .maybeSingle()
      if (error) throw error
      if (!data) {
        res.status(404).json({ error: 'Product not found' })
        return
      }
      res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300')
      res.status(200).json({ product: data })
      return
    }

    if (action !== 'products') {
      res.status(400).json({ error: 'Unsupported catalog action' })
      return
    }

    const limit = Math.max(1, boundedInteger(queryValue(req.query.limit), 12, MAX_PAGE_SIZE))
    const offset = boundedInteger(queryValue(req.query.offset), 0, 10_000)
    const categoryId = queryValue(req.query.categoryId)
    const search = queryValue(req.query.q).slice(0, 80)

    let query = supabase
      .from('public_products')
      .select(PRODUCT_FIELDS)
      .eq('is_digital', true)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (categoryId) query = query.eq('category_id', categoryId)
    if (search) query = query.ilike('title', `%${search.replace(/[%_,]/g, '')}%`)

    const { data, error } = await query
    if (error) throw error

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300')
    res.status(200).json({ products: data ?? [], nextOffset: (data?.length ?? 0) === limit ? offset + limit : null })
  } catch (error) {
    console.error('Mobile catalog request failed:', error)
    res.status(500).json({ error: 'Marketplace data could not be loaded' })
  }
}
