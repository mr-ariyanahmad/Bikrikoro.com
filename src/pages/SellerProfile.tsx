import { useEffect, useMemo, useState } from 'react'
import { BadgeCheck, CheckCircle2, Clock3, Eye, Flag, Heart, MessageCircle, Package, Search, Share2, ShieldCheck, Star, Users, X } from 'lucide-react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { Layout } from '@/components/Layout'
import { ProductCard } from '@/components/ProductCard'
import { BrandedDialog, DialogButton } from '@/components/BrandedDialog'
import { findOrCreateThread } from '@/lib/chat'
import { getUserFeatureStatus, toggleSellerFollow } from '@/lib/publicFeatures'
import { formatDate } from '@/lib/format'
import { shopUrl } from '@/lib/shopProfile'
import { SITE_URL } from '@/lib/site'
import { PUBLIC_PRODUCT_FIELDS, PUBLIC_PRODUCT_TABLE } from '@/lib/publicProductFields'
import type { Product, Profile } from '@/types/product'
import type { Review } from '@/types/order'

type PublicSeller = Pick<Profile, 'id' | 'name' | 'photo_url' | 'shop_name' | 'shop_description' | 'shop_username' | 'shop_cover_url' | 'is_verified' | 'rating' | 'review_count' | 'created_at'> & { follower_count: number; product_count: number; total_views: number }
type PublicReview = Pick<Review, 'id' | 'product_id' | 'product_title' | 'buyer_name' | 'rating' | 'comment' | 'created_at'>
type ProductFilter = 'ALL' | 'POPULAR' | 'LATEST' | 'LOWEST' | 'HIGHEST'

const PUBLIC_REVIEW_FIELDS = 'id, product_id, product_title, buyer_name, rating, comment, created_at'

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

  useEffect(() => {
    if (!lookup) return
    let active = true
    setLoading(true)
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
        const sellerId = sellerData.id
        const [productsRes, reviewsRes, featureStatus] = await Promise.all([
          supabase.from(PUBLIC_PRODUCT_TABLE).select(PUBLIC_PRODUCT_FIELDS).eq('seller_id', sellerId).eq('is_digital', true).order('created_at', { ascending: false }),
          supabase.from('reviews').select(PUBLIC_REVIEW_FIELDS).eq('seller_id', sellerId).order('created_at', { ascending: false }).limit(20),
          userId ? getUserFeatureStatus(null, sellerId, null) : Promise.resolve({ alertEnabled: false, following: false }),
        ])
        if (productsRes.error) throw productsRes.error
        if (reviewsRes.error) throw reviewsRes.error
        if (!active) return
        setSeller(sellerData)
        setProducts((productsRes.data ?? []) as Product[])
        setReviews((reviewsRes.data ?? []) as PublicReview[])
        setFollowing(featureStatus.following)
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

  const shopName = seller?.shop_name?.trim() || seller?.name || 'বিক্রেতা'
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
    const shareUrl = new URL(window.location.href)
    shareUrl.searchParams.set('preview', 'shop-image-v2')
    const url = shareUrl.toString()
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
        <meta name="description" content={seller.shop_description?.trim() || `BikriKoro-তে ${shopName}-এর যাচাইকৃত ডিজিটাল শপ ও পণ্য দেখুন।`} />
        <link rel="canonical" href={`${SITE_URL}${shopUrl(seller.shop_username, seller.id)}`} />
        <meta property="og:type" content="profile" />
        <meta property="og:title" content={`${shopName} — BikriKoro`} />
        <meta property="og:description" content={seller.shop_description?.trim() || `BikriKoro-তে ${shopName}-এর ডিজিটাল শপ দেখুন।`} />
        <meta property="og:url" content={`${SITE_URL}${shopUrl(seller.shop_username, seller.id)}`} />
        <meta property="og:image" content={seller.shop_cover_url || seller.photo_url || `${SITE_URL}/icon-512.png`} />
        <meta property="og:image:alt" content={`${shopName} শপের ছবি`} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={`${shopName} — BikriKoro`} />
        <meta name="twitter:description" content={seller.shop_description?.trim() || `BikriKoro-তে ${shopName}-এর ডিজিটাল শপ দেখুন।`} />
        <meta name="twitter:image" content={seller.shop_cover_url || seller.photo_url || `${SITE_URL}/icon-512.png`} />
        <meta name="twitter:image:alt" content={`${shopName} শপের ছবি`} />
      </Helmet>
      <div className="mx-auto w-full max-w-7xl pb-24">
        <section className="overflow-hidden border border-brand-100 bg-surface shadow-sm">
          <div className="relative h-36 overflow-hidden bg-gradient-to-r from-brand-800 via-brand-600 to-emerald-300 sm:h-48">{seller.shop_cover_url ? <img src={seller.shop_cover_url} alt="" className="h-full w-full object-cover" /> : <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 20% 20%, white 0, transparent 28%), radial-gradient(circle at 85% 45%, white 0, transparent 24%)' }} />}<div className="absolute bottom-3 left-4 text-xs font-bold uppercase tracking-[0.2em] text-white/80">BikriKoro ডিজিটাল শপ</div></div>
          <div className="relative px-4 pb-5 sm:px-7"><div className="-mt-12 flex flex-col gap-4 sm:-mt-14 sm:flex-row sm:items-end"><div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden border-4 border-white bg-brand-100 text-3xl font-bold text-brand-700 shadow-md sm:h-28 sm:w-28">{seller.photo_url ? <img src={seller.photo_url} alt={`${shopName} শপ`} className="h-full w-full object-cover" /> : shopName.charAt(0)}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-bold tracking-tight text-ink-900">{shopName}</h1>{seller.is_verified && <span className="inline-flex items-center gap-1 bg-brand-500 px-2 py-1 text-xs font-bold text-white"><BadgeCheck size={14} />যাচাইকৃত বিক্রেতা</span>}</div>{seller.name && seller.name !== shopName && <p className="mt-1 text-sm text-ink-500">মালিক: {seller.name}</p>}<div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-600"><span className="inline-flex items-center gap-1">{seller.review_count > 0 ? <><Star size={15} className="fill-amber-400 text-amber-400" />{reviewAverage} · {seller.review_count}টি রিভিউ</> : 'এখনো কোনো রিভিউ নেই'}</span><span className="inline-flex items-center gap-1"><Package size={15} />{seller.product_count}টি ডিজিটাল পণ্য</span><span className="inline-flex items-center gap-1"><Users size={15} />{seller.follower_count} জন অনুসরণ</span><span className="inline-flex items-center gap-1"><Clock3 size={15} />{formatDate(seller.created_at)} থেকে</span></div></div><div className="flex flex-wrap gap-2 sm:justify-end"><button type="button" onClick={() => void handleFollow()} className={`inline-flex items-center justify-center gap-2 border px-3 py-2.5 text-base font-semibold transition ${following ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-outline text-ink-700 hover:border-brand-500 hover:text-brand-700'}`}><Heart size={16} className={following ? 'fill-brand-500 text-brand-500' : ''} />{following ? 'অনুসরণ করা আছে' : 'শপ অনুসরণ করুন'}</button><button type="button" onClick={() => void handleChat()} className="inline-flex items-center justify-center gap-2 border border-brand-500 bg-brand-500 px-3 py-2.5 text-base font-semibold text-white transition hover:bg-brand-600"><MessageCircle size={16} />চ্যাট করুন</button></div></div>
          </div>
        </section>

        {actionMessage && <div className="mt-4 flex items-start justify-between gap-3 border border-brand-200 bg-brand-50 p-3 text-sm text-brand-800"><p>{actionMessage}</p><button type="button" onClick={() => setActionMessage(null)} aria-label="বার্তা বন্ধ করুন"><X size={16} /></button></div>}

        <section className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(18rem,0.7fr)]">
          <div className="border border-outline bg-surface p-5 shadow-sm sm:p-6"><div className="flex items-center gap-2"><ShieldCheck size={20} className="text-brand-600" /><h2 className="text-lg font-bold text-ink-900">শপের বিশ্বাসযোগ্যতা</h2></div><div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4"><TrustItem label="সেলার যাচাই" value={seller.is_verified ? 'যাচাইকৃত' : 'যাচাই করা হয়নি'} ok={seller.is_verified} /><TrustItem label="ডিজিটাল পণ্য" value={products.length > 0 ? 'সক্রিয়' : 'নেই'} ok={products.length > 0} /><TrustItem label="রিভিউ" value={seller.review_count > 0 ? `${seller.review_count}টি` : 'নেই'} ok={seller.review_count > 0} /><TrustItem label="BikriKoro-তে" value={yearsOnPlatform > 0 ? `${yearsOnPlatform} বছর` : 'নতুন'} ok={yearsOnPlatform > 0} /></div></div>
          <div className="border border-brand-100 bg-brand-50 p-5 shadow-sm sm:p-6"><p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-700">শপের সারাংশ</p><div className="mt-4 grid grid-cols-2 gap-3"><Stat label="রেটিং" value={reviewAverage} icon={Star} /><Stat label="পণ্য" value={String(seller.product_count)} icon={Package} /><Stat label="মোট দেখা" value={String(totalViews)} icon={Eye} /><Stat label="অনুসরণকারী" value={String(seller.follower_count)} icon={Users} /></div></div>
        </section>

        <section className="mt-5 border border-outline bg-surface p-5 shadow-sm sm:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-700">শপ সম্পর্কে</p><h2 className="mt-1 text-xl font-bold text-ink-900">বিক্রেতা সম্পর্কে</h2></div><div className="flex gap-2"><button type="button" onClick={() => void handleShare()} className="inline-flex items-center gap-2 border border-outline px-3 py-2 text-sm font-semibold text-ink-700 hover:border-brand-500 hover:text-brand-700"><Share2 size={15} />শেয়ার করুন</button><button type="button" onClick={() => setReportOpen(true)} className="inline-flex items-center gap-2 border border-outline px-3 py-2 text-sm font-semibold text-ink-700 hover:border-error hover:text-error"><Flag size={15} />অভিযোগ জানান</button></div></div><p className="mt-4 max-w-3xl whitespace-pre-line text-sm leading-7 text-ink-600">{seller.shop_description?.trim() || 'এই শপ সম্পর্কে কোনো বিবরণ নেই।'}</p></section>

        <section className="mt-5 border border-outline bg-surface p-5 shadow-sm sm:p-6"><div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-700">ডিজিটাল পণ্য</p><p className="mt-1 text-xl font-bold text-ink-900">এই শপের পণ্য</p></div><div className="relative w-full lg:max-w-xs"><Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="এই শপে পণ্য খুঁজুন" className="w-full border border-outline bg-surface py-2.5 pl-9 pr-3 text-base outline-none transition focus:border-brand-500" /></div></div><div className="mt-4 flex gap-2 overflow-x-auto pb-1">{([['ALL', 'সব'], ['POPULAR', 'জনপ্রিয়'], ['LATEST', 'নতুন'], ['LOWEST', 'কম দাম'], ['HIGHEST', 'বেশি দাম']] as Array<[ProductFilter, string]>).map(([value, label]) => <button key={value} type="button" onClick={() => setFilter(value)} className={`shrink-0 border px-3 py-2 text-sm font-semibold transition ${filter === value ? 'border-brand-500 bg-brand-500 text-white' : 'border-outline text-ink-600 hover:border-brand-500 hover:text-brand-700'}`}>{label}</button>)}</div>{visibleProducts.length === 0 ? <div className="mt-5 border border-dashed border-outline bg-bg p-8 text-center"><Package size={28} className="mx-auto text-brand-500" /><p className="mt-3 font-semibold text-ink-900">{products.length === 0 ? 'এই বিক্রেতার কোনো সক্রিয় ডিজিটাল পণ্য নেই' : 'এই খোঁজে কোনো পণ্য পাওয়া যায়নি'}</p></div> : <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{visibleProducts.map((product) => <ProductCard key={product.id} product={product} />)}</div>}</section>

        <section className="mt-5 border border-outline bg-surface p-5 shadow-sm sm:p-6"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-700">ক্রেতার মতামত</p><h2 className="mt-1 text-xl font-bold text-ink-900">ক্রেতার রিভিউ</h2></div>{seller.review_count > 0 && <span className="inline-flex items-center gap-1 text-base font-bold text-amber-600"><Star size={16} className="fill-amber-400 text-amber-400" />{reviewAverage}</span>}</div>{reviews.length === 0 ? <div className="mt-5 border border-dashed border-outline bg-bg p-7 text-center text-sm text-ink-500">এই বিক্রেতার এখনো কোনো রিভিউ নেই।</div> : <div className="mt-5 grid gap-3 md:grid-cols-2">{reviews.map((review) => <article key={review.id} className="border border-outline p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold text-ink-900">{review.buyer_name || 'ক্রেতা'}</p><p className="mt-1 text-xs text-ink-400">{review.product_title}</p></div><span className="text-sm text-amber-500">{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</span></div>{review.comment && <p className="mt-3 text-sm leading-6 text-ink-600">{review.comment}</p>}<p className="mt-3 text-xs text-ink-400">{formatDate(review.created_at)}</p></article>)}</div>}</section>

      </div>
      <BrandedDialog open={reportOpen} title="অভিযোগ জানান" onClose={() => setReportOpen(false)} tone="warning" actions={<DialogButton onClick={() => setReportOpen(false)}>বুঝেছি</DialogButton>}><p>কোনো নির্দিষ্ট পণ্য বা তথ্য নিয়ে সমস্যা হলে সেই পণ্যের পেজ থেকে অভিযোগ জানান।</p></BrandedDialog>
    </Layout>
  )
}

function TrustItem({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return <div className="border border-outline bg-bg p-3"><CheckCircle2 size={17} className={ok ? 'text-brand-600' : 'text-ink-300'} /><p className="mt-2 text-xs text-ink-500">{label}</p><p className={`mt-1 text-sm font-bold ${ok ? 'text-brand-700' : 'text-ink-600'}`}>{value}</p></div>
}

function Stat({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Star }) {
  return <div className="border border-brand-100 bg-surface p-3"><Icon size={17} className="text-brand-600" /><p className="mt-2 text-xs text-ink-500">{label}</p><p className="mt-1 text-lg font-bold text-ink-900">{value}</p></div>
}

function ProfileSkeleton() {
  return <div className="space-y-4" aria-label="সেলার প্রোফাইল লোড হচ্ছে"><div className="h-10 w-24 animate-pulse bg-outline/40" /><div className="h-64 animate-pulse bg-outline/40" /><div className="grid gap-4 lg:grid-cols-2"><div className="h-40 animate-pulse bg-outline/40" /><div className="h-40 animate-pulse bg-outline/40" /></div><div className="h-96 animate-pulse bg-outline/40" /></div>
}

function yearsSince(createdAt: string) {
  const years = (Date.now() - new Date(createdAt).getTime()) / (365.25 * 24 * 60 * 60 * 1000)
  return Math.max(0, Math.floor(years))
}
