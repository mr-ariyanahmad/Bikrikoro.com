import { useEffect, useMemo, useState } from 'react'
import { BookmarkPlus, Grid2X2, List, Share2 } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { supabase, supabaseConfigured } from '@/lib/supabase'
import { Layout } from '@/components/Layout'
import { ProductCard } from '@/components/ProductCard'
import { CategoryPills } from '@/components/CategoryPills'
import { BrandSelect } from '@/components/BrandSelect'
import type { Product, Category } from '@/types/product'
import { PUBLIC_PRODUCT_FIELDS, PUBLIC_PRODUCT_TABLE } from '@/lib/publicProductFields'

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
          setProducts(cached.products)
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
          const nextProducts = [...(data ?? [])]
          setNotice(null)
          if (sort === 'discount') nextProducts.sort((a, b) => ((b.original_price ?? b.price) - b.price) / Math.max(b.original_price ?? b.price, 1) - ((a.original_price ?? a.price) - a.price) / Math.max(a.original_price ?? a.price, 1))
          setProducts(nextProducts)
          productQueryCache.set(cacheKey, { expiresAt: Date.now() + PRODUCT_CACHE_TTL_MS, products: nextProducts })
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
  const handleCategorySelect = (id: string | null) => updateParam('category', id ?? '')

  return (
    <Layout wide>
      <Helmet>
        <title>ডিজিটাল পণ্য ব্রাউজ করুন | BikriKoro.Com</title>
        <meta name="description" content="বাংলাদেশের নিরাপদ digital key, file, access এবং service marketplace।" />
        <link rel="canonical" href="https://bikrikoro.com/products" />
      </Helmet>

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <input type="search" value={query} onChange={(event) => updateParam('q', event.target.value)} aria-label="ডিজিটাল পণ্য খুঁজুন" placeholder="ডিজিটাল পণ্য খুঁজুন..." className="flex-1 border border-outline px-4 py-2.5 text-base outline-none focus:border-brand-500" />
        <button type="button" onClick={() => setShowFilters((current) => !current)} aria-expanded={showFilters} className="border border-outline px-3 py-2.5 text-base font-medium text-ink-700 hover:border-brand-500 hover:text-brand-700 sm:hidden">ফিল্টার {activeFilterCount > 0 ? `(${activeFilterCount})` : ''}</button>
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
        <span>{loading ? 'খোঁজা হচ্ছে...' : `${products.length.toLocaleString('bn-BD')}টি ডিজিটাল পণ্য পাওয়া গেছে`}</span>
        <div className="flex items-center gap-1.5"><button type="button" onClick={saveCurrentSearch} className="inline-flex items-center gap-1 border border-outline px-2.5 py-1.5 text-base font-semibold hover:border-brand-500 hover:text-brand-700"><BookmarkPlus size={14} />সার্চ সেভ</button><button type="button" onClick={() => void shareCurrentSearch()} className="inline-flex items-center gap-1 border border-outline px-2.5 py-1.5 text-base font-semibold hover:border-brand-500 hover:text-brand-700"><Share2 size={14} />শেয়ার</button><button type="button" onClick={() => changeView('grid')} className={`p-1.5 ${viewMode === 'grid' ? 'bg-brand-50 text-brand-700' : 'text-ink-400'}`} aria-label="গ্রিড ভিউ"><Grid2X2 size={16} /></button><button type="button" onClick={() => changeView('list')} className={`p-1.5 ${viewMode === 'list' ? 'bg-brand-50 text-brand-700' : 'text-ink-400'}`} aria-label="লিস্ট ভিউ"><List size={17} /></button></div>
      </div>
      {notice && <p className="mt-2 border border-brand-100 bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700">{notice}</p>}

      <div className={`mt-3 grid gap-3 ${viewMode === 'list' ? 'grid-cols-1' : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4'}`}>
        {loading ? Array.from({ length: 12 }).map((_, index) => <div key={index} className="aspect-[3/4] animate-pulse bg-outline/40" />) : products.map((product) => <ProductCard key={product.id} product={product} compact={viewMode === 'list'} />)}
      </div>
      {!loading && products.length === 0 && <p className="mt-10 text-center text-ink-700">এই ফিল্টারে কোনো ডিজিটাল পণ্য পাওয়া যায়নি।</p>}
    </Layout>
  )
}
