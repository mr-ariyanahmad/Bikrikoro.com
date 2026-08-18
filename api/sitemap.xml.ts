// api/sitemap.xml.ts
//
// Vercel auto-detects anything under /api as a serverless function
// regardless of the frontend framework — no extra config needed. This
// runs server-side on every request to Google (Googlebot fetches
// /sitemap.xml directly, bypassing the React app entirely), listing
// every live product so new listings get discovered without a rebuild.
//
// public/sitemap.xml (static) only covers fixed pages (/, /products,
// /become-seller) — this function is what actually makes individual
// product pages crawlable at scale.
//
// Uses the anon key only — same read access any visitor's browser
// already has, nothing sensitive here.

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

type BlogSitemapRow = { slug?: string | null; published_at?: string | null; updated_at?: string | null }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

  const site = process.env.SITE_URL || process.env.VITE_SITE_URL || 'https://bikrikoro.com'
  const staticUrls = [
    { loc: `${site}/`, priority: '1.0', changefreq: 'daily' },
    { loc: `${site}/products`, priority: '0.9', changefreq: 'hourly' },
    { loc: `${site}/blog`, priority: '0.8', changefreq: 'daily' },
    { loc: `${site}/become-seller`, priority: '0.5', changefreq: 'monthly' },
    ...['help', 'faq', 'about', 'privacy', 'terms', 'return-policy', 'user-education', 'seller-education', 'contact'].map((path) => ({ loc: `${site}/${path}`, priority: '0.5', changefreq: 'monthly' })),
  ]

  let productUrls: { loc: string; lastmod: string }[] = []
  let blogUrls: { loc: string; lastmod: string }[] = []

  if (supabaseUrl && supabaseAnonKey) {
    const supabase = createClient(supabaseUrl, supabaseAnonKey)
    const [{ data: products }, { data: blogs }] = await Promise.all([
      supabase.from('products').select('id, created_at').order('created_at', { ascending: false }).limit(5000),
      supabase.rpc('get_published_content', { p_content_type: 'BLOG', p_slug: null }),
    ])

    productUrls = (products ?? []).map((p) => ({
      loc: `${site}/products/${p.id}`,
      lastmod: new Date(p.created_at).toISOString().split('T')[0],
    }))
    blogUrls = (blogs as BlogSitemapRow[] | null ?? []).flatMap((post: BlogSitemapRow) => {
      const slug = post.slug?.trim()
      const date = post.published_at || post.updated_at
      if (!slug || !date) return []
      return [{ loc: `${site}/blog/${encodeURIComponent(slug)}`, lastmod: new Date(date).toISOString().split('T')[0] }]
    })
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticUrls.map((u) => `  <url>\n    <loc>${u.loc}</loc>\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`).join('\n')}
${productUrls.map((u) => `  <url>\n    <loc>${u.loc}</loc>\n    <lastmod>${u.lastmod}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.7</priority>\n  </url>`).join('\n')}
${blogUrls.map((u) => `  <url>\n    <loc>${u.loc}</loc>\n    <lastmod>${u.lastmod}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.7</priority>\n  </url>`).join('\n')}
</urlset>`

  res.setHeader('Content-Type', 'application/xml')
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate') // regenerate at most hourly
  res.status(200).send(xml)
}
