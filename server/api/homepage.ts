import type { VercelRequest, VercelResponse } from '@vercel/node'

const SITE_URL = 'https://www.bikrikoro.com'
const TITLE = 'BikriKoro — বাংলাদেশের নিরাপদ ডিজিটাল প্রোডাক্ট মার্কেটপ্লেস'
const DESCRIPTION = 'BikriKoro-তে নিরাপদে ডিজিটাল প্রোডাক্ট কিনুন ও বিক্রি করুন। বিভিন্ন ডিজিটাল প্রোডাক্ট আবিষ্কার করুন, নিজের প্রোডাক্ট লিস্ট করুন এবং সহজ ও নিরাপদ marketplace experience উপভোগ করুন।'

const categories = [
  ['গেম ও গেমিং', 'Game ID, keys ও gaming access', '/app/products?q=game'],
  ['সফটওয়্যার', 'Tools, license ও digital utility', '/app/products?q=software'],
  ['সাবস্ক্রিপশন', 'Premium apps ও memberships', '/app/products?q=subscription'],
  ['কোর্স ও শিক্ষা', 'শেখা, ebook ও skill resources', '/app/products?q=course'],
  ['ডিজাইন ও টেমপ্লেট', 'Creative assets ও templates', '/app/products?q=design'],
  ['ডিজিটাল সেবা', 'Online service ও support', '/app/products?q=service'],
]

function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

export default function handler(_req: VercelRequest, res: VercelResponse) {
  const categoryMarkup = categories.map(([name, detail, href]) => `<li><a href="${href}"><strong>${escapeHtml(name)}</strong><span>${escapeHtml(detail)}</span></a></li>`).join('')
  const structuredData = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: TITLE,
    url: `${SITE_URL}/`,
    description: DESCRIPTION,
    isPartOf: { '@type': 'WebSite', name: 'BikriKoro', url: SITE_URL },
  })

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600')
  res.status(200).send(`<!doctype html>
<html lang="bn-BD">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${TITLE}</title>
    <meta name="description" content="${DESCRIPTION}" />
    <meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1" />
    <link rel="canonical" href="${SITE_URL}/" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="BikriKoro" />
    <meta property="og:title" content="${TITLE}" />
    <meta property="og:description" content="${DESCRIPTION}" />
    <meta property="og:url" content="${SITE_URL}/" />
    <meta property="og:image" content="${SITE_URL}/og-image.jpg" />
    <meta property="og:locale" content="bn_BD" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${TITLE}" />
    <meta name="twitter:description" content="${DESCRIPTION}" />
    <meta name="twitter:image" content="${SITE_URL}/og-image.jpg" />
    <script type="application/ld+json">${structuredData}</script>
    <link rel="stylesheet" href="/assets/app.css" />
    <style>
      .seo-shell-header{display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:1rem max(1rem,4vw);border-bottom:1px solid #d9eee7;background:#fff;font-family:system-ui,sans-serif}.seo-shell-header a{color:#10281f;text-decoration:none}.seo-shell-header a:last-child{border-radius:.75rem;background:#179d72;color:#fff;padding:.65rem 1rem;font-weight:700}.seo-shell-header span{color:#179d72}.seo-shell{max-width:72rem;margin:0 auto;padding:4rem max(1rem,4vw);color:#10281f;font-family:system-ui,sans-serif}.seo-shell section{margin-bottom:3rem}.seo-shell h1{max-width:50rem;margin:.5rem 0 1rem;font-size:clamp(2.2rem,6vw,4.5rem);line-height:1.08}.seo-shell h2{font-size:clamp(1.6rem,3vw,2.5rem);margin-bottom:.75rem}.seo-shell p{max-width:48rem;color:#52635d;font-size:1.05rem;line-height:1.8}.seo-kicker{color:#087b59!important;font-weight:800}.seo-shell a{color:#087b59;font-weight:700}.seo-shell .seo-primary{display:inline-block;margin-right:.5rem;border-radius:.75rem;background:#179d72;color:#fff;padding:.75rem 1rem;text-decoration:none}.seo-category-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(15rem,1fr));gap:.75rem;padding:0;list-style:none}.seo-category-list a{display:block;padding:1rem;border:1px solid #d9eee7;border-radius:1rem;background:#fff;text-decoration:none}.seo-category-list span{display:block;margin-top:.35rem;color:#52635d;font-size:.85rem;font-weight:400;line-height:1.5}
    </style>
  </head>
  <body>
    <div id="root">
      <header class="seo-shell-header"><a href="/" aria-label="BikriKoro home"><strong>BikriKoro<span>.Com</span></strong></a><a href="/app">Marketplace খুলুন</a></header>
      <main class="seo-shell">
        <section aria-labelledby="homepage-title">
          <p class="seo-kicker">বাংলাদেশের নিরাপদ ডিজিটাল marketplace</p>
          <h1 id="homepage-title">ডিজিটাল product কিনুন, ভয় ছাড়াই।</h1>
          <p>${DESCRIPTION}</p>
          <p><a class="seo-primary" href="/app/products">প্রোডাক্ট ব্রাউজ করুন</a> <a href="/become-seller">সেলার হোন</a></p>
        </section>
        <section aria-labelledby="category-title">
          <h2 id="category-title">আপনার প্রয়োজনের digital category</h2>
          <p>একটি category বেছে নিয়ে সরাসরি marketplace-এ product দেখুন।</p>
          <ul class="seo-category-list">${categoryMarkup}</ul>
        </section>
        <section aria-labelledby="trust-title">
          <h2 id="trust-title">নিরাপদ কেনাকাটা ও বিক্রির marketplace</h2>
          <p>Verified seller profile, secure delivery, পরিষ্কার order flow এবং customer support—সবকিছু এক জায়গায়।</p>
        </section>
      </main>
    </div>
    <script type="module" src="/assets/app.js"></script>
  </body>
</html>`)
}
