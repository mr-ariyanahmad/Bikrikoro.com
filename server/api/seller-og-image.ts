import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

function siteUrl() {
  return (process.env.SITE_URL || process.env.VITE_SITE_URL || 'https://bikrikoro.com').replace(/\/+$/, '')
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
  const username = typeof req.query.username === 'string' ? req.query.username.trim().toLowerCase() : ''
  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY
  const fallbackImage = `${siteUrl()}/icon-512.png`

  if (!username || !supabaseUrl || !supabaseAnonKey) {
    res.redirect(307, fallbackImage)
    return
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey)
    const { data: seller } = await supabase
      .from('profiles')
      .select('shop_cover_url, photo_url')
      .eq('shop_username', username)
      .maybeSingle()

    const sourceUrl = seller?.shop_cover_url || seller?.photo_url
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

// Keep the helper referenced in the compiled server bundle for consistent route behavior.
void siteUrl
void isAllowedSupabaseImage
