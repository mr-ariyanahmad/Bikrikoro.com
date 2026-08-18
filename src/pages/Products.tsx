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

type SortOption = 'newest' | 'oldest' | 'price_asc' | 'price_desc' | 'popular' | 'discount'
type ConditionFilter = 'all' | 'NEW' | 'USED'
type DigitalFilter = 'all' | 'digital' | 'physical'

export default function Products() {
  const [searchParams, setSearchParams] = useSearchParams()
  const categoryId = searchParams.get('category')
  const query = searchParams.get('q') ?? ''
  const sort = (searchParams.get('sort') as SortOption) || 'newest'
  const condition = (searchParams.get('condition') as ConditionFilter) || 'all'
  const digital = (searchParams.get('digital') as DigitalFilter) || 'all'
  const location = searchParams.get('location') ?? ''
  const delivery = searchParams.get('delivery') ?? ''
  const minPrice = searchParams.get('min') ?? ''
  const maxPrice = searchParams.get('max') ?? ''

  const [categories, setCategories] = useState<Category[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [showFilters, setShowFilters] = useState(false)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => (localStorage.getItem('bikrikoro:products-view') as 'grid' | 'list') || 'grid')
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    if (!supabaseConfigured) return
    supabase
      .from('categories')
      .select('*')
      .order('sort_order')
      .then(({ data }) => setCategories(data ?? []))
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    async function load() {
      if (!supabaseConfigured) {
        setProducts([])
        setNotice('লাইভ পণ্য data দেখতে Supabase configuration প্রয়োজন।')
        setLoading(false)
        return
      }
      try {
        let request = supabase.from('products').select('*')
      if (categoryId) request = request.eq('category_id', categoryId)
      if (query.trim()) request = request.ilike('title', `%${query.trim()}%`)
      if (condition !== 'all') request = request.eq('condition', condition)
      if (digital === 'digital') request = request.eq('is_digital', true)
      if (digital === 'physical') request = request.eq('is_digital', false)
      if (location.trim()) request = request.ilike('location', `%${location.trim()}%`)
      if (delivery === 'free') request = request.eq('free_delivery', true)
      if (minPrice && Number(minPrice) >= 0) request = request.gte('price', Number(minPrice))
      if (maxPrice && Number(maxPrice) > 0) request = request.lte('price', Number(maxPrice))

      if (sort === 'price_asc') request = request.order('price', { ascending: true })
      else if (sort === 'price_desc') request = request.order('price', { ascending: false })
      else if (sort === 'oldest') request = request.order('created_at', { ascending: true })
      else if (sort === 'popular') request = request.order('view_count', { ascending: false })
      else request = request.order('created_at', { ascending: false })

        const { data } = await request.limit(60)
        if (!cancelled) {
          const nextProducts = [...(data ?? [])]
          if (sort === 'discount') nextProducts.sort((a, b) => ((b.original_price ?? b.price) - b.price) / Math.max(b.original_price ?? b.price, 1) - ((a.original_price ?? a.price) - a.price) / Math.max(a.original_price ?? a.price, 1))
          setProducts(nextProducts)
        }
      } catch (error) {
        console.error('Products load failed:', error)
        if (!cancelled) {
          setProducts([])
          setNotice('পণ্যগুলো এখন লোড করা যাচ্ছে না। কিছুক্ষণ পরে আবার চেষ্টা করুন।')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [categoryId, query, sort, condition, digital, location, delivery, minPrice, maxPrice])

  const activeFilterCount = useMemo(
    () => [condition !== 'all', digital !== 'all', Boolean(location), delivery === 'free', Boolean(minPrice), Boolean(maxPrice)].filter(Boolean).length,
    [condition, digital, location, delivery, minPrice, maxPrice]
  )

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value)
    else next.delete(key)
    setSearchParams(next)
  }

  const clearFilters = () => {
    const next = new URLSearchParams(searchParams)
    ;['condition', 'digital', 'location', 'delivery', 'min', 'max', 'sort'].forEach((key) => next.delete(key))
    setSearchParams(next)
  }

  const handleCategorySelect = (id: string | null) => updateParam('category', id ?? '')
  const saveCurrentSearch = () => {
    const url = `${window.location.pathname}${window.location.search}`
    const label = query.trim() || (categoryId ? 'ক্যাটাগরি ফলাফল' : 'সব পণ্য')
    const saved = JSON.parse(localStorage.getItem('bikrikoro:saved-searches') ?? '[]') as Array<{ label: string; url: string }>
    localStorage.setItem('bikrikoro:saved-searches', JSON.stringify([{ label, url }, ...saved.filter((item) => item.url !== url)].slice(0, 8)))
    setNotice('সার্চটি সেভ হয়েছে।')
  }
  const shareCurrentSearch = async () => {
    try { await navigator.clipboard.writeText(window.location.href); setNotice('এই filter link কপি হয়েছে।') } catch { setNotice('Filter link কপি করা যায়নি।') }
  }
  const changeView = (next: 'grid' | 'list') => { setViewMode(next); localStorage.setItem('bikrikoro:products-view', next) }

  return (
    <Layout wide>
      <Helmet>
        <title>সব পণ্য ব্রাউজ করুন | BikriKoro.Com</title>
        <meta name="description" content="বাংলাদেশজুড়ে হাজারো পণ্য — ডিজিটাল প্রোডাক্ট, ইলেকট্রনিক্স, ফ্যাশন ও আরও অনেক কিছু।" />
        <link rel="canonical" href="https://bikrikoro.com/products" />
      </Helmet>

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          type="search"
          value={query}
          onChange={(e) => updateParam('q', e.target.value)}
          placeholder="পণ্য খুঁজুন..."
          className="flex-1 rounded-lg border border-outline px-4 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
        />
        <button
          onClick={() => setShowFilters((current) => !current)}
          className="rounded-lg border border-outline px-3 py-2.5 text-sm font-medium text-ink-600 hover:border-brand-500 hover:text-brand-600 sm:hidden"
        >
          ফিল্টার {activeFilterCount > 0 ? `(${activeFilterCount})` : ''}
        </button>
        <div className="min-w-44"><BrandSelect label="সাজান" value={sort} options={[{ value: 'newest', label: 'নতুন আগে' }, { value: 'oldest', label: 'পুরোনো আগে' }, { value: 'popular', label: 'জনপ্রিয় আগে' }, { value: 'discount', label: 'বেশি ছাড় আগে' }, { value: 'price_asc', label: 'দাম: কম থেকে বেশি' }, { value: 'price_desc', label: 'দাম: বেশি থেকে কম' }]} onChange={(value) => updateParam('sort', value)} /></div>
      </div>

      <div className={`${showFilters ? 'block' : 'hidden'} mb-5 rounded-2xl border border-outline bg-surface p-4 sm:block`}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className="text-sm text-ink-600">
            <span className="mb-1 block font-medium text-ink-900">ন্যূনতম দাম</span>
            <input
              type="number"
              min="0"
              value={minPrice}
              onChange={(e) => updateParam('min', e.target.value)}
              placeholder="৳ ০"
              className="w-full rounded-lg border border-outline px-3 py-2 outline-none focus:border-brand-500"
            />
          </label>
          <label className="text-sm text-ink-600">
            <span className="mb-1 block font-medium text-ink-900">সর্বোচ্চ দাম</span>
            <input
              type="number"
              min="0"
              value={maxPrice}
              onChange={(e) => updateParam('max', e.target.value)}
              placeholder="৳ সীমা নেই"
              className="w-full rounded-lg border border-outline px-3 py-2 outline-none focus:border-brand-500"
            />
          </label>
          <BrandSelect label="অবস্থা" value={condition} options={[{ value: 'all', label: 'সব ধরনের' }, { value: 'NEW', label: 'নতুন' }, { value: 'USED', label: 'ব্যবহৃত' }]} onChange={(value) => updateParam('condition', value)} />
          <BrandSelect label="পণ্যের ধরন" value={digital} options={[{ value: 'all', label: 'সব পণ্য' }, { value: 'digital', label: 'ডিজিটাল' }, { value: 'physical', label: 'ফিজিক্যাল' }]} onChange={(value) => updateParam('digital', value)} />
          <label className="text-sm text-ink-600">
            <span className="mb-1 block font-medium text-ink-900">লোকেশন</span>
            <input
              value={location}
              onChange={(e) => updateParam('location', e.target.value)}
              placeholder="শহর বা এলাকা"
              className="w-full rounded-lg border border-outline px-3 py-2 outline-none focus:border-brand-500"
            />
          </label>
        </div>
        {activeFilterCount > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-3"><button onClick={clearFilters} className="text-sm font-semibold text-error hover:underline">সব ফিল্টার পরিষ্কার করুন</button>{delivery === 'free' && <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700">ফ্রি ডেলিভারি</span>}</div>
        )}
      </div>

      <CategoryPills categories={categories} selectedId={categoryId} onSelect={handleCategorySelect} />

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm text-ink-600">
        <span>{loading ? 'খোঁজা হচ্ছে...' : `${products.length.toLocaleString('bn-BD')}টি পণ্য পাওয়া গেছে`}</span>
        <div className="flex items-center gap-1.5"><button onClick={saveCurrentSearch} className="inline-flex items-center gap-1 rounded-lg border border-outline px-2.5 py-1.5 text-xs font-semibold hover:border-brand-500 hover:text-brand-600"><BookmarkPlus size={14} />সার্চ সেভ</button><button onClick={shareCurrentSearch} className="inline-flex items-center gap-1 rounded-lg border border-outline px-2.5 py-1.5 text-xs font-semibold hover:border-brand-500 hover:text-brand-600"><Share2 size={14} />শেয়ার</button><button onClick={() => changeView('grid')} className={`rounded-lg p-1.5 ${viewMode === 'grid' ? 'bg-brand-50 text-brand-700' : 'text-ink-400'}`} aria-label="গ্রিড ভিউ"><Grid2X2 size={16} /></button><button onClick={() => changeView('list')} className={`rounded-lg p-1.5 ${viewMode === 'list' ? 'bg-brand-50 text-brand-700' : 'text-ink-400'}`} aria-label="লিস্ট ভিউ"><List size={17} /></button></div>
      </div>
      {notice && <p className="mt-2 rounded-lg bg-brand-50 px-3 py-2 text-xs font-medium text-brand-700">{notice}</p>}

      <div className={`mt-3 grid gap-3 ${viewMode === 'list' ? 'grid-cols-1' : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4'}`}>
        {loading
          ? Array.from({ length: 12 }).map((_, i) => <div key={i} className="aspect-[3/4] animate-pulse rounded-xl bg-outline/40" />)
          : products.map((product) => <ProductCard key={product.id} product={product} compact={viewMode === 'list'} />)}
      </div>

      {!loading && products.length === 0 && <p className="mt-10 text-center text-ink-600">এই ফিল্টারে কোনো পণ্য পাওয়া যায়নি।</p>}
    </Layout>
  )
}
