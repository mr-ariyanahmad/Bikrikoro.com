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
  const id = typeof req.query.id === 'string' ? req.query.id : ''
  const site = 'https://bikrikoro.com'
  const canonical = `${site}/products/${encodeURIComponent(id)}`
  const fallbackImage = `${site}/icon-512.png`
  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

  if (!id || !supabaseUrl || !supabaseAnonKey) {
    res.redirect(307, canonical)
    return
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey)
  const { data: product } = await supabase
    .from('products')
    .select('title, description, price, location, images, condition')
    .eq('id', id)
    .maybeSingle()

  if (!product) {
    res.redirect(307, `${site}/products`)
    return
  }

  const title = `${product.title} — ৳${product.price} | BikriKoro.Com`
  const description = `${product.title} — ৳${product.price}${product.location ? `, ${product.location}` : ''}। ${(product.description ?? '').slice(0, 180)}`
  const image = Array.isArray(product.images) && product.images[0] ? product.images[0] : fallbackImage
  const html = `<!doctype html>
<html lang="bn">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <link rel="canonical" href="${escapeHtml(canonical)}">
  <meta property="og:type" content="product">
  <meta property="og:site_name" content="BikriKoro.Com">
  <meta property="og:title" content="${escapeHtml(product.title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:image" content="${escapeHtml(image)}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:url" content="${escapeHtml(canonical)}">
  <meta property="og:locale" content="bn_BD">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(product.title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${escapeHtml(image)}">
  <meta http-equiv="refresh" content="0;url=${escapeHtml(canonical)}">
</head>
<body><p>পণ্যটি খুলছে… <a href="${escapeHtml(canonical)}">BikriKoro-তে দেখুন</a></p><script>location.replace(${JSON.stringify(canonical)})</script></body>
</html>`

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=3600')
  res.status(200).send(html)
}
