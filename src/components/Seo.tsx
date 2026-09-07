import { Helmet } from 'react-helmet-async'
import { useLocation } from 'react-router-dom'

export const SEO_SITE_URL = 'https://www.bikrikoro.com'
export const SEO_SITE_NAME = 'BikriKoro'
export const SEO_DEFAULT_TITLE = 'BikriKoro — বাংলাদেশের Official Online Marketplace'
export const SEO_DEFAULT_DESCRIPTION = 'BikriKoro হলো বাংলাদেশের নিরাপদ official online marketplace—ডিজিটাল পণ্য, গেম, সাবস্ক্রিপশন, সফটওয়্যার, কোর্স ও সেবা নিরাপদে কিনুন ও বিক্রি করুন।'
export const SEO_DEFAULT_IMAGE = `${SEO_SITE_URL}/og-image.jpg`

const PRIVATE_PREFIXES = [
  '/account', '/admin', '/chat', '/disputes', '/favorites', '/library', '/my-listings', '/notifications',
  '/orders', '/rewards', '/sell', '/seller/dashboard', '/settings', '/wallet', '/saved-searches', '/become-seller/verify',
]

function isNoindexPath(pathname: string) {
  return pathname === '/login' || pathname === '/forgot-password' || pathname === '/compare' || pathname === '/search'
    || PRIVATE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}

function cleanCanonicalPath(pathname: string) {
  if (pathname === '/search') return '/products'
  if (pathname === '/products') return '/products'
  return pathname || '/'
}

function breadcrumbItems(pathname: string) {
  const items = [{ name: 'BikriKoro', item: `${SEO_SITE_URL}/` }]
  if (pathname === '/products' || pathname.startsWith('/products/')) items.push({ name: 'ডিজিটাল পণ্য', item: `${SEO_SITE_URL}/products` })
  else if (pathname.startsWith('/seller/')) items.push({ name: 'সেলার শপ', item: `${SEO_SITE_URL}/products` })
  else if (pathname.startsWith('/blog')) items.push({ name: 'ব্লগ', item: `${SEO_SITE_URL}/blog` })
  else if (pathname !== '/') items.push({ name: 'তথ্য ও সহায়তা', item: `${SEO_SITE_URL}/help` })
  if (pathname.split('/').filter(Boolean).length > 1) items.push({ name: 'বিস্তারিত', item: `${SEO_SITE_URL}${pathname}` })
  return items.map((item, index) => ({ '@type': 'ListItem', position: index + 1, name: item.name, item: item.item }))
}

export function Seo() {
  const { pathname } = useLocation()
  const noindex = isNoindexPath(pathname)
  const canonical = `${SEO_SITE_URL}${cleanCanonicalPath(pathname)}`
  const organization = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${SEO_SITE_URL}/#organization`,
    name: SEO_SITE_NAME,
    legalName: 'BikriKoro',
    url: SEO_SITE_URL,
    logo: `${SEO_SITE_URL}/icon-512.png`,
    image: SEO_DEFAULT_IMAGE,
    description: SEO_DEFAULT_DESCRIPTION,
    areaServed: { '@type': 'Country', name: 'Bangladesh' },
    sameAs: [`${SEO_SITE_URL}/about`, `${SEO_SITE_URL}/contact`],
  }
  const website = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${SEO_SITE_URL}/#website`,
    name: SEO_SITE_NAME,
    alternateName: ['Bikri Koro', 'BikriKoro.com', 'BikriKoro Bangladesh'],
    url: SEO_SITE_URL,
    publisher: { '@id': `${SEO_SITE_URL}/#organization` },
    inLanguage: 'bn-BD',
    potentialAction: {
      '@type': 'SearchAction',
      target: `${SEO_SITE_URL}/products?query={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  }
  const breadcrumb = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: breadcrumbItems(pathname) }

  return <Helmet>
    <html lang="bn-BD" />
    <title>{SEO_DEFAULT_TITLE}</title>
    <meta name="description" content={SEO_DEFAULT_DESCRIPTION} />
    <meta name="robots" content={noindex ? 'noindex,follow' : 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1'} />
    <link rel="canonical" href={canonical} />
    <meta property="og:site_name" content="BikriKoro" />
    <meta property="og:locale" content="bn_BD" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content={SEO_DEFAULT_TITLE} />
    <meta property="og:description" content={SEO_DEFAULT_DESCRIPTION} />
    <meta property="og:url" content={canonical} />
    <meta property="og:image" content={SEO_DEFAULT_IMAGE} />
    <meta property="og:image:alt" content="BikriKoro — বাংলাদেশের Official Online Marketplace" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content={SEO_DEFAULT_TITLE} />
    <meta name="twitter:description" content={SEO_DEFAULT_DESCRIPTION} />
    <meta name="twitter:image" content={SEO_DEFAULT_IMAGE} />
    <script type="application/ld+json">{JSON.stringify(organization)}</script>
    <script type="application/ld+json">{JSON.stringify(website)}</script>
    {!noindex && <script type="application/ld+json">{JSON.stringify(breadcrumb)}</script>}
  </Helmet>
}
