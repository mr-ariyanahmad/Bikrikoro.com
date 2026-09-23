import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Check, Coins, Loader2, Plus, ShieldCheck, Store, WalletCards } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { supabase, supabaseConfigured } from '@/lib/supabase'
import { auth } from '@/lib/firebase'
import { Layout } from '@/components/Layout'
import { ProductCard } from '@/components/ProductCard'
import { CommunityLinks } from '@/components/CommunityLinks'
import { CategoryPills } from '@/components/CategoryPills'
import { useAuth } from '@/context/AuthContext'
import { useIsSeller } from '@/hooks/useIsSeller'
import { formatTaka } from '@/lib/format'
import type { Product, Category, Profile, PromoBanner } from '@/types/product'
import { PUBLIC_PRODUCT_FIELDS, PUBLIC_PRODUCT_TABLE } from '@/lib/publicProductFields'
import { rankHomepageProductsByCategoryInterest, trackCategoryInterest } from '@/lib/recommendationPreferences'
import { readCachedValue, userCacheKey, writeCachedValue } from '@/lib/clientCache'

const HOMEPAGE_PRODUCT_PAGE_SIZE = 24
const HOMEPAGE_CACHE_KEY = 'bikrikoro:homepage-public-marketplace:v3'
const HOMEPAGE_CACHE_TTL_MS = 5 * 60 * 1000
const HOME_ACCOUNT_CACHE_MAX_AGE_MS = 12 * 60 * 60 * 1000

type HomepageCache = {
  cachedAt: number
  banners: PromoBanner[]
  categories: Category[]
  products: Product[]
  sellersById: Record<string, Pick<Profile, 'id' | 'name' | 'photo_url' | 'shop_name' | 'is_verified' | 'rating' | 'review_count'>>
  hasMoreProducts: boolean
}

type HomepageSeller = Pick<Profile, 'id' | 'name' | 'photo_url' | 'shop_name' | 'is_verified' | 'rating' | 'review_count'>

async function loadHomepageSellers(sellerIds: string[]) {
  if (sellerIds.length === 0) return {} as Record<string, HomepageSeller>
  const { data: directRows } = await supabase.from('profiles').select('id, name, photo_url, shop_name, is_verified, rating, review_count').in('id', sellerIds)
  const sellerMap = Object.fromEntries(((directRows ?? []) as HomepageSeller[]).map((seller) => [seller.id, seller])) as Record<string, HomepageSeller>
  const missingIds = sellerIds.filter((sellerId) => !sellerMap[sellerId])
  if (missingIds.length === 0) return sellerMap
  const publicRows = await Promise.all(missingIds.map(async (sellerId) => {
    const { data, error } = await supabase.rpc('get_public_seller_profile', { p_lookup: sellerId })
    if (error) return null
    const seller = Array.isArray(data) ? data[0] : data
    return seller ? { ...seller, id: seller.id ?? sellerId } as HomepageSeller : null
  }))
  publicRows.filter(Boolean).forEach((seller) => { if (seller) sellerMap[seller.id] = seller })
  return sellerMap
}

function readHomepageCache(): HomepageCache | null {
  try {
    const rawCache = window.localStorage.getItem(HOMEPAGE_CACHE_KEY)
    if (!rawCache) return null
    const cache = JSON.parse(rawCache) as HomepageCache
    if (!cache.cachedAt || Date.now() - cache.cachedAt > HOMEPAGE_CACHE_TTL_MS || !Array.isArray(cache.products)) return null
    return cache
  } catch {
    return null
  }
}

function writeHomepageCache(cache: HomepageCache) {
  try {
    window.localStorage.setItem(HOMEPAGE_CACHE_KEY, JSON.stringify(cache))
  } catch {
    // Private mode or storage quota must not block marketplace rendering.
  }
}

export default function Home() {
  const { user } = useAuth()
  const { isSeller } = useIsSeller()
  const [banners, setBanners] = useState<PromoBanner[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [sellersById, setSellersById] = useState<Record<string, HomepageSeller>>({})
  const [loading, setLoading] = useState(true)
  const [loadingMoreProducts, setLoadingMoreProducts] = useState(false)
  const [hasMoreProducts, setHasMoreProducts] = useState(false)
  const [productOffset, setProductOffset] = useState(0)
  const [balance, setBalance] = useState(0)
  const [rewardCoins, setRewardCoins] = useState(0)
  const [checkinStreak, setCheckinStreak] = useState(0)
  const [checkedIn, setCheckedIn] = useState(false)
  const [checkInMessage, setCheckInMessage] = useState<string | null>(null)
  const [checkInLoading, setCheckInLoading] = useState(false)
  const initialFeedRefreshInProgress = useRef(false)
  const navigate = useNavigate()
  const rankedHomeProducts = useMemo(() => {
    const ranked = rankHomepageProductsByCategoryInterest(products)
    if (ranked.length < 2) return ranked
    const daySeed = Math.floor(Date.now() / (24 * 60 * 60 * 1000))
    const offset = daySeed % ranked.length
    return [...ranked.slice(offset), ...ranked.slice(0, offset)]
  }, [products])
  const newListingProducts = rankedHomeProducts.slice(0, 6)
  const hotDealProducts = rankedHomeProducts.filter((product) => Boolean(product.original_price && product.original_price > product.price)).slice(0, 6)
  const handleCategorySelect = (categoryId: string | null) => {
    if (categoryId) trackCategoryInterest(categoryId, 'click')
    navigate(categoryId ? `/products?category=${categoryId}` : '/products')
  }

  useEffect(() => {
    let active = true
    async function load() {
      if (!supabaseConfigured) {
        setCheckInMessage('পণ্য এখন লোড করা যাচ্ছে না।')
        setLoading(false)
        return
      }
      const cachedHomepage = readHomepageCache()
      if (cachedHomepage && active) {
        setBanners(cachedHomepage.banners)
        setCategories(cachedHomepage.categories)
        setProducts(cachedHomepage.products)
        setSellersById(cachedHomepage.sellersById)
        setProductOffset(cachedHomepage.products.length)
        setHasMoreProducts(cachedHomepage.hasMoreProducts)
        setLoading(false)
      }
      initialFeedRefreshInProgress.current = true
      try {
        const [bannersRes, categoriesRes, templatesRes, productsRes] = await Promise.all([
          supabase.from('promo_banners').select('*').order('sort_order'),
          supabase.from('categories').select('*').order('sort_order'),
          supabase.from('digital_category_templates').select('category_id, sort_order').eq('is_active', true).order('sort_order'),
          supabase.from(PUBLIC_PRODUCT_TABLE).select(PUBLIC_PRODUCT_FIELDS).order('popularity_score', { ascending: false }).order('view_count', { ascending: false }).order('created_at', { ascending: false }).order('id', { ascending: false }).range(0, HOMEPAGE_PRODUCT_PAGE_SIZE - 1),
        ])
        if (!active) return
        if (bannersRes.error || categoriesRes.error || productsRes.error) {
          throw bannersRes.error ?? categoriesRes.error ?? productsRes.error
        }
        const globalProducts = (productsRes.data ?? []) as Product[]
        const loadedProducts = globalProducts
        const sellerIds = [...new Set(loadedProducts.map((product) => product.seller_id).filter(Boolean))]
        const nextSellers = await loadHomepageSellers(sellerIds)
        const categoryMap = new Map((categoriesRes.data ?? []).map((category) => [category.id, category]))
        const digitalCategories = (templatesRes.data ?? []).map((template) => categoryMap.get(template.category_id)).filter(Boolean)
        setBanners(bannersRes.data ?? [])
        setCategories(digitalCategories.length > 0 ? digitalCategories : categoriesRes.data ?? [])
        setProducts(loadedProducts)
        setSellersById(nextSellers)
        setProductOffset(loadedProducts.length)
        setHasMoreProducts(globalProducts.length === HOMEPAGE_PRODUCT_PAGE_SIZE)
        writeHomepageCache({
          cachedAt: Date.now(),
          banners: bannersRes.data ?? [],
          categories: digitalCategories.length > 0 ? digitalCategories : categoriesRes.data ?? [],
          products: loadedProducts,
          sellersById: nextSellers,
          hasMoreProducts: globalProducts.length === HOMEPAGE_PRODUCT_PAGE_SIZE,
        })
      } catch (loadError) {
        console.error('Homepage data load failed:', loadError)
        if (active && !cachedHomepage) setCheckInMessage('লাইভ পণ্যের তথ্য এখন পাওয়া যাচ্ছে না। পরে আবার চেষ্টা করুন।')
      } finally {
        initialFeedRefreshInProgress.current = false
        if (active) setLoading(false)
      }
    }
    void load()
    return () => { active = false }
  }, [])

  const loadMoreProducts = useCallback(async () => {
    if (!supabaseConfigured || loading || initialFeedRefreshInProgress.current || loadingMoreProducts || !hasMoreProducts) return
    setLoadingMoreProducts(true)
    try {
      const { data, error } = await supabase
        .from(PUBLIC_PRODUCT_TABLE)
        .select(PUBLIC_PRODUCT_FIELDS)
        .order('popularity_score', { ascending: false })
        .order('view_count', { ascending: false })
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .range(productOffset, productOffset + HOMEPAGE_PRODUCT_PAGE_SIZE - 1)
      if (error) throw error
        const nextProducts = (data ?? []) as Product[]
      const nextSellerIds = [...new Set(nextProducts.map((product) => product.seller_id).filter(Boolean))]
      const nextSellers = await loadHomepageSellers(nextSellerIds)
      setProducts((current) => {
        const knownIds = new Set(current.map((product) => product.id))
        return [...current, ...nextProducts.filter((product) => !knownIds.has(product.id))]
      })
      setSellersById((current) => ({ ...current, ...nextSellers }))
      setProductOffset((current) => current + nextProducts.length)
      setHasMoreProducts(nextProducts.length === HOMEPAGE_PRODUCT_PAGE_SIZE)
    } catch (error) {
      console.error('Homepage additional products load failed:', error)
      setCheckInMessage('আরও পণ্য লোড করা যায়নি। কিছুক্ষণ পরে আবার নিচে স্ক্রল করুন।')
    } finally {
      setLoadingMoreProducts(false)
    }
  }, [hasMoreProducts, loading, loadingMoreProducts, productOffset])

  useEffect(() => {
    if (!hasMoreProducts) return
    const handleScroll = () => {
      const remainingPageHeight = document.documentElement.scrollHeight - (window.scrollY + window.innerHeight)
      if (remainingPageHeight < 900) void loadMoreProducts()
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()
    return () => window.removeEventListener('scroll', handleScroll)
  }, [hasMoreProducts, loadMoreProducts])

  useEffect(() => {
    if (!user) { setBalance(0); setRewardCoins(0); setCheckinStreak(0); setCheckedIn(false); return }
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka' }).format(new Date())
    const cacheKey = userCacheKey(user.uid, 'home-account-summary')
    const cached = readCachedValue<{ balance: number; rewardCoins: number; checkinStreak: number; lastCheckinDate: string | null }>(cacheKey, HOME_ACCOUNT_CACHE_MAX_AGE_MS)
    if (cached) {
      setBalance(cached.value.balance)
      setRewardCoins(cached.value.rewardCoins)
      setCheckinStreak(cached.value.checkinStreak)
      setCheckedIn(cached.value.lastCheckinDate === today)
    }
    const loadAccountSnapshot = async () => {
      try {
        const idToken = await auth.currentUser?.getIdToken()
        if (!idToken) throw new Error('Firebase সেশন পাওয়া যায়নি।')
        const [walletResponse, rewards] = await Promise.all([
          fetch('/api/order-read', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` }, body: JSON.stringify({ action: 'wallet' }) }),
          supabase.from('reward_balances').select('coins, checkin_streak, last_checkin_date').eq('user_id', user.uid).maybeSingle(),
        ])
        const walletPayload = await walletResponse.json().catch(() => ({})) as { error?: string; balance?: { available_balance?: number } }
        if (!walletResponse.ok || rewards.error) throw new Error(walletPayload.error || rewards.error?.message || 'অ্যাকাউন্টের তথ্য লোড করা যায়নি')
        setBalance(Number(walletPayload.balance?.available_balance ?? 0))
        setRewardCoins(Number(rewards.data?.coins ?? 0))
        setCheckinStreak(Number(rewards.data?.checkin_streak ?? 0))
        setCheckedIn(rewards.data?.last_checkin_date === today)
        writeCachedValue(cacheKey, {
          balance: Number(walletPayload.balance?.available_balance ?? 0),
          rewardCoins: Number(rewards.data?.coins ?? 0),
          checkinStreak: Number(rewards.data?.checkin_streak ?? 0),
          lastCheckinDate: rewards.data?.last_checkin_date ?? null,
        })
      } catch (error) {
        console.error('Account snapshot load failed:', error)
        setCheckInMessage('ওয়ালেট বা পুরস্কারের তথ্য এখন লোড করা যাচ্ছে না। কিছুক্ষণ পরে আবার চেষ্টা করুন।')
      }
    }
    void loadAccountSnapshot()
  }, [user])

  const checkIn = async () => {
    if (!user) { navigate('/login'); return }
    if (!supabaseConfigured) { setCheckInMessage('ডেইলি চেক-ইন এখন চালু করা যাচ্ছে না।'); return }
    if (checkedIn || checkInLoading) return
    setCheckInLoading(true)
    setCheckInMessage(null)
    try {
      const { data, error } = await supabase.rpc('claim_daily_checkin', { p_user_id: user.uid })
      const result = Array.isArray(data) ? data[0] : data
      if (error || !result) {
        setCheckInMessage('ডেইলি চেক-ইন এখন চালু করা যাচ্ছে না। কিছুক্ষণ পরে আবার চেষ্টা করুন।')
        return
      }
      setRewardCoins(Number(result.total_coins ?? rewardCoins))
      setCheckinStreak(Number(result.streak ?? checkinStreak))
      setCheckedIn(true)
      setCheckInMessage(result.claimed ? `+${Number(result.awarded_coins ?? 10)} কয়েন যোগ হয়েছে।` : 'আজকের চেক-ইন আগেই নেওয়া হয়েছে।')
    } catch (error) {
      console.error('Daily check-in failed:', error)
      setCheckInMessage('চেক-ইন সম্পন্ন করা যায়নি। আবার চেষ্টা করুন।')
    } finally {
      setCheckInLoading(false)
    }
  }

  const productGrid = <><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">{loading ? Array.from({ length: 8 }).map((_, i) => <div key={i} className="aspect-[0.82] animate-pulse rounded-[1.25rem] bg-outline/40" />) : newListingProducts.map((product) => <ProductCard key={product.id} product={product} seller={sellersById[product.seller_id]} />)}</div>{!loading && <div className="mt-5 flex min-h-8 items-center justify-center text-xs font-medium text-ink-500">{loadingMoreProducts ? <span className="inline-flex items-center gap-2"><Loader2 size={15} className="animate-spin" />আরও পণ্য লোড হচ্ছে...</span> : hasMoreProducts ? <span>আরও পণ্য দেখতে নিচে স্ক্রল করুন</span> : null}</div>}</>
  const hotDealRail = <div className="scrollbar-none -mx-4 mt-4 flex gap-3 overflow-x-auto px-4 pb-1">{hotDealProducts.map((product) => <div key={product.id} className="w-[72vw] max-w-[18rem] shrink-0"><ProductCard product={product} seller={sellersById[product.seller_id]} /></div>)}</div>

  return <Layout wide>
    <Helmet><title>BikriKoro.Com — বাংলাদেশের নিরাপদ ডিজিটাল মার্কেটপ্লেস</title><meta name="description" content="এসক্রো-সুরক্ষিত ডিজিটাল মার্কেটপ্লেস — নিরাপদে ডিজিটাল কী, ফাইল, প্রবেশাধিকার, কোর্স ও সেবা কিনুন এবং বিক্রি করুন।" /></Helmet>
    <div className="md:hidden">
      <section className="-mx-4 -mt-5 border-b border-outline bg-bg px-4 pb-4 pt-1">
        <div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-brand-600">BikriKoro marketplace</p><h1 className="mt-1 text-[1.35rem] font-bold leading-tight tracking-tight text-ink-900">{isSeller ? 'কিনুন বা বিক্রি করুন' : 'আজ কী কিনবেন?'}</h1></div><Link to={isSeller ? '/sell' : '/become-seller'} aria-label={isSeller ? 'পণ্য পোস্ট করুন' : 'সেলার হোন'} className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-500 text-white shadow-[0_6px_16px_rgba(8,127,140,0.25)]">{isSeller ? <Plus size={21} /> : <Store size={18} />}</Link></div>
        <div className="mt-3 grid grid-cols-3 gap-2"><Link to="/wallet" className="rounded-2xl border border-outline bg-surface px-3 py-2.5"><span className="text-[10px] font-medium text-ink-500">ওয়ালেট</span><span className="mt-0.5 block truncate tabular-amount text-xs font-bold text-ink-900">{user ? formatTaka(balance) : 'লগইন'}</span></Link><button type="button" onClick={() => void checkIn()} disabled={checkInLoading || checkedIn} className="rounded-2xl border border-outline bg-surface px-3 py-2.5 text-left disabled:opacity-60"><span className="text-[10px] font-medium text-ink-500">চেক-ইন</span><span className="mt-0.5 block truncate text-xs font-bold text-accent-600">{checkedIn ? 'নেওয়া হয়েছে' : '+১০ কয়েন'}</span></button><Link to="/products" className="rounded-2xl border border-outline bg-surface px-3 py-2.5"><span className="text-[10px] font-medium text-ink-500">সুরক্ষা</span><span className="mt-0.5 block truncate text-xs font-bold text-brand-700">এসক্রো সুরক্ষিত</span></Link></div>
      </section>
      {checkInMessage && <p className="mt-3 rounded-2xl border border-accent-100 bg-accent-100 px-3 py-2 text-xs font-medium text-accent-600">{checkInMessage}</p>}
      {banners.length > 0 && <div className="scrollbar-none -mx-4 mt-4 flex gap-3 overflow-x-auto px-4 pb-1">{banners.slice(0, 3).map((banner) => <Link key={banner.id} to={banner.target_category_id ? `/products?category=${banner.target_category_id}` : '/products'} className="h-28 w-[78vw] shrink-0 overflow-hidden rounded-[1.35rem] bg-brand-100 shadow-sm"><img src={banner.image_url} alt="" className="h-full w-full object-cover" /></Link>)}</div>}
      <section className="mt-5"><div className="mb-2 flex items-center justify-between"><h2 className="text-lg font-bold text-ink-900">ক্যাটাগরি</h2><Link to="/products" className="text-xs font-bold text-brand-700">সব দেখুন →</Link></div><div className="-mx-4 overflow-x-auto px-4 pb-1"><CategoryPills categories={categories} selectedId={null} onSelect={handleCategorySelect} /></div></section>
      <section className="mt-6"><div className="flex items-end justify-between px-0.5"><div><p className="text-[11px] font-bold uppercase tracking-[0.08em] text-accent-600">জনপ্রিয় ও নতুন</p><h2 className="mt-0.5 text-xl font-bold text-ink-900">নতুন লিস্টিং</h2></div><Link to="/products" className="text-xs font-bold text-brand-700">সব দেখুন →</Link></div>{productGrid}</section>
      {hotDealProducts.length > 0 && <section className="mt-8"><div className="flex items-end justify-between px-0.5"><div><p className="text-[11px] font-bold uppercase tracking-[0.08em] text-accent-600">সাশ্রয়ী অফার</p><h2 className="mt-0.5 text-xl font-bold text-ink-900">Hot Deals</h2></div><Link to="/products?sort=discount" className="text-xs font-bold text-brand-700">সব দেখুন →</Link></div>{hotDealRail}</section>}
      {!loading && products.length === 0 && <p className="mt-8 rounded-2xl border border-outline bg-surface p-6 text-center text-sm text-ink-600">এখনো কোনো পণ্য যোগ হয়নি।</p>}
      <section className="mt-8 rounded-[1.35rem] border border-brand-100 bg-brand-50 px-4 py-4"><div className="flex items-center gap-2"><ShieldCheck size={18} className="text-brand-500" /><h2 className="text-sm font-bold text-ink-900">নিরাপদে কেনাকাটা করুন</h2></div><div className="mt-3 grid grid-cols-2 gap-y-2 text-xs text-ink-600"><span>✓ নিরাপদ পেমেন্ট</span><span>✓ যাচাইকৃত বিক্রেতা</span><span>✓ এসক্রো সুরক্ষা</span><span>✓ দ্রুত ডিজিটাল ডেলিভারি</span></div></section>
    </div>
    <div className="hidden md:block">
      {banners.length > 0 && <div className="scrollbar-none -mx-5 mb-6 flex gap-3 overflow-x-auto px-5 pb-1">{banners.map((banner) => <Link key={banner.id} to={banner.target_category_id ? `/products?category=${banner.target_category_id}` : '/products'} className="h-36 w-64 shrink-0 overflow-hidden rounded-2xl bg-outline/30 sm:h-44 sm:w-96"><img src={banner.image_url} alt="" className="h-full w-full object-cover" /></Link>)}</div>}
      {checkInMessage && <p className="mb-4 rounded-xl bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">{checkInMessage}</p>}
      <section className="mb-5 grid gap-3 sm:grid-cols-3"><Link to="/wallet" className="border border-outline bg-surface p-4 transition hover:border-brand-500"><div className="flex items-center justify-between"><span className="text-sm text-ink-500">আমার ব্যালেন্স</span><WalletCards size={18} className="text-brand-500" /></div><p className="mt-2 tabular-amount text-xl font-bold text-ink-900">{user ? formatTaka(balance) : 'লগইন করুন'}</p><p className="mt-1 text-xs text-ink-400">ওয়ালেট ও অর্থ উত্তোলন দেখুন</p></Link><button type="button" onClick={() => void checkIn()} disabled={checkInLoading || checkedIn} aria-busy={checkInLoading} className="border border-outline bg-surface p-4 text-left transition hover:border-brand-500 disabled:cursor-wait disabled:opacity-70"><div className="flex items-center justify-between"><span className="text-sm text-ink-500">দৈনিক চেক-ইন</span>{checkInLoading ? <Loader2 size={18} className="animate-spin text-brand-500" /> : <Coins size={18} className="text-brand-500" />}</div><p className="mt-2 text-lg font-bold text-ink-900">{checkInLoading ? 'চেক-ইন হচ্ছে...' : checkedIn ? `আজকের কয়েন পেয়েছেন · ${rewardCoins}` : '+১০ কয়েন নিন'}</p><p className="mt-1 flex items-center gap-1 text-xs text-ink-400">{checkedIn && <Check size={13} className="text-brand-500" />} মোট {rewardCoins} কয়েন · {checkinStreak} দিনের ধারাবাহিকতা</p></button><Link to="/products" className="border border-outline bg-surface p-4 transition hover:border-brand-500"><div className="flex items-center justify-between"><span className="text-sm text-ink-500">ডিজিটাল সুরক্ষা</span><ShieldCheck size={18} className="text-brand-500" /></div><p className="mt-2 text-lg font-bold text-ink-900">এসক্রো ও ডেলিভারি</p><p className="mt-1 text-xs text-ink-500">নিরাপদ ডিজিটাল পণ্য দেখুন →</p></Link></section>
      <section className="mb-6 border-y border-outline bg-surface p-6"><p className="text-sm font-medium text-brand-700">নিরাপদ ডিজিটাল মার্কেটপ্লেস</p><h1 className="mt-1 text-2xl font-semibold sm:text-3xl">বিশ্বাস করে কিনুন, নিশ্চিন্তে বিক্রি করুন</h1><p className="mt-2 max-w-md text-sm text-ink-600">এসক্রো সুরক্ষায় প্রতিটা লেনদেন — ডিজিটাল ডেলিভারি পেয়ে আপনি নিশ্চিত করার পরেই বিক্রেতার ওয়ালেটে অর্থ জমা হয়।</p><Link to={isSeller ? '/sell' : '/become-seller'} className="mt-4 inline-block bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600">{isSeller ? 'পণ্য পোস্ট করুন' : 'সেলার হোন'}</Link></section>
      <CategoryPills categories={categories} selectedId={null} onSelect={handleCategorySelect} /><div className="mt-5"><CommunityLinks placement="HOME" compact /></div><div className="mt-6 flex items-center justify-between"><h2 className="text-base font-semibold text-ink-900">পণ্য</h2><Link to="/products" className="text-sm font-medium text-brand-600 hover:text-brand-700">সব দেখুন →</Link></div>{productGrid}{!loading && products.length === 0 && <p className="mt-8 text-center text-ink-600">এখনো কোনো পণ্য যোগ হয়নি।</p>}
    </div>
  </Layout>
}
