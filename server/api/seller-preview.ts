import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const username = typeof req.query.username === 'string' ? req.query.username.trim().toLowerCase() : ''
  const site = process.env.SITE_URL || process.env.VITE_SITE_URL || 'https://bikrikoro.com'
  const canonical = `${site}/seller/${encodeURIComponent(username)}`
  const fallbackImage = `${site}/icon-512.png`
  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

  if (!username || !supabaseUrl || !supabaseAnonKey) {
    res.redirect(307, `${site}/products`)
    return
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey)
  const { data: seller } = await supabase
    .from('profiles')
    .select('name, shop_name, shop_description, shop_username, photo_url, shop_cover_url, is_verified')
    .eq('shop_username', username)
    .maybeSingle()

  if (!seller?.shop_username) {
    res.redirect(307, `${site}/products`)
    return
  }

  const shopName = String(seller.shop_name || seller.name || 'BikriKoro Seller Shop').trim()
  const description = String(seller.shop_description || `${shopName}-এর digital shop দেখুন BikriKoro-তে।`).trim().slice(0, 240)
  const sourceImage = seller.shop_cover_url || seller.photo_url
  const image = sourceImage ? `${site}/api/seller-og-image?username=${encodeURIComponent(username)}` : fallbackImage
  const title = `${shopName} — BikriKoro.Com`
  const html = `<!doctype html>
<html lang="bn">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <link rel="canonical" href="${escapeHtml(canonical)}">
  <meta property="og:type" content="profile">
  <meta property="og:site_name" content="BikriKoro.Com">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:image" content="${escapeHtml(image)}">
  <meta property="og:image:url" content="${escapeHtml(image)}">
  <meta property="og:image:secure_url" content="${escapeHtml(image)}">
  <meta property="og:image:alt" content="${escapeHtml(shopName)} shop image">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:url" content="${escapeHtml(canonical)}">
  <meta property="og:locale" content="bn_BD">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${escapeHtml(image)}">
  <meta name="twitter:image:alt" content="${escapeHtml(shopName)} shop image">
  <meta http-equiv="refresh" content="0;url=${escapeHtml(canonical)}">
</head>
<body><p>Shop খুলছে… <a href="${escapeHtml(canonical)}">BikriKoro-তে দেখুন</a></p><script>location.replace(${JSON.stringify(canonical)})</script></body>
</html>`

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=3600')
  res.status(200).send(html)
}
