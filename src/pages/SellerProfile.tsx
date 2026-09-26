import { useEffect, useMemo, useState } from 'react'
import { Clock3, Eye, Flag, Heart, Layers3, MessageCircle, Package, Search, Share2, ShieldCheck, Star, Tag, TicketPercent, Users, X } from 'lucide-react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { Layout } from '@/components/Layout'
import { ProductCard } from '@/components/ProductCard'
import { BikrifyBadge } from '@/components/BikrifyBadge'
import { BrandedDialog, DialogButton } from '@/components/BrandedDialog'
import { findOrCreateThread } from '@/lib/chat'
import { getUserFeatureStatus, toggleSellerFollow } from '@/lib/publicFeatures'
import { formatDate } from '@/lib/format'
import { shopUrl } from '@/lib/shopProfile'
import { displayShopDescription, displayShopName, displayUserName } from '@/lib/shopProfile'
import { SITE_URL } from '@/lib/site'
import { PUBLIC_PRODUCT_FIELDS, PUBLIC_PRODUCT_TABLE } from '@/lib/publicProductFields'
import { publicCacheKey, readCachedValue, writeCachedValue } from '@/lib/clientCache'
import type { Product, Profile } from '@/types/product'
import type { Review } from '@/types/order'

type PublicSeller = Pick<Profile, 'id' | 'name' | 'photo_url' | 'shop_name' | 'shop_description' | 'shop_username' | 'shop_cover_url' | 'is_verified' | 'rating' | 'review_count' | 'created_at'> & { follower_count: number; product_count: number; total_views: number }
type PublicReview = Pick<Review, 'id' | 'product_id' | 'product_title' | 'buyer_name' | 'rating' | 'comment' | 'created_at'>
type ProductFilter = 'ALL' | 'POPULAR' | 'LATEST' | 'LOWEST' | 'HIGHEST'

const PUBLIC_REVIEW_FIELDS = 'id, product_id, product_title, buyer_name, rating, comment, created_at'
const SELLER_PROFILE_CACHE_MAX_AGE_MS = 30 * 60 * 1000
type CachedSellerProfile = { seller: PublicSeller; products: Product[]; reviews: PublicReview[] }

export default function SellerProfile() {
  const { id, username } = useParams<{ id?: string; username?: string }>()
  const lookup = username ?? id ?? null
  const navigate = useNavigate()
  const { user } = useAuth()
  const userId = user?.uid ?? null
  const [seller, setSeller] = useState<PublicSeller | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [reviews, setReviews] = useState<PublicReview[]>([])
  const [following, setFollowing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<ProductFilter>('ALL')
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [reportOpen, setReportOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'SHOP' | 'PRODUCTS' | 'CATEGORIES' | 'PROMOTIONS' | 'REVIEWS'>('SHOP')

  useEffect(() => {
    if (!lookup) return
    let active = true
    const cacheKey = publicCacheKey('seller-profile', lookup.toLowerCase())
    const cached = readCachedValue<CachedSellerProfile>(cacheKey, SELLER_PROFILE_CACHE_MAX_AGE_MS)
    if (cached) {
      setSeller(cached.value.seller)
      setProducts(cached.value.products)
      setReviews(cached.value.reviews)
      setLoading(false)
    } else {
      setLoading(true)
    }
    setLoadError(null)
    async function load() {
      try {
        const { data: sellerRpcData, error: sellerError } = await supabase.rpc('get_public_seller_profile', { p_lookup: lookup })
        if (sellerError) throw sellerError
        const sellerData = (Array.isArray(sellerRpcData) ? sellerRpcData[0] : sellerRpcData) as PublicSeller | null
        if (!sellerData) {
          if (active) setSeller(null)
          return
        }
        if (!active) return
        setSeller(sellerData)
        setLoading(false)
        const sellerId = sellerData.id
        const [productsRes, reviewsRes, featureStatus] = await Promise.all([
          supabase.from(PUBLIC_PRODUCT_TABLE).select(PUBLIC_PRODUCT_FIELDS).eq('seller_id', sellerId).eq('is_digital', true).order('created_at', { ascending: false }),
          supabase.from('reviews').select(PUBLIC_REVIEW_FIELDS).eq('seller_id', sellerId).order('created_at', { ascending: false }).limit(20),
          userId ? getUserFeatureStatus(null, sellerId, null) : Promise.resolve({ alertEnabled: false, following: false }),
        ])
        if (productsRes.error) throw productsRes.error
        if (reviewsRes.error) throw reviewsRes.error
        if (!active) return
        const nextProducts = (productsRes.data ?? []) as Product[]
        const nextReviews = (reviewsRes.data ?? []) as PublicReview[]
        setProducts(nextProducts)
        setReviews(nextReviews)
        setFollowing(featureStatus.following)
        writeCachedValue(cacheKey, { seller: sellerData, products: nextProducts, reviews: nextReviews })
      } catch (error) {
        console.error('Seller profile load failed:', error)
        if (active) setLoadError(error instanceof Error ? error.message : 'সেলার প্রোফাইল লোড করা যায়নি।')
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => { active = false }
  }, [lookup, userId])

  const shopName = displayShopName(seller?.shop_name, seller?.name)
  const ownerName = displayUserName(seller?.name)
  const shopDescription = displayShopDescription(seller?.shop_description)
  const visibleProducts = useMemo(() => {
    const search = query.trim().toLowerCase()
    const filtered = products.filter((product) => !search || `${product.title} ${product.description}`.toLowerCase().includes(search))
    return [...filtered].sort((a, b) => {
      if (filter === 'POPULAR') return Number(b.view_count ?? 0) - Number(a.view_count ?? 0)
      if (filter === 'LATEST') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      if (filter === 'LOWEST') return Number(a.price) - Number(b.price)
      if (filter === 'HIGHEST') return Number(b.price) - Number(a.price)
      return 0
    })
  }, [filter, products, query])

  const categoryGroups = useMemo(() => {
    const groups = new Map<string, Product[]>()
    products.forEach((product) => {
      const key = product.category_id || 'other'
      groups.set(key, [...(groups.get(key) ?? []), product])
    })
    return [...groups.entries()].sort((a, b) => b[1].length - a[1].length)
  }, [products])
  const promotionProducts = useMemo(() => products.filter((product) => product.original_price && product.original_price > product.price).sort((a, b) => Number(b.original_price) - Number(a.original_price)), [products])

  const totalViews = seller?.total_views ?? products.reduce((sum, product) => sum + Number(product.view_count ?? 0), 0)
  const yearsOnPlatform = seller ? yearsSince(seller.created_at) : 0
  const reviewAverage = seller && seller.review_count > 0 ? seller.rating.toFixed(1) : '—'

  const handleFollow = async () => {
    if (!seller) return
    if (!user) { navigate('/login'); return }
    try {
      const next = await toggleSellerFollow(seller.id)
      setFollowing(next)
      setSeller((current) => current ? { ...current, follower_count: Math.max(0, current.follower_count + (next ? 1 : -1)) } : current)
      setActionMessage(next ? 'এই shop follow করা হয়েছে।' : 'এই shop follow তালিকা থেকে সরানো হয়েছে।')
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : 'Shop follow করা যায়নি।')
    }
  }

  const handleChat = async () => {
    if (!seller) return
    if (!user) { navigate('/login'); return }
    if (user.uid === seller.id) { setActionMessage('নিজের shop-এ chat করা যাবে না।'); return }
    try {
      const threadId = await findOrCreateThread(seller.id, null)
      navigate(`/chat/${threadId}`)
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : 'Chat শুরু করা যায়নি।')
    }
  }

  const handleShare = async () => {
    if (!seller) return
    const lookupParam = seller.shop_username?.trim()
      ? `username=${encodeURIComponent(seller.shop_username.trim())}`
      : `id=${encodeURIComponent(seller.id)}`
    const url = `${SITE_URL}/api/seller-preview?${lookupParam}`
    try {
      if (navigator.share) await navigator.share({ title: `${shopName} | BikriKoro`, text: `${shopName}-এর ডিজিটাল শপ দেখুন।`, url })
      else if (navigator.clipboard) { await navigator.clipboard.writeText(url); setActionMessage('শপের লিংক কপি হয়েছে।') }
      else setActionMessage(url)
    } catch {
      setActionMessage('শেয়ার করা যায়নি।')
    }
  }

  if (loading) return <Layout wide><ProfileSkeleton /></Layout>

  if (!seller) {
    return <Layout wide><div className="mx-auto max-w-xl border border-outline bg-surface p-8 text-center shadow-sm"><p className="text-base text-ink-600">{loadError ? `সেলার প্রোফাইল লোড করা যায়নি: ${loadError}` : 'এই seller shop-টি পাওয়া যায়নি।'}</p><Link to="/products" className="mt-5 inline-flex border border-brand-500 px-4 py-2.5 text-base font-semibold text-brand-700">Digital product দেখুন</Link></div></Layout>
  }

  return (
    <Layout wide>
      <Helmet>
        <title>{`${shopName} — BikriKoro.Com`}</title>
        <meta name="description" content={shopDescription || `BikriKoro-তে ${shopName}-এর যাচাইকৃত ডিজিটাল শপ ও পণ্য দেখুন।`} />
        <link rel="canonical" href={`${SITE_URL}${shopUrl(seller.shop_username, seller.id)}`} />
        <meta property="og:type" content="profile" />
        <meta property="og:title" content={`${shopName} — BikriKoro`} />
        <meta property="og:description" content={shopDescription || `BikriKoro-তে ${shopName}-এর ডিজিটাল শপ দেখুন।`} />
        <meta property="og:url" content={`${SITE_URL}${shopUrl(seller.shop_username, seller.id)}`} />
        <meta property="og:image" content={seller.shop_cover_url || seller.photo_url || `${SITE_URL}/icon-512.png`} />
        <meta property="og:image:alt" content={`${shopName} শপের ছবি`} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={`${shopName} — BikriKoro`} />
        <meta name="twitter:description" content={shopDescription || `BikriKoro-তে ${shopName}-এর ডিজিটাল শপ দেখুন।`} />
        <meta name="twitter:image" content={seller.shop_cover_url || seller.photo_url || `${SITE_URL}/icon-512.png`} />
        <meta name="twitter:image:alt" content={`${shopName} শপের ছবি`} />
      </Helmet>
      <div className="mx-auto w-full max-w-7xl pb-24">
        <section className="overflow-hidden rounded-3xl border border-brand-100 bg-surface shadow-sm">
          <div className="relative h-32 overflow-hidden bg-gradient-to-r from-brand-800 via-brand-600 to-emerald-300 sm:h-44">{seller.shop_cover_url ? <img src={seller.shop_cover_url} alt="" className="h-full w-full object-cover" /> : <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 20% 20%, white 0, transparent 28%), radial-gradient(circle at 85% 45%, white 0, transparent 24%)' }} />}<div className="absolute bottom-3 left-4 text-xs font-bold uppercase tracking-[0.2em] text-white/80">BikriKoro ডিজিটাল শপ</div></div>
          <div className="relative px-4 pb-5 sm:px-7"><div className="-mt-12 flex flex-col gap-4 sm:-mt-14 sm:flex-row sm:items-end"><div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden border-4 border-white bg-brand-100 text-3xl font-bold text-brand-700 shadow-md sm:h-28 sm:w-28">{seller.photo_url ? <img src={seller.photo_url} alt={`${shopName} শপ`} className="h-full w-full object-cover" /> : shopName.charAt(0)}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-bold tracking-tight text-ink-900">{shopName}</h1>{seller.is_verified && <BikrifyBadge />}</div>{ownerName !== shopName && <p className="mt-1 text-sm text-ink-500">ব্যবহারকারী: {ownerName}</p>}<div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-600"><span className="inline-flex items-center gap-1">{seller.review_count > 0 ? <><Star size={15} className="fill-amber-400 text-amber-400" />{reviewAverage} · {seller.review_count}টি রিভিউ</> : 'এখনো কোনো রিভিউ নেই'}</span><span className="inline-flex items-center gap-1"><Package size={15} />{seller.product_count}টি ডিজিটাল পণ্য</span><span className="inline-flex items-center gap-1"><Users size={15} />{seller.follower_count} জন অনুসরণ</span><span className="inline-flex items-center gap-1"><Clock3 size={15} />{formatDate(seller.created_at)} থেকে</span></div></div><div className="flex flex-wrap gap-2 sm:justify-end"><button type="button" onClick={() => void handleFollow()} className={`inline-flex items-center justify-center gap-2 border px-3 py-2.5 text-base font-semibold transition ${following ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-outline text-ink-700 hover:border-brand-500 hover:text-brand-700'}`}><Heart size={16} className={following ? 'fill-brand-500 text-brand-500' : ''} />{following ? 'অনুসরণ করা আছে' : 'শপ অনুসরণ করুন'}</button><button type="button" onClick={() => void handleChat()} className="inline-flex items-center justify-center gap-2 rounded-xl border border-brand-500 bg-brand-500 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600"><MessageCircle size={16} />চ্যাট করুন</button><button type="button" onClick={() => void handleShare()} aria-label="শেয়ার করুন" className="grid h-10 w-10 place-items-center rounded-xl border border-outline text-ink-600 hover:border-brand-500 hover:text-brand-700"><Share2 size={15} /></button><button type="button" onClick={() => setReportOpen(true)} aria-label="অভিযোগ জানান" className="grid h-10 w-10 place-items-center rounded-xl border border-outline text-ink-600 hover:border-error hover:text-error"><Flag size={15} /></button></div></div>
            <div className="mt-4 grid gap-3 border-t border-outline pt-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"><p className="line-clamp-2 text-sm leading-6 text-ink-600">{shopDescription || 'এই শপ সম্পর্কে কোনো বিবরণ নেই।'}</p><div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-ink-600">{seller.is_verified ? <BikrifyBadge compact /> : <span className="inline-flex items-center gap-1 rounded-full bg-bg px-2.5 py-1"><ShieldCheck size={13} />নতুন শপ</span>}<span className="inline-flex items-center gap-1 rounded-full bg-bg px-2.5 py-1"><Clock3 size={13} />{yearsOnPlatform > 0 ? `${yearsOnPlatform} বছর` : 'নতুন'}</span></div></div>
          </div>
        </section>

        {actionMessage && <div className="mt-4 flex items-start justify-between gap-3 border border-brand-200 bg-brand-50 p-3 text-sm text-brand-800"><p>{actionMessage}</p><button type="button" onClick={() => setActionMessage(null)} aria-label="বার্তা বন্ধ করুন"><X size={16} /></button></div>}

        <section className="mt-4 overflow-hidden rounded-3xl border border-outline bg-surface shadow-sm">
          <div className="grid grid-cols-2 divide-x divide-y divide-outline border-b border-outline bg-bg/50 sm:grid-cols-4 sm:divide-y-0">
            <Stat label="রেটিং" value={reviewAverage} icon={Star} />
            <Stat label="পণ্য" value={String(seller.product_count)} icon={Package} />
            <Stat label="মোট দেখা" value={String(totalViews)} icon={Eye} />
            <Stat label="অনুসরণকারী" value={String(seller.follower_count)} icon={Users} />
          </div>
          <nav aria-label="Shop sections" className="scrollbar-none flex overflow-x-auto border-b border-outline bg-white px-2 sm:px-4">
            {([['SHOP', 'শপ', Layers3], ['PRODUCTS', 'প্রোডাক্ট', Package], ['CATEGORIES', 'ক্যাটাগরি', Tag], ['PROMOTIONS', 'প্রমোশন', TicketPercent], ['REVIEWS', 'রিভিউ', Star]] as const).map(([value, label, Icon]) => <button key={value} type="button" onClick={() => setActiveTab(value)} className={`relative flex shrink-0 items-center gap-2 px-4 py-4 text-sm font-bold transition sm:px-6 ${activeTab === value ? 'text-brand-700' : 'text-ink-500 hover:text-brand-700'}`}><Icon size={16} />{label}{activeTab === value && <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-brand-500" />}</button>)}
          </nav>
        </section>

        {activeTab === 'SHOP' && <section className="mt-4 rounded-2xl border border-outline bg-surface p-5 shadow-sm sm:p-6"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-700">শপের পছন্দ</p><h2 className="mt-1 text-xl font-bold text-ink-900">জনপ্রিয় পণ্য</h2></div><button type="button" onClick={() => setActiveTab('PRODUCTS')} className="text-sm font-bold text-brand-700">সব দেখুন →</button></div>{visibleProducts.length === 0 ? <p className="mt-5 text-sm text-ink-500">এই শপে এখনো কোনো পণ্য নেই।</p> : <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{visibleProducts.slice(0, 8).map((product) => <ProductCard key={product.id} product={product} seller={seller} />)}</div>}</section>}

        {activeTab === 'PRODUCTS' && <section className="mt-4 rounded-2xl border border-outline bg-surface p-5 shadow-sm sm:p-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-700">ডিজিটাল পণ্য</p><h2 className="mt-1 text-xl font-bold text-ink-900">এই শপের পণ্য</h2></div><div className="relative w-full sm:max-w-xs"><Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="এই শপে পণ্য খুঁজুন" className="w-full rounded-xl border border-outline bg-surface py-2.5 pl-9 pr-3 text-base outline-none transition focus:border-brand-500" /></div></div><div className="mt-4 flex gap-2 overflow-x-auto pb-1">{([['ALL', 'সব'], ['POPULAR', 'জনপ্রিয়'], ['LATEST', 'নতুন'], ['LOWEST', 'কম দাম'], ['HIGHEST', 'বেশি দাম']] as Array<[ProductFilter, string]>).map(([value, label]) => <button key={value} type="button" onClick={() => setFilter(value)} className={`shrink-0 rounded-xl border px-3 py-2 text-sm font-semibold transition ${filter === value ? 'border-brand-500 bg-brand-500 text-white' : 'border-outline text-ink-600 hover:border-brand-500 hover:text-brand-700'}`}>{label}</button>)}</div>{visibleProducts.length === 0 ? <div className="mt-5 rounded-2xl border border-dashed border-outline bg-bg p-8 text-center"><Package size={28} className="mx-auto text-brand-500" /><p className="mt-3 font-semibold text-ink-900">{products.length === 0 ? 'এই বিক্রেতার কোনো সক্রিয় ডিজিটাল পণ্য নেই' : 'এই খোঁজে কোনো পণ্য পাওয়া যায়নি'}</p></div> : <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{visibleProducts.map((product) => <ProductCard key={product.id} product={product} seller={seller} />)}</div>}</section>}

        {activeTab === 'CATEGORIES' && <section className="mt-4 rounded-2xl border border-outline bg-surface p-5 shadow-sm sm:p-6"><p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-700">Shop categories</p><h2 className="mt-1 text-xl font-bold text-ink-900">ক্যাটাগরি অনুযায়ী পণ্য</h2>{categoryGroups.length === 0 ? <p className="mt-5 text-sm text-ink-500">কোনো category পাওয়া যায়নি।</p> : <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{categoryGroups.map(([category, items]) => <button type="button" key={category} onClick={() => { setQuery(''); setActiveTab('PRODUCTS') }} className="group flex items-center justify-between rounded-2xl border border-outline bg-bg p-4 text-left transition hover:border-brand-300 hover:bg-brand-50"><span className="flex min-w-0 items-center gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-100 text-brand-700"><Layers3 size={20} /></span><span className="min-w-0"><span className="block truncate font-bold text-ink-900">{category === 'other' ? 'অন্যান্য' : category.replaceAll('_', ' ')}</span><span className="mt-1 block text-xs text-ink-500">{items.length}টি পণ্য</span></span></span><span className="text-brand-600 transition group-hover:translate-x-1">→</span></button>)}</div>}</section>}

        {activeTab === 'PROMOTIONS' && <section className="mt-4 rounded-2xl border border-outline bg-surface p-5 shadow-sm sm:p-6"><p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-700">Shop promotions</p><h2 className="mt-1 text-xl font-bold text-ink-900">চলমান অফার</h2>{promotionProducts.length === 0 ? <div className="mt-5 rounded-2xl border border-dashed border-outline bg-bg p-8 text-center"><TicketPercent size={28} className="mx-auto text-brand-500" /><p className="mt-3 font-semibold text-ink-900">এই শপে এখন কোনো promotion নেই</p><p className="mt-1 text-sm text-ink-500">ডিসকাউন্ট থাকা পণ্যগুলো এখানে দেখা যাবে।</p></div> : <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{promotionProducts.map((product) => <ProductCard key={product.id} product={product} seller={seller} />)}</div>}</section>}

        {activeTab === 'REVIEWS' && <section className="mt-4 rounded-2xl border border-outline bg-surface p-5 shadow-sm sm:p-6"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-700">ক্রেতার মতামত</p><h2 className="mt-1 text-xl font-bold text-ink-900">শপের রিভিউ</h2></div>{seller.review_count > 0 && <span className="inline-flex items-center gap-1 text-base font-bold text-amber-600"><Star size={16} className="fill-amber-400 text-amber-400" />{reviewAverage}</span>}</div>{reviews.length === 0 ? <div className="mt-5 rounded-2xl border border-dashed border-outline bg-bg p-7 text-center text-sm text-ink-500">এই বিক্রেতার এখনো কোনো রিভিউ নেই।</div> : <div className="mt-5 grid gap-3 md:grid-cols-2">{reviews.map((review) => <article key={review.id} className="rounded-2xl border border-outline bg-bg p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold text-ink-900">{review.buyer_name || 'ক্রেতা'}</p><p className="mt-1 text-xs text-ink-400">{review.product_title}</p></div><span className="text-sm text-amber-500">{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</span></div>{review.comment && <p className="mt-3 text-sm leading-6 text-ink-600">{review.comment}</p>}<p className="mt-3 text-xs text-ink-400">{formatDate(review.created_at)}</p></article>)}</div>}</section>}

      </div>
      <BrandedDialog open={reportOpen} title="অভিযোগ জানান" onClose={() => setReportOpen(false)} tone="warning" actions={<DialogButton onClick={() => setReportOpen(false)}>বুঝেছি</DialogButton>}><p>কোনো নির্দিষ্ট পণ্য বা তথ্য নিয়ে সমস্যা হলে সেই পণ্যের পেজ থেকে অভিযোগ জানান।</p></BrandedDialog>
    </Layout>
  )
}

function Stat({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Star }) {
  return <div className="flex items-center gap-2.5 px-3 py-2.5 sm:justify-center"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-600"><Icon size={14} /></span><span className="min-w-0"><span className="block text-[10px] font-medium text-ink-500">{label}</span><span className="mt-0.5 block truncate text-sm font-bold text-ink-900">{value}</span></span></div>
}

function ProfileSkeleton() {
  return <div className="space-y-4" aria-label="সেলার প্রোফাইল লোড হচ্ছে"><div className="h-10 w-24 animate-pulse bg-outline/40" /><div className="h-64 animate-pulse bg-outline/40" /><div className="grid gap-4 lg:grid-cols-2"><div className="h-40 animate-pulse bg-outline/40" /><div className="h-40 animate-pulse bg-outline/40" /></div><div className="h-96 animate-pulse bg-outline/40" /></div>
}

function yearsSince(createdAt: string) {
  const years = (Date.now() - new Date(createdAt).getTime()) / (365.25 * 24 * 60 * 60 * 1000)
  return Math.max(0, Math.floor(years))
}
