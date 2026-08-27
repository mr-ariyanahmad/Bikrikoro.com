import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

function publicSiteUrl(req: VercelRequest) {
  const forwardedHost = req.headers['x-forwarded-host']
  const rawHost = Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost || req.headers.host
  const host = rawHost?.split(',')[0]?.trim().toLowerCase()
  if (host === 'bikrikoro.com' || host === 'www.bikrikoro.com') return 'https://www.bikrikoro.com'
  return (process.env.SITE_URL || process.env.VITE_SITE_URL || 'https://www.bikrikoro.com').replace(/\/+$/, '')
}

function isAllowedSupabaseImage(value: unknown, supabaseUrl: string) {
  if (typeof value !== 'string' || !value.trim()) return false
  try {
    const imageUrl = new URL(value)
    const storageUrl = new URL(supabaseUrl)
    return imageUrl.protocol === 'https:' && imageUrl.hostname === storageUrl.hostname
  } catch {
    return false
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const id = typeof req.query.id === 'string' ? req.query.id : ''
  const site = publicSiteUrl(req)
  const fallbackImage = `${site}/icon-512.png`
  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY
  if (!id || !supabaseUrl || !supabaseAnonKey) {
    res.redirect(307, fallbackImage)
    return
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey)
    const { data: product } = await supabase.from('public_products').select('images').eq('id', id).maybeSingle()
    const sourceUrl = Array.isArray(product?.images) ? product.images[0] : null
    if (!isAllowedSupabaseImage(sourceUrl, supabaseUrl)) {
      res.redirect(307, fallbackImage)
      return
    }
    const upstream = await fetch(sourceUrl)
    const contentType = upstream.headers.get('content-type') || 'image/jpeg'
    if (!upstream.ok || !contentType.toLowerCase().startsWith('image/')) {
      res.redirect(307, fallbackImage)
      return
    }
    const body = Buffer.from(await upstream.arrayBuffer())
    res.setHeader('Content-Type', contentType.split(';', 1)[0])
    res.setHeader('Content-Length', String(body.length))
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800')
    res.status(200).send(body)
  } catch {
    res.redirect(307, fallbackImage)
  }
}
