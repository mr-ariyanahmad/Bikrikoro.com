import { useEffect, useState } from 'react'
import { ArrowRight, BadgeCheck, Clock3, Flame, Search, Store, Tag } from 'lucide-react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Layout } from '@/components/Layout'
import { supabase } from '@/lib/supabase'
import { PUBLIC_PRODUCT_FIELDS, PUBLIC_PRODUCT_TABLE } from '@/lib/publicProductFields'
import { getTrendingSearches, loadPublicSettings } from '@/lib/publicSettings'
import { getRecentlyViewedIds } from '@/lib/recentlyViewed'
import { formatTaka } from '@/lib/format'
import { isTestDemoProduct, rankSearchProductsByInterest, trackCategoryInterest } from '@/lib/recommendationPreferences'
import { searchPublicShops, type SearchShop } from '@/lib/shopSearch'
import { shopUrl } from '@/lib/shopProfile'
import type { Category, Product } from '@/types/product'

const RECENT_KEY = 'bikrikoro:recent-searches'

export default function SearchPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const query = searchParams.get('q')?.trim() ?? ''
  const [categories, setCategories] = useState<Category[]>([])
  const [trending, setTrending] = useState<string[]>([])
  const [recent, setRecent] = useState<string[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [shops, setShops] = useState<SearchShop[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    try { setRecent(JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]')) } catch { setRecent([]) }
    void loadPublicSettings().then((settings) => setTrending(getTrendingSearches(settings)))
    void (async () => {
      const [{ data: templates }, { data: categoryRows }] = await Promise.all([
        supabase.from('digital_category_templates').select('category_id, sort_order').eq('is_active', true).order('sort_order').limit(24),
        supabase.from('categories').select('id, name, icon_url, sort_order').order('sort_order').limit(24),
      ])
      const rows = (categoryRows ?? []) as Category[]
      if (!templates?.length) { setCategories(rows); return }
      const categoryById = new Map(rows.map((category) => [category.id, category]))
      setCategories(templates.map((template) => categoryById.get(template.category_id)).filter((category): category is Category => Boolean(category)))
    })()
  }, [])

  useEffect(() => {
    let active = true
    setLoading(true)
    const timer = window.setTimeout(async () => {
      let request = supabase.from(PUBLIC_PRODUCT_TABLE).select(PUBLIC_PRODUCT_FIELDS).eq('is_digital', true)
      request = query.length >= 2
        ? request.ilike('title', `%${query}%`).order('popularity_score', { ascending: false }).order('view_count', { ascending: false }).order('created_at', { ascending: false })
        : request.order('popularity_score', { ascending: false }).order('view_count', { ascending: false }).order('created_at', { ascending: false })
      const [{ data, error }, foundShops] = await Promise.all([request.limit(query.length >= 2 ? 40 : 12), searchPublicShops(query)])
      if (!active) return
      if (error) { setProducts([]); setShops([]); setLoading(false); return }
      const shopIds = foundShops.map((shop) => shop.id)
      const { data: shopProducts } = query.length >= 2 && shopIds.length > 0
        ? await supabase.from(PUBLIC_PRODUCT_TABLE).select(PUBLIC_PRODUCT_FIELDS).eq('is_digital', true).in('seller_id', shopIds).order('popularity_score', { ascending: false }).order('view_count', { ascending: false }).limit(24)
        : { data: [] }
      if (!active) return
      const allProducts = [...(data ?? []), ...(shopProducts ?? [])] as Product[]
      const uniqueProducts = [...new Map(allProducts.map((product) => [product.id, product])).values()]
      setProducts(rankSearchProductsByInterest(uniqueProducts, getRecentlyViewedIds()).filter((product) => !isTestDemoProduct(product)))
      setShops(foundShops)
      setLoading(false)
    }, query.length >= 2 ? 220 : 0)
    return () => { active = false; window.clearTimeout(timer) }
  }, [query])

  const goToResults = (term: string) => navigate(`/products?q=${encodeURIComponent(term)}`)

  return <Layout fullScreen hideFooter hideMobileQuickNav backFallback="/" backLabel="হোমে ফিরুন">
    <div className="-mx-4 flex min-h-0 flex-1 flex-col bg-bg sm:mx-0">
      <div className="flex-1 overflow-y-auto px-4 pb-7 pt-4 sm:mx-auto sm:w-full sm:max-w-5xl sm:px-0">
        {query.length < 2 ? <>
          {recent.length > 0 && <section className="border-b border-outline pb-5"><div className="flex items-center justify-between"><h1 className="flex items-center gap-2 text-lg font-bold text-ink-900"><Clock3 size={19} className="text-brand-600" />সাম্প্রতিক সার্চ</h1><button type="button" onClick={() => { localStorage.removeItem(RECENT_KEY); setRecent([]) }} className="text-sm font-semibold text-ink-500">মুছে দিন</button></div><div className="mt-3 flex flex-wrap gap-2">{recent.map((term) => <button key={term} type="button" onClick={() => goToResults(term)} className="rounded-full border border-outline bg-surface px-3.5 py-2 text-sm font-medium text-ink-700 active:scale-[0.98]">{term}</button>)}</div></section>}
          {trending.length > 0 && <section className="border-b border-outline py-5"><h2 className="flex items-center gap-2 text-lg font-bold text-ink-900"><Flame size={19} className="text-amber-500" />জনপ্রিয় সার্চ</h2><div className="mt-3 flex flex-wrap gap-2">{trending.map((term) => <button key={term} type="button" onClick={() => goToResults(term)} className="rounded-full bg-brand-50 px-3.5 py-2 text-sm font-semibold text-brand-700 active:scale-[0.98]">{term}</button>)}</div></section>}
          <section className="py-5"><h2 className="flex items-center gap-2 text-lg font-bold text-ink-900"><Tag size={19} className="text-brand-600" />ক্যাটাগরি দিয়ে ব্রাউজ করুন</h2><div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3">{categories.slice(0, 12).map((category) => <button key={category.id} type="button" onClick={() => { trackCategoryInterest(category.id, 'click'); navigate(`/products?category=${category.id}`) }} className="flex min-h-12 items-center justify-between rounded-xl border border-outline bg-surface px-3 text-left text-sm font-semibold text-ink-700 shadow-sm active:scale-[0.98]"><span className="truncate">{category.name}</span><ArrowRight size={16} className="shrink-0 text-ink-300" /></button>)}</div></section>
        </> : <section className="border-b border-outline pb-4"><div className="flex items-center justify-between gap-3"><h1 className="text-lg font-bold text-ink-900">“{query}” এর সার্চ সাজেশন</h1><Link to={`/products?q=${encodeURIComponent(query)}`} className="shrink-0 text-sm font-bold text-brand-700">সব ফলাফল</Link></div><p className="mt-1 text-sm text-ink-500">শপ, আপনার পছন্দ ও জনপ্রিয়তার ভিত্তিতে সাজানো</p></section>}

        {query.length >= 2 && !loading && shops.length > 0 && <section className="border-b border-outline py-4"><div className="mb-3 flex items-center justify-between"><h2 className="flex items-center gap-2 text-lg font-bold text-ink-900"><Store size={19} className="text-brand-600" />মিলেছে শপ</h2><span className="text-sm text-ink-400">{shops.length}টি</span></div><div className="space-y-2">{shops.map((shop) => <Link key={shop.id} to={shopUrl(shop.shop_username, shop.id)} className="flex items-center gap-3 rounded-2xl border border-outline bg-surface p-3 shadow-sm transition active:scale-[0.99]"><div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-100 font-bold text-brand-700">{shop.photo_url ? <img src={shop.photo_url} alt="" className="h-full w-full object-cover" /> : (shop.shop_name?.trim() || shop.name).charAt(0)}</div><div className="min-w-0 flex-1"><p className="truncate font-bold text-ink-900">{shop.shop_name?.trim() || shop.name}</p><p className="mt-0.5 flex items-center gap-1 text-sm text-ink-500">{shop.is_verified && <BadgeCheck size={14} className="text-brand-600" />} {shop.review_count > 0 ? `★ ${shop.rating.toFixed(1)} · ${shop.review_count} রিভিউ` : 'ডিজিটাল শপ'}</p></div><ArrowRight size={18} className="shrink-0 text-ink-300" /></Link>)}</div></section>}

        <section className={query.length < 2 ? 'pt-1' : 'pt-4'}><div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-bold text-ink-900">{query.length < 2 ? 'জনপ্রিয় ডিজিটাল পণ্য' : 'পণ্য সাজেশন'}</h2>{loading ? <span className="text-xs font-medium text-ink-400">খোঁজা হচ্ছে...</span> : <span className="text-xs font-medium text-ink-400">{products.length}টি পণ্য</span>}</div><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">{loading ? Array.from({ length: 6 }).map((_, index) => <div key={index} className="aspect-[3/4] animate-pulse rounded-2xl bg-outline/40" />) : products.map((product) => <Link key={product.id} to={`/products/${product.id}`} onClick={() => trackCategoryInterest(product.category_id, 'click')} className="overflow-hidden rounded-2xl border border-outline bg-surface shadow-sm transition active:scale-[0.98]"><div className="aspect-square bg-bg">{product.images?.[0] && <img src={product.images[0]} alt="" className="h-full w-full object-cover" />}</div><div className="p-3"><p className="line-clamp-2 min-h-10 text-sm font-semibold leading-5 text-ink-900">{product.title}</p><p className="mt-2 tabular-amount text-lg font-bold text-brand-700">{formatTaka(product.price)}</p><p className="mt-1 text-xs text-ink-400">ডিজিটাল পণ্য</p></div></Link>)}</div>{!loading && products.length === 0 && <div className="py-14 text-center"><Search size={28} className="mx-auto text-ink-300" /><p className="mt-3 font-semibold text-ink-800">কোনো পণ্য পাওয়া যায়নি</p><p className="mt-1 text-sm text-ink-500">অন্য শব্দ দিয়ে খুঁজে দেখুন।</p></div>}</section>
      </div>
    </div>
  </Layout>
}
