import { useEffect, useMemo, useState } from 'react'
import { BadgeCheck, BookmarkPlus, Check, Grid2X2, List, Search, Share2, SlidersHorizontal, X } from 'lucide-react'
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
import { publicCacheKey, readCachedValue, writeCachedValue } from '@/lib/clientCache'

type SortOption = 'newest' | 'oldest' | 'price_asc' | 'price_desc' | 'popular' | 'discount'
type ConditionFilter = 'all' | 'NEW' | 'USED'
const PRODUCT_CACHE_MAX_AGE_MS = 15 * 60 * 1000

export default function Products() {
  const [searchParams, setSearchParams] = useSearchParams()
  const categoryId = searchParams.get('category')
  const query = searchParams.get('q') ?? ''
  const sort = (searchParams.get('sort') as SortOption) || 'popular'
  const condition = (searchParams.get('condition') as ConditionFilter) || 'all'
  const minPrice = searchParams.get('min') ?? ''
  const maxPrice = searchParams.get('max') ?? ''
  const productCacheKey = publicCacheKey('products', JSON.stringify({ categoryId, query: query.trim(), sort, condition, minPrice, maxPrice }))

  const [categories, setCategories] = useState<Category[]>([])
  const [products, setProducts] = useState<Product[]>(() => readCachedValue<Product[]>(productCacheKey, PRODUCT_CACHE_MAX_AGE_MS)?.value ?? [])
  const [shops, setShops] = useState<SearchShop[]>([])
  const [loading, setLoading] = useState(() => !readCachedValue<Product[]>(productCacheKey, PRODUCT_CACHE_MAX_AGE_MS))
  const [showFilters, setShowFilters] = useState(false)
  const [draftMinPrice, setDraftMinPrice] = useState('')
  const [draftMaxPrice, setDraftMaxPrice] = useState('')
  const [draftCondition, setDraftCondition] = useState<ConditionFilter>('all')
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
    let restoredCachedProducts = false

    async function load() {
      if (!supabaseConfigured) {
        setProducts([])
        setNotice('পণ্য লোড করা যাচ্ছে না।')
        setLoading(false)
        return
      }
      try {
        const cacheKey = publicCacheKey('products', JSON.stringify({ categoryId, query: debouncedQuery.trim(), sort, condition, minPrice, maxPrice }))
        const cached = readCachedValue<Product[]>(cacheKey, PRODUCT_CACHE_MAX_AGE_MS)
        if (cached && !cancelled) {
          restoredCachedProducts = true
          setProducts(sort === 'popular' ? rankSearchProductsByInterest(cached.value, getRecentlyViewedIds()) : cached.value)
          setNotice(null)
          setLoading(false)
        } else if (!cached && !cancelled) {
          setLoading(true)
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
          writeCachedValue(cacheKey, rankedProducts)
        }
      } catch (loadError) {
        console.error('Digital products load failed:', loadError)
        if (!cancelled) {
          if (!restoredCachedProducts) setProducts([])
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
    setDraftMinPrice('')
    setDraftMaxPrice('')
    setDraftCondition('all')
    setShowFilters(false)
  }

  const openFilterSheet = () => {
    setDraftMinPrice(minPrice)
    setDraftMaxPrice(maxPrice)
    setDraftCondition(condition)
    setShowFilters(true)
  }

  const applyFilters = () => {
    const next = new URLSearchParams(searchParams)
    if (draftMinPrice) next.set('min', draftMinPrice); else next.delete('min')
    if (draftMaxPrice) next.set('max', draftMaxPrice); else next.delete('max')
    if (draftCondition !== 'all') next.set('condition', draftCondition); else next.delete('condition')
    setSearchParams(next)
    setShowFilters(false)
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

      <div className="mb-4 rounded-2xl border border-brand-100 bg-surface p-2.5 shadow-[0_8px_22px_rgba(15,23,42,0.05)] sm:mb-5 sm:flex sm:items-center sm:gap-3 sm:p-3">
        <div className="relative flex-1"><Search size={19} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" /><input type="search" value={query} onChange={(event) => updateParam('q', event.target.value)} aria-label="ডিজিটাল পণ্য খুঁজুন" placeholder="ডিজিটাল পণ্য, গেম, সাবস্ক্রিপশন খুঁজুন..." className="w-full rounded-xl border border-outline bg-bg py-3 pl-11 pr-4 text-base outline-none focus:border-brand-500" /></div>
        <button type="button" onClick={openFilterSheet} aria-expanded={showFilters} className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-3.5 py-3 text-sm font-bold text-white shadow-sm active:scale-[0.98] sm:mt-0 sm:w-auto sm:border sm:border-brand-100 sm:bg-brand-50 sm:text-brand-700 sm:shadow-none sm:hover:border-brand-500 sm:hover:bg-brand-50"><SlidersHorizontal size={16} />ফিল্টার {activeFilterCount > 0 ? `(${activeFilterCount})` : ''}</button>
        <div className="hidden min-w-52 sm:block"><BrandSelect label="সাজান" value={sort} options={[{ value: 'popular', label: 'জনপ্রিয় ও প্রাসঙ্গিক আগে' }, { value: 'newest', label: 'নতুন আগে' }, { value: 'oldest', label: 'পুরোনো আগে' }, { value: 'discount', label: 'বেশি ছাড় আগে' }, { value: 'price_asc', label: 'দাম: কম থেকে বেশি' }, { value: 'price_desc', label: 'দাম: বেশি থেকে কম' }]} onChange={(value) => updateParam('sort', value)} /></div>
      </div>

      <div className="mb-5 hidden rounded-2xl border border-outline bg-surface p-4 shadow-[0_6px_18px_rgba(15,23,42,0.035)] sm:block">
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-base text-ink-700"><span className="mb-1 block font-medium text-ink-900">ন্যূনতম দাম</span><input type="number" min="0" value={minPrice} onChange={(event) => updateParam('min', event.target.value)} placeholder="৳ ০" className="w-full border border-outline px-3 py-2 text-base outline-none focus:border-brand-500" /></label>
          <label className="text-base text-ink-700"><span className="mb-1 block font-medium text-ink-900">সর্বোচ্চ দাম</span><input type="number" min="0" value={maxPrice} onChange={(event) => updateParam('max', event.target.value)} placeholder="৳ সীমা নেই" className="w-full border border-outline px-3 py-2 text-base outline-none focus:border-brand-500" /></label>
          <BrandSelect label="অবস্থা" value={condition} options={[{ value: 'all', label: 'সব ধরনের' }, { value: 'NEW', label: 'নতুন' }, { value: 'USED', label: 'ব্যবহৃত' }]} onChange={(value) => updateParam('condition', value)} />
        </div>
        {activeFilterCount > 0 && <div className="mt-3"><button type="button" onClick={clearFilters} className="text-base font-semibold text-error hover:underline">সব ফিল্টার পরিষ্কার করুন</button></div>}
      </div>

      <div className="sticky top-0 z-20 -mx-4 mb-4 border-y border-outline bg-bg/95 px-4 py-2 backdrop-blur sm:hidden">
        <div className="grid grid-cols-4 gap-1 rounded-xl bg-surface p-1">
          {[{ value: 'popular' as SortOption, label: 'সেরা মিল' }, { value: 'newest' as SortOption, label: 'নতুন' }, { value: 'price_asc' as SortOption, label: 'কম দাম' }].map((option) => <button type="button" key={option.value} onClick={() => updateParam('sort', option.value)} className={`min-h-10 rounded-lg px-1 text-xs font-bold transition active:scale-[0.97] ${sort === option.value ? 'bg-brand-600 text-white shadow-sm' : 'text-ink-600'}`}>{option.label}</button>)}
          <button type="button" onClick={openFilterSheet} className={`relative flex min-h-10 items-center justify-center gap-1 rounded-lg px-1 text-xs font-bold transition active:scale-[0.97] ${activeFilterCount > 0 ? 'bg-brand-50 text-brand-700' : 'text-ink-600'}`}><SlidersHorizontal size={14} />ফিল্টার{activeFilterCount > 0 && <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-brand-600" />}</button>
        </div>
      </div>

      {showFilters && <div className="fixed inset-0 z-50 sm:hidden" role="dialog" aria-modal="true" aria-label="সার্চ ফিল্টার"><button type="button" aria-label="ফিল্টার বন্ধ করুন" onClick={() => setShowFilters(false)} className="absolute inset-0 bg-ink-900/45" /><section className="absolute inset-x-0 bottom-0 max-h-[86vh] overflow-y-auto rounded-t-3xl bg-surface shadow-2xl"><div className="sticky top-0 flex items-center justify-between border-b border-outline bg-surface px-5 py-4"><div><h2 className="text-lg font-bold text-ink-900">ফিল্টার</h2><p className="text-xs text-ink-500">আপনার পছন্দ অনুযায়ী ফলাফল সাজান</p></div><button type="button" onClick={() => setShowFilters(false)} className="rounded-full p-2 text-ink-500 active:bg-bg" aria-label="বন্ধ করুন"><X size={20} /></button></div><div className="space-y-6 p-5"><div><p className="mb-2.5 font-bold text-ink-900">সাজান</p><div className="grid grid-cols-2 gap-2">{[{ value: 'popular' as SortOption, label: 'সেরা মিল' }, { value: 'newest' as SortOption, label: 'নতুন আগে' }, { value: 'discount' as SortOption, label: 'বেশি ছাড়' }, { value: 'price_asc' as SortOption, label: 'কম দাম' }, { value: 'price_desc' as SortOption, label: 'বেশি দাম' }].map((option) => <button type="button" key={option.value} onClick={() => updateParam('sort', option.value)} className={`flex min-h-11 items-center justify-between rounded-xl border px-3 text-left text-sm font-semibold ${sort === option.value ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-outline text-ink-700'}`}>{option.label}{sort === option.value && <Check size={16} />}</button>)}</div></div><div><p className="mb-2.5 font-bold text-ink-900">দামের সীমা</p><div className="grid grid-cols-2 items-center gap-2"><input type="number" min="0" inputMode="numeric" value={draftMinPrice} onChange={(event) => setDraftMinPrice(event.target.value)} placeholder="সর্বনিম্ন" className="min-h-12 rounded-xl border border-outline bg-bg px-3 text-sm outline-none focus:border-brand-500" /><input type="number" min="0" inputMode="numeric" value={draftMaxPrice} onChange={(event) => setDraftMaxPrice(event.target.value)} placeholder="সর্বোচ্চ" className="min-h-12 rounded-xl border border-outline bg-bg px-3 text-sm outline-none focus:border-brand-500" /></div></div><div><p className="mb-2.5 font-bold text-ink-900">পণ্যের অবস্থা</p><div className="grid grid-cols-3 gap-2">{([{ value: 'all', label: 'সব' }, { value: 'NEW', label: 'নতুন' }, { value: 'USED', label: 'ব্যবহৃত' }] as const).map((option) => <button type="button" key={option.value} onClick={() => setDraftCondition(option.value)} className={`min-h-11 rounded-xl border px-2 text-sm font-semibold ${draftCondition === option.value ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-outline text-ink-700'}`}>{option.label}</button>)}</div></div></div><div className="sticky bottom-0 grid grid-cols-2 gap-3 border-t border-outline bg-surface p-4"><button type="button" onClick={clearFilters} className="min-h-12 rounded-xl border border-brand-600 text-sm font-bold text-brand-700 active:scale-[0.98]">রিসেট</button><button type="button" onClick={applyFilters} className="min-h-12 rounded-xl bg-brand-600 text-sm font-bold text-white shadow-sm active:scale-[0.98]">ফলাফল দেখুন</button></div></section></div>}

      <CategoryPills categories={categories} selectedId={categoryId} onSelect={handleCategorySelect} />

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-outline bg-surface px-3.5 py-2.5 text-sm text-ink-700 shadow-[0_5px_14px_rgba(15,23,42,0.03)] sm:px-4">
        <span className="font-semibold">{loading ? 'খোঁজা হচ্ছে...' : query ? `“${query}” এর জন্য ${products.length.toLocaleString('bn-BD')}টি ফলাফল` : `${products.length.toLocaleString('bn-BD')}টি ডিজিটাল পণ্য`}</span>
        <div className="flex items-center gap-1.5"><button type="button" onClick={saveCurrentSearch} className="inline-flex items-center gap-1 rounded-lg border border-outline bg-white px-2.5 py-1.5 text-xs font-bold hover:border-brand-500 hover:text-brand-700"><BookmarkPlus size={14} />সেভ</button><button type="button" onClick={() => void shareCurrentSearch()} className="inline-flex items-center gap-1 rounded-lg border border-outline bg-white px-2.5 py-1.5 text-xs font-bold hover:border-brand-500 hover:text-brand-700"><Share2 size={14} />শেয়ার</button><button type="button" onClick={() => changeView('grid')} className={`rounded-lg p-1.5 ${viewMode === 'grid' ? 'bg-brand-50 text-brand-700' : 'text-ink-400 hover:bg-bg'}`} aria-label="গ্রিড ভিউ"><Grid2X2 size={16} /></button><button type="button" onClick={() => changeView('list')} className={`rounded-lg p-1.5 ${viewMode === 'list' ? 'bg-brand-50 text-brand-700' : 'text-ink-400 hover:bg-bg'}`} aria-label="লিস্ট ভিউ"><List size={17} /></button></div>
      </div>
      {notice && <p className="mt-2 border border-brand-100 bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700">{notice}</p>}
      {query.trim().length >= 2 && shops.length > 0 && <section aria-label="শপ ফলাফল" className="mt-4 rounded-2xl border border-brand-100 bg-brand-50/55 p-3 sm:p-4"><div className="mb-2 flex items-center justify-between"><p className="text-sm font-extrabold text-brand-800">মিলে যাওয়া শপ</p><span className="text-xs font-semibold text-brand-700">{shops.length.toLocaleString('bn-BD')}টি</span></div><div className="grid gap-2 sm:grid-cols-2">{shops.map((shop) => <Link key={shop.id} to={shopUrl(shop.shop_username, shop.id)} className="flex items-center gap-3 rounded-xl border border-outline bg-surface p-3 transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-sm"><div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-100 font-bold text-brand-700">{shop.photo_url ? <img src={shop.photo_url} alt="" className="h-full w-full object-cover" /> : (shop.shop_name?.trim() || shop.name).charAt(0)}</div><div className="min-w-0 flex-1"><p className="truncate font-bold text-ink-900">{shop.shop_name?.trim() || shop.name}</p><p className="mt-0.5 flex items-center gap-1 text-sm text-ink-500">{shop.is_verified && <BadgeCheck size={14} className="text-brand-600" />}{shop.review_count > 0 ? `★ ${shop.rating.toFixed(1)} · ${shop.review_count} রিভিউ` : 'ডিজিটাল শপ'}</p></div><span className="text-sm font-bold text-brand-700">শপ দেখুন</span></Link>)}</div></section>}

      <div className={`mt-3 grid gap-3 ${viewMode === 'list' ? 'grid-cols-1' : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4'}`}>
        {loading ? Array.from({ length: 12 }).map((_, index) => <div key={index} className="aspect-[3/4] animate-pulse rounded-2xl bg-outline/40" />) : products.map((product) => <ProductCard key={product.id} product={product} compact={viewMode === 'list'} />)}
      </div>
      {!loading && products.length === 0 && <p className="mt-10 text-center text-ink-700">এই ফিল্টারে কোনো ডিজিটাল পণ্য পাওয়া যায়নি।</p>}
    </Layout>
  )
}
