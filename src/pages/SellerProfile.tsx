import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, BadgeCheck, CheckCircle2, Clock3, Eye, Flag, Heart, MessageCircle, Package, Search, Share2, ShieldCheck, Star, Users, X, Zap } from 'lucide-react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { Layout } from '@/components/Layout'
import { ProductCard } from '@/components/ProductCard'
import { BrandedDialog, DialogButton } from '@/components/BrandedDialog'
import { findOrCreateThread } from '@/lib/chat'
import { toggleSellerFollow } from '@/lib/publicFeatures'
import { formatDate } from '@/lib/format'
import type { Product, Profile } from '@/types/product'
import type { Review } from '@/types/order'

type PublicSeller = Pick<Profile, 'id' | 'name' | 'photo_url' | 'shop_name' | 'shop_description' | 'is_verified' | 'rating' | 'review_count' | 'created_at'>
type PublicReview = Pick<Review, 'id' | 'product_id' | 'product_title' | 'buyer_name' | 'rating' | 'comment' | 'created_at'>
type ProductFilter = 'ALL' | 'POPULAR' | 'LATEST' | 'LOWEST' | 'HIGHEST'

const PUBLIC_PROFILE_FIELDS = 'id, name, photo_url, shop_name, shop_description, is_verified, rating, review_count, created_at'
const PUBLIC_PRODUCT_FIELDS = 'id, title, description, price, original_price, images, video_url, category_id, condition, location, is_digital, seller_id, view_count, is_escrow_protected, supports_cod, free_delivery, fast_delivery, free_return, latitude, longitude, created_at, approval_status, is_hidden'
const PUBLIC_REVIEW_FIELDS = 'id, product_id, product_title, buyer_name, rating, comment, created_at'

export default function SellerProfile() {
  const { id } = useParams<{ id: string }>()
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
    if (!id) return
    let active = true
    setLoading(true)
    setLoadError(null)
    async function load() {
      try {
        const [sellerRes, productsRes, reviewsRes, followRes] = await Promise.all([
          supabase.from('profiles').select(PUBLIC_PROFILE_FIELDS).eq('id', id).maybeSingle(),
          supabase.from('products').select(PUBLIC_PRODUCT_FIELDS).eq('seller_id', id).eq('is_digital', true).eq('is_hidden', false).eq('approval_status', 'APPROVED').order('created_at', { ascending: false }),
          supabase.from('reviews').select(PUBLIC_REVIEW_FIELDS).eq('seller_id', id).order('created_at', { ascending: false }).limit(20),
          userId ? supabase.from('seller_follows').select('seller_id').eq('user_id', userId).eq('seller_id', id).maybeSingle() : Promise.resolve({ data: null, error: null }),
        ])
        if (sellerRes.error) throw sellerRes.error
        if (productsRes.error) throw productsRes.error
        if (reviewsRes.error) throw reviewsRes.error
        if (followRes.error && followRes.error.code !== 'PGRST116') throw followRes.error
        if (!active) return
        setSeller(sellerRes.data as PublicSeller | null)
        setProducts((productsRes.data ?? []) as Product[])
        setReviews((reviewsRes.data ?? []) as PublicReview[])
        setFollowing(Boolean(followRes.data))
      } catch (error) {
        console.error('Seller profile load failed:', error)
        if (active) setLoadError(error instanceof Error ? error.message : 'সেলার প্রোফাইল লোড করা যায়নি।')
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => { active = false }
  }, [id, userId])

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

  const totalViews = products.reduce((sum, product) => sum + Number(product.view_count ?? 0), 0)
  const yearsOnPlatform = seller ? yearsSince(seller.created_at) : 0
  const reviewAverage = seller && seller.review_count > 0 ? seller.rating.toFixed(1) : '—'

  const handleFollow = async () => {
    if (!id) return
    if (!user) { navigate('/login'); return }
    try {
      const next = await toggleSellerFollow(user.uid, id)
      setFollowing(next)
      setActionMessage(next ? 'এই shop follow করা হয়েছে।' : 'এই shop follow তালিকা থেকে সরানো হয়েছে।')
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : 'Shop follow করা যায়নি।')
    }
  }

  const handleChat = async () => {
    if (!id) return
    if (!user) { navigate('/login'); return }
    if (user.uid === id) { setActionMessage('নিজের shop-এ chat করা যাবে না।'); return }
    try {
      const threadId = await findOrCreateThread(user.uid, id, null)
      navigate(`/chat/${threadId}`)
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : 'Chat শুরু করা যায়নি।')
    }
  }

  const handleShare = async () => {
    const url = window.location.href
    try {
      if (navigator.share) await navigator.share({ title: `${shopName} | BikriKoro`, text: `${shopName}-এর digital shop দেখুন।`, url })
      else if (navigator.clipboard) { await navigator.clipboard.writeText(url); setActionMessage('Shop link কপি হয়েছে।') }
      else setActionMessage(url)
    } catch {
      setActionMessage('Shop share বাতিল হয়েছে।')
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
        <meta name="description" content={seller.shop_description?.trim() || `${shopName}-এর verified digital shop ও product দেখুন BikriKoro-তে।`} />
      </Helmet>
      <div className="mx-auto w-full max-w-7xl pb-24">
        <Link to="/products" className="mb-4 inline-flex items-center gap-2 border border-outline bg-surface px-3 py-2.5 text-base font-semibold text-ink-700 transition hover:border-brand-500 hover:text-brand-700"><ArrowLeft size={17} />ফিরে যান</Link>
        <section className="overflow-hidden border border-brand-100 bg-surface shadow-sm">
          <div className="relative h-36 overflow-hidden bg-gradient-to-r from-brand-800 via-brand-600 to-emerald-300 sm:h-48"><div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 20% 20%, white 0, transparent 28%), radial-gradient(circle at 85% 45%, white 0, transparent 24%)' }} /><div className="absolute bottom-3 left-4 text-xs font-bold uppercase tracking-[0.2em] text-white/80">BikriKoro digital shop</div></div>
          <div className="relative px-4 pb-5 sm:px-7"><div className="-mt-12 flex flex-col gap-4 sm:-mt-14 sm:flex-row sm:items-end"><div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden border-4 border-white bg-brand-100 text-3xl font-bold text-brand-700 shadow-md sm:h-28 sm:w-28">{seller.photo_url ? <img src={seller.photo_url} alt={`${shopName} shop`} className="h-full w-full object-cover" /> : shopName.charAt(0)}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-bold tracking-tight text-ink-900">{shopName}</h1>{seller.is_verified && <span className="inline-flex items-center gap-1 bg-brand-500 px-2 py-1 text-xs font-bold text-white"><BadgeCheck size={14} />যাচাইকৃত seller</span>}</div>{seller.name && seller.name !== shopName && <p className="mt-1 text-sm text-ink-500">মালিক: {seller.name}</p>}<div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-600"><span className="inline-flex items-center gap-1">{seller.review_count > 0 ? <><Star size={15} className="fill-amber-400 text-amber-400" />{reviewAverage} · {seller.review_count}টি রিভিউ</> : 'এখনো কোনো রিভিউ নেই'}</span><span className="inline-flex items-center gap-1"><Package size={15} />{products.length}টি digital product</span><span className="inline-flex items-center gap-1"><Clock3 size={15} />{formatDate(seller.created_at)} থেকে</span></div></div><div className="flex flex-wrap gap-2 sm:justify-end"><button type="button" onClick={() => void handleFollow()} className={`inline-flex items-center justify-center gap-2 border px-3 py-2.5 text-base font-semibold transition ${following ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-outline text-ink-700 hover:border-brand-500 hover:text-brand-700'}`}><Heart size={16} className={following ? 'fill-brand-500 text-brand-500' : ''} />{following ? 'Follow করা আছে' : 'Follow Shop'}</button><button type="button" onClick={() => void handleChat()} className="inline-flex items-center justify-center gap-2 border border-brand-500 bg-brand-500 px-3 py-2.5 text-base font-semibold text-white transition hover:bg-brand-600"><MessageCircle size={16} />Chat Now</button></div></div>
          </div>
        </section>

        {actionMessage && <div className="mt-4 flex items-start justify-between gap-3 border border-brand-200 bg-brand-50 p-3 text-sm text-brand-800"><p>{actionMessage}</p><button type="button" onClick={() => setActionMessage(null)} aria-label="বার্তা বন্ধ করুন"><X size={16} /></button></div>}

        <section className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(18rem,0.7fr)]">
          <div className="border border-outline bg-surface p-5 shadow-sm sm:p-6"><div className="flex items-center gap-2"><ShieldCheck size={20} className="text-brand-600" /><h2 className="text-lg font-bold text-ink-900">Seller trust</h2></div><p className="mt-2 text-sm leading-6 text-ink-600">Buyer-এর জন্য seller-এর public verification ও shop activity এক জায়গায় দেখুন। ব্যক্তিগত phone, email বা sensitive verification document প্রকাশ করা হয় না।</p><div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4"><TrustItem label="Seller verification" value={seller.is_verified ? 'অনুমোদিত' : 'পাবলিশ হয়নি'} ok={seller.is_verified} /><TrustItem label="Digital catalogue" value={products.length > 0 ? 'সক্রিয়' : 'খালি'} ok={products.length > 0} /><TrustItem label="রিভিউ history" value={seller.review_count > 0 ? `${seller.review_count}টি` : 'নেই'} ok={seller.review_count > 0} /><TrustItem label="BikriKoro-তে" value={yearsOnPlatform > 0 ? `${yearsOnPlatform} বছর` : 'নতুন'} ok={yearsOnPlatform > 0} /></div></div>
          <div className="border border-brand-100 bg-brand-50 p-5 shadow-sm sm:p-6"><p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-700">Shop summary</p><div className="mt-4 grid grid-cols-2 gap-3"><Stat label="Rating" value={reviewAverage} icon={Star} /><Stat label="Products" value={String(products.length)} icon={Package} /><Stat label="Total views" value={String(totalViews)} icon={Eye} /><Stat label="Reviews" value={String(seller.review_count)} icon={Users} /></div><p className="mt-4 text-xs leading-5 text-brand-800/75">Response rate, sales total, follower count ও delivery score-এর live public source এখনো নেই—তাই এগুলোর অনুমান দেখানো হচ্ছে না।</p></div>
        </section>

        <section className="mt-5 border border-outline bg-surface p-5 shadow-sm sm:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-700">About this shop</p><h2 className="mt-1 text-xl font-bold text-ink-900">সেলার সম্পর্কে</h2></div><div className="flex gap-2"><button type="button" onClick={() => void handleShare()} className="inline-flex items-center gap-2 border border-outline px-3 py-2 text-sm font-semibold text-ink-700 hover:border-brand-500 hover:text-brand-700"><Share2 size={15} />Shop share</button><button type="button" onClick={() => setReportOpen(true)} className="inline-flex items-center gap-2 border border-outline px-3 py-2 text-sm font-semibold text-ink-700 hover:border-error hover:text-error"><Flag size={15} />Report</button></div></div><p className="mt-4 max-w-3xl whitespace-pre-line text-sm leading-7 text-ink-600">{seller.shop_description?.trim() || 'এই seller এখনো public shop description যোগ করেননি।'}</p></section>

        <section className="mt-5 border border-outline bg-surface p-5 shadow-sm sm:p-6"><div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-700">Digital catalogue</p><h2 className="mt-1 text-xl font-bold text-ink-900">এই shop-এর product</h2></div><div className="relative w-full lg:max-w-xs"><Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="এই shop-এ product খুঁজুন" className="w-full border border-outline bg-surface py-2.5 pl-9 pr-3 text-base outline-none transition focus:border-brand-500" /></div></div><div className="mt-4 flex gap-2 overflow-x-auto pb-1">{([['ALL', 'সব'], ['POPULAR', 'জনপ্রিয়'], ['LATEST', 'নতুন'], ['LOWEST', 'কম দাম'], ['HIGHEST', 'বেশি দাম']] as Array<[ProductFilter, string]>).map(([value, label]) => <button key={value} type="button" onClick={() => setFilter(value)} className={`shrink-0 border px-3 py-2 text-sm font-semibold transition ${filter === value ? 'border-brand-500 bg-brand-500 text-white' : 'border-outline text-ink-600 hover:border-brand-500 hover:text-brand-700'}`}>{label}</button>)}</div>{visibleProducts.length === 0 ? <div className="mt-5 border border-dashed border-outline bg-bg p-8 text-center"><Package size={28} className="mx-auto text-brand-500" /><p className="mt-3 font-semibold text-ink-900">{products.length === 0 ? 'এই seller-এর কোনো active digital product নেই' : 'এই search-এ কোনো product পাওয়া যায়নি'}</p><p className="mt-1 text-sm text-ink-500">Approved digital listing publish হলে এখানে দেখা যাবে।</p></div> : <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{visibleProducts.map((product) => <ProductCard key={product.id} product={product} />)}</div>}</section>

        <section className="mt-5 border border-outline bg-surface p-5 shadow-sm sm:p-6"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-700">Buyer feedback</p><h2 className="mt-1 text-xl font-bold text-ink-900">Customer reviews</h2></div>{seller.review_count > 0 && <span className="inline-flex items-center gap-1 text-base font-bold text-amber-600"><Star size={16} className="fill-amber-400 text-amber-400" />{reviewAverage}</span>}</div>{reviews.length === 0 ? <div className="mt-5 border border-dashed border-outline bg-bg p-7 text-center text-sm text-ink-500">এই seller-এর public review এখনো নেই। Verified purchase, photo বা video review data যুক্ত হলে এখানেই দেখানো হবে।</div> : <div className="mt-5 grid gap-3 md:grid-cols-2">{reviews.map((review) => <article key={review.id} className="border border-outline p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold text-ink-900">{review.buyer_name || 'ক্রেতা'}</p><p className="mt-1 text-xs text-ink-400">{review.product_title}</p></div><span className="text-sm text-amber-500">{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</span></div>{review.comment && <p className="mt-3 text-sm leading-6 text-ink-600">{review.comment}</p>}<p className="mt-3 text-xs text-ink-400">{formatDate(review.created_at)}</p></article>)}</div>}</section>

        <section className="mt-5 border border-dashed border-outline bg-bg p-5 text-sm leading-6 text-ink-500"><div className="flex items-center gap-2 font-semibold text-ink-700"><Zap size={17} className="text-brand-600" />এই profile-এ যা দেখানো হয় না</div><p className="mt-2">Phone/call button, location, followers/following counter, last-active, sales total, response time, delivery score, gallery, social links, coupon, flash sale এবং QR code—এসবের reliable public source এখনো BikriKoro-তে নেই। Buyer নিরাপত্তার জন্য সেগুলো অনুমান করে দেখানো হয়নি।</p></section>
      </div>
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-outline bg-surface/95 p-3 shadow-[0_-8px_24px_rgba(18,33,28,0.10)] backdrop-blur sm:hidden"><div className="mx-auto flex max-w-md gap-2"><button type="button" onClick={() => void handleFollow()} className={`flex min-w-0 flex-1 items-center justify-center gap-2 border px-3 py-3 text-base font-semibold ${following ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-outline text-ink-700'}`}><Heart size={17} className={following ? 'fill-brand-500 text-brand-500' : ''} />{following ? 'Follow করা আছে' : 'Follow'}</button><button type="button" onClick={() => void handleChat()} className="flex min-w-0 flex-1 items-center justify-center gap-2 border border-brand-500 bg-brand-500 px-3 py-3 text-base font-semibold text-white"><MessageCircle size={17} />Chat Seller</button></div></div>
      <BrandedDialog open={reportOpen} title="Shop report সম্পর্কে" onClose={() => setReportOpen(false)} tone="warning" actions={<DialogButton onClick={() => setReportOpen(false)}>বুঝেছি</DialogButton>}><p>Shop-level report এখনো আলাদা করে চালু নেই। কোনো নির্দিষ্ট product-এ সমস্যা থাকলে সেই product-এর page থেকে report করুন, যাতে admin সঠিক listing review করতে পারেন।</p></BrandedDialog>
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
