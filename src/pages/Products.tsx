import { useEffect, useMemo, useState } from 'react'
import { BadgeCheck, BookmarkPlus, Grid2X2, List, Search, Share2, SlidersHorizontal, Store } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { supabase, supabaseConfigured } from '@/lib/supabase'
import { Layout } from '@/components/Layout'
import { ProductCard } from '@/components/ProductCard'
import { CategoryPills } from '@/components/CategoryPills'
import { BrandSelect } from '@/components/BrandSelect'
import type { Product, Category } from '@/types/product'
import { PUBLIC_PRODUCT_FIELDS, PUBLIC_PRODUCT_TABLE } from '@/lib/publicProductFields'
import { getRecentlyViewedIds } from '@/lib/recentlyViewed'
import { rankSearchProductsByInterest, trackCategoryInterest } from '@/lib/recommendationPreferences'
import { searchPublicShops, type SearchShop } from '@/lib/shopSearch'
import { shopUrl } from '@/lib/shopProfile'

type SortOption = 'newest' | 'oldest' | 'price_asc' | 'price_desc' | 'popular' | 'discount'
type ConditionFilter = 'all' | 'NEW' | 'USED'
type CachedProducts = { expiresAt: number; products: Product[] }
const productQueryCache = new Map<string, CachedProducts>()
const PRODUCT_CACHE_TTL_MS = 30_000

export default function Products() {
  const [searchParams, setSearchParams] = useSearchParams()
  const categoryId = searchParams.get('category')
  const query = searchParams.get('q') ?? ''
  const sort = (searchParams.get('sort') as SortOption) || 'popular'
  const condition = (searchParams.get('condition') as ConditionFilter) || 'all'
  const minPrice = searchParams.get('min') ?? ''
  const maxPrice = searchParams.get('max') ?? ''

  const [categories, setCategories] = useState<Category[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [shops, setShops] = useState<SearchShop[]>([])
  const [loading, setLoading] = useState(true)
  const [showFilters, setShowFilters] = useState(false)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => (localStorage.getItem('bikrikoro:products-view') as 'grid' | 'list') || 'grid')
  const [notice, setNotice] = useState<string | null>(null)
  const [debouncedQuery, setDebouncedQuery] = useState(query)

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedQuery(query), 250)
    return () => window.clearTimeout(timeout)
  }, [query])

  useEffect(() => {
    let cancelled = false
    const timer = window.setTimeout(async () => {
      const foundShops = await searchPublicShops(debouncedQuery)
      if (!cancelled) setShops(foundShops)
    }, debouncedQuery.trim().length >= 2 ? 0 : 150)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [debouncedQuery])

  useEffect(() => {
    if (!supabaseConfigured) return
    const loadCategories = async () => {
      const [{ data: templates, error: templateError }, { data: legacyCategories, error: categoryError }] = await Promise.all([
        supabase.from('digital_category_templates').select('category_id, sort_order').eq('is_active', true).order('sort_order'),
        supabase.from('categories').select('*').order('sort_order'),
      ])
      if (templateError || !templates || templates.length === 0) {
        if (categoryError) setNotice('ক্যাটাগরি লোড করা যাচ্ছে না।')
        setCategories((legacyCategories ?? []) as Category[])
        return
      }
      const categoryMap = new Map((legacyCategories ?? []).map((category) => [category.id, category]))
      setCategories(templates.map((template) => categoryMap.get(template.category_id)).filter((category): category is Category => Boolean(category)))
    }
    void loadCategories()
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    async function load() {
      if (!supabaseConfigured) {
        setProducts([])
        setNotice('পণ্য লোড করা যাচ্ছে না।')
        setLoading(false)
        return
      }
      try {
        const cacheKey = JSON.stringify({ categoryId, query: debouncedQuery.trim(), sort, condition, minPrice, maxPrice })
        const cached = productQueryCache.get(cacheKey)
        if (cached && cached.expiresAt > Date.now()) {
          setProducts(sort === 'popular' ? rankSearchProductsByInterest(cached.products, getRecentlyViewedIds()) : cached.products)
          setNotice(null)
          setLoading(false)
          return
        }
        let request = supabase
          .from(PUBLIC_PRODUCT_TABLE)
          .select(PUBLIC_PRODUCT_FIELDS)
        if (categoryId) request = request.eq('category_id', categoryId)
        if (debouncedQuery.trim()) request = request.ilike('title', `%${debouncedQuery.trim()}%`)
        if (condition !== 'all') request = request.eq('condition', condition)
        if (minPrice && Number(minPrice) >= 0) request = request.gte('price', Number(minPrice))
        if (maxPrice && Number(maxPrice) > 0) request = request.lte('price', Number(maxPrice))

        if (sort === 'price_asc') request = request.order('price', { ascending: true })
        else if (sort === 'price_desc') request = request.order('price', { ascending: false })
        else if (sort === 'oldest') request = request.order('created_at', { ascending: true })
        else if (sort === 'popular') request = request.order('popularity_score', { ascending: false }).order('view_count', { ascending: false }).order('created_at', { ascending: false })
        else request = request.order('created_at', { ascending: false })

        const { data, error } = await request.limit(60)
        if (error) throw error
        if (!cancelled) {
          const nextProducts = [...(data ?? [])] as Product[]
          setNotice(null)
          if (sort === 'discount') nextProducts.sort((a, b) => ((b.original_price ?? b.price) - b.price) / Math.max(b.original_price ?? b.price, 1) - ((a.original_price ?? a.price) - a.price) / Math.max(a.original_price ?? a.price, 1))
          const rankedProducts = sort === 'popular' ? rankSearchProductsByInterest(nextProducts, getRecentlyViewedIds()) : nextProducts
          setProducts(rankedProducts)
          productQueryCache.set(cacheKey, { expiresAt: Date.now() + PRODUCT_CACHE_TTL_MS, products: rankedProducts })
        }
      } catch (loadError) {
        console.error('Digital products load failed:', loadError)
        if (!cancelled) {
          setProducts([])
          setNotice('পণ্য এখন লোড করা যাচ্ছে না। কিছুক্ষণ পরে আবার চেষ্টা করুন।')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => { cancelled = true }
  }, [categoryId, debouncedQuery, sort, condition, minPrice, maxPrice])

  const activeFilterCount = useMemo(() => [condition !== 'all', Boolean(minPrice), Boolean(maxPrice)].filter(Boolean).length, [condition, minPrice, maxPrice])

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value)
    else next.delete(key)
    setSearchParams(next)
  }

  const clearFilters = () => {
    const next = new URLSearchParams(searchParams)
    ;['condition', 'min', 'max', 'sort'].forEach((key) => next.delete(key))
    setSearchParams(next)
  }

  const saveCurrentSearch = () => {
    const url = `${window.location.pathname}${window.location.search}`
    const label = query.trim() || (categoryId ? 'ডিজিটাল ক্যাটাগরি ফলাফল' : 'সব ডিজিটাল পণ্য')
    const saved = JSON.parse(localStorage.getItem('bikrikoro:saved-searches') ?? '[]') as Array<{ label: string; url: string }>
    localStorage.setItem('bikrikoro:saved-searches', JSON.stringify([{ label, url }, ...saved.filter((item) => item.url !== url)].slice(0, 8)))
    setNotice('সার্চটি সেভ হয়েছে।')
  }

  const shareCurrentSearch = async () => {
    try { await navigator.clipboard.writeText(window.location.href); setNotice('এই ফিল্টারের লিংক কপি হয়েছে।') } catch { setNotice('ফিল্টারের লিংক কপি করা যায়নি।') }
  }

  const changeView = (next: 'grid' | 'list') => { setViewMode(next); localStorage.setItem('bikrikoro:products-view', next) }
  const handleCategorySelect = (id: string | null) => { if (id) trackCategoryInterest(id, 'click'); updateParam('category', id ?? '') }

  return (
    <Layout wide>
      <Helmet>
        <title>ডিজিটাল পণ্য ব্রাউজ করুন | BikriKoro.Com</title>
        <meta name="description" content="বাংলাদেশের নিরাপদ digital key, file, access এবং service marketplace।" />
        <link rel="canonical" href="https://bikrikoro.com/products" />
      </Helmet>

      <div className="mb-5 rounded-2xl border border-brand-100 bg-surface p-2 shadow-[0_8px_22px_rgba(15,23,42,0.05)] sm:flex sm:items-center sm:gap-3 sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none">
        <div className="relative flex-1"><Search size={19} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" /><input type="search" value={query} onChange={(event) => updateParam('q', event.target.value)} aria-label="ডিজিটাল পণ্য খুঁজুন" placeholder="ডিজিটাল পণ্য, গেম, সাবস্ক্রিপশন খুঁজুন..." className="w-full rounded-xl border border-outline bg-bg py-3 pl-11 pr-4 text-base outline-none focus:border-brand-500 sm:rounded-none" /></div>
        <button type="button" onClick={() => setShowFilters((current) => !current)} aria-expanded={showFilters} className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-3 py-3 text-sm font-bold text-white sm:mt-0 sm:w-auto sm:border sm:border-outline sm:bg-transparent sm:text-ink-700 sm:hover:border-brand-500 sm:hover:text-brand-700"><SlidersHorizontal size={16} />ফিল্টার {activeFilterCount > 0 ? `(${activeFilterCount})` : ''}</button>
        <div className="min-w-44"><BrandSelect label="সাজান" value={sort} options={[{ value: 'popular', label: 'জনপ্রিয় ও প্রাসঙ্গিক আগে' }, { value: 'newest', label: 'নতুন আগে' }, { value: 'oldest', label: 'পুরোনো আগে' }, { value: 'discount', label: 'বেশি ছাড় আগে' }, { value: 'price_asc', label: 'দাম: কম থেকে বেশি' }, { value: 'price_desc', label: 'দাম: বেশি থেকে কম' }]} onChange={(value) => updateParam('sort', value)} /></div>
      </div>

      <div className={`${showFilters ? 'block' : 'hidden'} mb-5 border border-outline bg-surface p-4 sm:block`}>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-base text-ink-700"><span className="mb-1 block font-medium text-ink-900">ন্যূনতম দাম</span><input type="number" min="0" value={minPrice} onChange={(event) => updateParam('min', event.target.value)} placeholder="৳ ০" className="w-full border border-outline px-3 py-2 text-base outline-none focus:border-brand-500" /></label>
          <label className="text-base text-ink-700"><span className="mb-1 block font-medium text-ink-900">সর্বোচ্চ দাম</span><input type="number" min="0" value={maxPrice} onChange={(event) => updateParam('max', event.target.value)} placeholder="৳ সীমা নেই" className="w-full border border-outline px-3 py-2 text-base outline-none focus:border-brand-500" /></label>
          <BrandSelect label="অবস্থা" value={condition} options={[{ value: 'all', label: 'সব ধরনের' }, { value: 'NEW', label: 'নতুন' }, { value: 'USED', label: 'ব্যবহৃত' }]} onChange={(value) => updateParam('condition', value)} />
        </div>
        {activeFilterCount > 0 && <div className="mt-3"><button type="button" onClick={clearFilters} className="text-base font-semibold text-error hover:underline">সব ফিল্টার পরিষ্কার করুন</button></div>}
      </div>

      <CategoryPills categories={categories} selectedId={categoryId} onSelect={handleCategorySelect} />

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-base text-ink-700">
        <span>{loading ? 'খোঁজা হচ্ছে...' : query ? `“${query}” এর জন্য ${products.length.toLocaleString('bn-BD')}টি ফলাফল` : `${products.length.toLocaleString('bn-BD')}টি ডিজিটাল পণ্য`}</span>
        <div className="flex items-center gap-1.5"><button type="button" onClick={saveCurrentSearch} className="inline-flex items-center gap-1 border border-outline px-2.5 py-1.5 text-base font-semibold hover:border-brand-500 hover:text-brand-700"><BookmarkPlus size={14} />সার্চ সেভ</button><button type="button" onClick={() => void shareCurrentSearch()} className="inline-flex items-center gap-1 border border-outline px-2.5 py-1.5 text-base font-semibold hover:border-brand-500 hover:text-brand-700"><Share2 size={14} />শেয়ার</button><button type="button" onClick={() => changeView('grid')} className={`p-1.5 ${viewMode === 'grid' ? 'bg-brand-50 text-brand-700' : 'text-ink-400'}`} aria-label="গ্রিড ভিউ"><Grid2X2 size={16} /></button><button type="button" onClick={() => changeView('list')} className={`p-1.5 ${viewMode === 'list' ? 'bg-brand-50 text-brand-700' : 'text-ink-400'}`} aria-label="লিস্ট ভিউ"><List size={17} /></button></div>
      </div>
      {notice && <p className="mt-2 border border-brand-100 bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700">{notice}</p>}
      {query.trim().length >= 2 && shops.length > 0 && <section className="mt-4 border border-brand-100 bg-brand-50/50 p-3 sm:p-4"><div className="mb-3 flex items-center gap-2"><Store size={18} className="text-brand-600" /><h2 className="font-bold text-ink-900">মিলেছে শপ</h2><span className="text-sm text-ink-500">{shops.length}টি</span></div><div className="grid gap-2 sm:grid-cols-2">{shops.map((shop) => <Link key={shop.id} to={shopUrl(shop.shop_username, shop.id)} className="flex items-center gap-3 border border-outline bg-surface p-3 transition hover:border-brand-300"><div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-100 font-bold text-brand-700">{shop.photo_url ? <img src={shop.photo_url} alt="" className="h-full w-full object-cover" /> : (shop.shop_name?.trim() || shop.name).charAt(0)}</div><div className="min-w-0 flex-1"><p className="truncate font-bold text-ink-900">{shop.shop_name?.trim() || shop.name}</p><p className="mt-0.5 flex items-center gap-1 text-sm text-ink-500">{shop.is_verified && <BadgeCheck size={14} className="text-brand-600" />}{shop.review_count > 0 ? `★ ${shop.rating.toFixed(1)} · ${shop.review_count} রিভিউ` : 'ডিজিটাল শপ'}</p></div><span className="text-sm font-semibold text-brand-700">শপ দেখুন</span></Link>)}</div></section>}

      <div className={`mt-3 grid gap-3 ${viewMode === 'list' ? 'grid-cols-1' : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4'}`}>
        {loading ? Array.from({ length: 12 }).map((_, index) => <div key={index} className="aspect-[3/4] animate-pulse bg-outline/40" />) : products.map((product) => <ProductCard key={product.id} product={product} compact={viewMode === 'list'} />)}
      </div>
      {!loading && products.length === 0 && <p className="mt-10 text-center text-ink-700">এই ফিল্টারে কোনো ডিজিটাল পণ্য পাওয়া যায়নি।</p>}
    </Layout>
  )
}
