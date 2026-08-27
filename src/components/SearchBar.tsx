import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, BadgeCheck, Clock3, Flame, Search, Sparkles, Store, Tag, X } from 'lucide-react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { PUBLIC_PRODUCT_FIELDS, PUBLIC_PRODUCT_TABLE } from '@/lib/publicProductFields'
import { formatTaka } from '@/lib/format'
import { getTrendingSearches, loadPublicSettings } from '@/lib/publicSettings'
import { getRecentlyViewedIds } from '@/lib/recentlyViewed'
import { rankSearchProductsByInterest, trackCategoryInterest } from '@/lib/recommendationPreferences'
import { searchPublicShops, type SearchShop } from '@/lib/shopSearch'
import { shopUrl } from '@/lib/shopProfile'
import type { Category, Product } from '@/types/product'

interface Suggestion {
  id: string
  title: string
  price: number
  image: string
  categoryId: string
  categoryLabel: string
}

const RECENT_KEY = 'bikrikoro:recent-searches'

export function SearchBar({ compact = false }: { compact?: boolean }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [shops, setShops] = useState<SearchShop[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [trendingSearches, setTrendingSearches] = useState<string[]>([])
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const isFullSearchPage = location.pathname === '/search'

  useEffect(() => {
    if (isFullSearchPage) setQuery(searchParams.get('q') ?? '')
  }, [isFullSearchPage, searchParams])

  useEffect(() => {
    try { setRecentSearches(JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]')) } catch { setRecentSearches([]) }
    void loadPublicSettings().then((settings) => setTrendingSearches(getTrendingSearches(settings)))
  }, [])

  useEffect(() => {
    let cancelled = false
    async function loadCategories() {
      const [{ data: templates }, { data: legacyCategories }] = await Promise.all([
        supabase.from('digital_category_templates').select('category_id, sort_order').eq('is_active', true).order('sort_order').limit(24),
        supabase.from('categories').select('id, name, icon_url, sort_order').order('sort_order').limit(24),
      ])
      if (cancelled) return
      const categoryRows = (legacyCategories ?? []) as Category[]
      if (!templates || templates.length === 0) {
        setCategories(categoryRows)
        return
      }
      const categoryMap = new Map(categoryRows.map((category) => [category.id, category]))
      setCategories(templates.map((template) => categoryMap.get(template.category_id)).filter((category): category is Category => Boolean(category)))
    }
    void loadCategories()
    return () => { cancelled = true }
  }, [])

  const categoryNames = useMemo(() => new Map(categories.map((category) => [category.id, category.name])), [categories])
  const groupedSuggestions = useMemo(() => suggestions.reduce<Record<string, Suggestion[]>>((groups, suggestion) => {
    const key = suggestion.categoryLabel || 'অন্যান্য ডিজিটাল পণ্য'
    groups[key] = [...(groups[key] ?? []), suggestion]
    return groups
  }, {}), [suggestions])

  useEffect(() => {
    const term = query.trim()
    if (term.length < 2) {
      setSuggestions([])
      setShops([])
      setLoading(false)
      return
    }
    let cancelled = false
    const timer = window.setTimeout(async () => {
      setLoading(true)
      const [{ data, error }, foundShops] = await Promise.all([
        supabase
        .from(PUBLIC_PRODUCT_TABLE)
        .select(PUBLIC_PRODUCT_FIELDS)
        .eq('is_digital', true)
        .ilike('title', `%${term}%`)
        .order('popularity_score', { ascending: false })
        .order('view_count', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(24),
        searchPublicShops(term),
      ])
      if (!cancelled) {
        if (error) console.warn('Search suggestions failed:', error)
        setSuggestions(rankSearchProductsByInterest((data ?? []) as Product[], getRecentlyViewedIds()).slice(0, 8).map((product) => ({
          id: product.id,
          title: product.title,
          price: product.price,
          image: product.images?.[0] ?? '',
          categoryId: product.category_id,
          categoryLabel: categoryNames.get(product.category_id) ?? 'ডিজিটাল পণ্য',
        })))
        setShops(foundShops)
        setLoading(false)
      }
    }, 250)
    return () => { window.clearTimeout(timer); cancelled = true }
  }, [categoryNames, query])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => { if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const remember = (term: string) => {
    const next = [term, ...recentSearches.filter((item) => item !== term)].slice(0, 5)
    setRecentSearches(next)
    localStorage.setItem(RECENT_KEY, JSON.stringify(next))
  }
  const goToResults = (term = query.trim(), categoryId?: string) => {
    if (!term && !categoryId) return
    if (term) remember(term)
    setOpen(false)
    const params = new URLSearchParams()
    if (term) params.set('q', term)
    if (categoryId) params.set('category', categoryId)
    navigate(`/products?${params.toString()}`)
  }
  const goToProduct = (suggestion: Suggestion) => {
    trackCategoryInterest(suggestion.categoryId, 'click')
    setOpen(false)
    setQuery('')
    navigate(`/products/${suggestion.id}`)
  }
  const goToShop = (shop: SearchShop) => {
    setOpen(false)
    setQuery('')
    navigate(shopUrl(shop.shop_username, shop.id))
  }
  const clearRecent = () => { setRecentSearches([]); localStorage.removeItem(RECENT_KEY) }
  const showDiscovery = query.trim().length < 2
  const hasPanelContent = showDiscovery || loading || suggestions.length > 0 || shops.length > 0 || Boolean(query.trim())

  return <div ref={containerRef} className={`relative ${compact ? 'w-full' : 'w-full max-w-md'}`}>
    <div className="relative">
      <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
      <input
        type="search"
        value={query}
        onChange={(event) => { const nextQuery = event.target.value; setQuery(nextQuery); if (isFullSearchPage) { const params = new URLSearchParams(searchParams); if (nextQuery.trim()) params.set('q', nextQuery); else params.delete('q'); setSearchParams(params, { replace: true }) } else setOpen(true) }}
        onFocus={() => { if (compact && !isFullSearchPage) { navigate('/search'); return } setOpen(true) }}
        onKeyDown={(event) => event.key === 'Enter' && goToResults()}
        placeholder="ডিজিটাল পণ্য, গেম, সাবস্ক্রিপশন খুঁজুন..."
        className={`w-full border bg-bg py-3 pl-11 pr-10 text-base text-ink-900 outline-none transition focus:border-brand-500 focus:bg-surface focus:ring-2 focus:ring-brand-500/10 ${compact ? 'rounded-2xl border-brand-200 shadow-[0_4px_14px_rgba(1,124,80,0.08)]' : 'border-outline'}`}
        aria-label="ডিজিটাল পণ্য খুঁজুন"
      />
      {query && <button type="button" onClick={() => { setQuery(''); setOpen(true) }} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-900" aria-label="সার্চ পরিষ্কার করুন"><X size={16} /></button>}
    </div>

    {!isFullSearchPage && open && hasPanelContent && <div className={`absolute left-0 right-0 top-full z-50 mt-2 max-h-[min(34rem,calc(100vh-8rem))] overflow-y-auto border border-outline bg-surface shadow-2xl ${compact ? 'rounded-2xl border-brand-100' : ''}`}>
      {showDiscovery && <>
        {recentSearches.length > 0 && <section className="border-b border-outline p-3.5">
          <div className="mb-2 flex items-center justify-between"><p className="flex items-center gap-2 text-sm font-semibold text-ink-900"><Clock3 size={15} className="text-ink-400" />সাম্প্রতিক সার্চ</p><button type="button" onClick={clearRecent} className="text-sm text-ink-400 hover:text-error">মুছে দিন</button></div>
          <div className="flex flex-wrap gap-2">{recentSearches.map((term) => <button type="button" key={term} onClick={() => goToResults(term)} className="border border-outline px-2.5 py-1.5 text-sm text-ink-700 hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700">{term}</button>)}</div>
        </section>}
        {trendingSearches.length > 0 && <section className="border-b border-outline p-3.5">
          <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink-900"><Flame size={15} className="text-brand-600" />জনপ্রিয় সার্চ</p>
          <div className="flex flex-wrap gap-2">{trendingSearches.map((term) => <button type="button" key={term} onClick={() => goToResults(term)} className="border border-brand-100 bg-brand-50 px-2.5 py-1.5 text-sm text-brand-700 hover:border-brand-400">{term}</button>)}</div>
        </section>}
        {categories.length > 0 && <section className="p-3.5">
          <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink-900"><Tag size={15} className="text-brand-600" />ক্যাটাগরি দিয়ে ব্রাউজ করুন</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{categories.slice(0, 9).map((category) => <button type="button" key={category.id} onClick={() => goToResults('', category.id)} className="flex items-center justify-between border border-outline px-2.5 py-2 text-left text-sm text-ink-700 hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700"><span className="truncate">{category.name}</span><ArrowRight size={14} className="shrink-0 text-ink-300" /></button>)}</div>
        </section>}
      </>}

      {!showDiscovery && loading && <div className="flex items-center gap-2 px-4 py-5 text-sm text-ink-500"><Sparkles size={16} className="animate-pulse text-brand-600" />ডিজিটাল পণ্য খোঁজা হচ্ছে...</div>}
      {!showDiscovery && !loading && shops.length > 0 && <section className="border-b border-outline p-3"><div className="mb-2 flex items-center justify-between"><p className="flex items-center gap-2 text-sm font-bold text-ink-900"><Store size={16} className="text-brand-600" />মিলেছে শপ</p><span className="text-xs text-ink-400">{shops.length}টি</span></div><div className={compact ? 'grid grid-cols-2 gap-2.5' : 'space-y-2'}>{shops.map((shop) => <button type="button" key={shop.id} onClick={() => goToShop(shop)} className={`flex items-center gap-2.5 border border-outline bg-bg text-left transition hover:border-brand-300 hover:bg-brand-50 active:scale-[0.98] ${compact ? 'rounded-xl p-2.5' : 'w-full px-3 py-2.5'}`}><div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-100 font-bold text-brand-700">{shop.photo_url ? <img src={shop.photo_url} alt="" className="h-full w-full object-cover" /> : (shop.shop_name?.trim() || shop.name).charAt(0)}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-ink-900">{shop.shop_name?.trim() || shop.name}</p><p className="mt-0.5 flex items-center gap-1 text-xs text-ink-500">{shop.is_verified && <BadgeCheck size={13} className="text-brand-600" />}শপ দেখুন</p></div><ArrowRight size={15} className="shrink-0 text-ink-300" /></button>)}</div></section>}
      {!showDiscovery && !loading && suggestions.length === 0 && shops.length === 0 && <div className="px-4 py-5 text-center"><p className="text-sm font-semibold text-ink-900">কোনো পণ্য বা শপ পাওয়া যায়নি</p><p className="mt-1 text-sm text-ink-500">অন্য শব্দ দিয়ে চেষ্টা করুন অথবা সব ফলাফল দেখুন।</p></div>}
      {!showDiscovery && suggestions.length > 0 && (compact ? <section className="p-3"><div className="mb-3 flex items-center justify-between"><p className="text-base font-bold text-ink-900">সার্চ সাজেশন</p><span className="text-xs text-ink-400">জনপ্রিয় ও পছন্দ অনুযায়ী</span></div><div className="grid grid-cols-2 gap-2.5">{suggestions.map((suggestion) => <button type="button" key={suggestion.id} onClick={() => goToProduct(suggestion)} className="overflow-hidden rounded-xl border border-outline bg-bg text-left shadow-sm transition active:scale-[0.98]"><div className="aspect-square bg-surface">{suggestion.image && <img src={suggestion.image} alt="" className="h-full w-full object-cover" />}</div><div className="p-2"><p className="line-clamp-2 min-h-9 text-xs font-semibold leading-4 text-ink-900">{suggestion.title}</p><p className="mt-1 tabular-amount text-sm font-bold text-brand-700">{formatTaka(suggestion.price)}</p></div></button>)}</div></section> : <div>{Object.entries(groupedSuggestions).map(([categoryLabel, items]) => <section key={categoryLabel} className="border-b border-outline last:border-0"><div className="flex items-center justify-between bg-bg px-3.5 py-2"><p className="text-sm font-semibold text-ink-900">{categoryLabel}</p><span className="text-xs text-ink-400">{items.length}টি ফলাফল</span></div>{items.map((suggestion) => <button type="button" key={suggestion.id} onClick={() => goToProduct(suggestion)} className="flex w-full items-center gap-3 border-t border-outline/70 px-3.5 py-2.5 text-left hover:bg-brand-50/60"><div className="h-11 w-11 shrink-0 overflow-hidden border border-outline bg-bg">{suggestion.image && <img src={suggestion.image} alt="" className="h-full w-full object-cover" />}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-ink-900">{suggestion.title}</p><p className="mt-0.5 text-xs text-ink-500">ডিজিটাল পণ্য <span className="mx-1 text-ink-300">•</span><span className="tabular-amount font-semibold text-brand-700">{formatTaka(suggestion.price)}</span></p></div><ArrowRight size={15} className="shrink-0 text-ink-300" /></button>)}</section>)}</div>)}
      {query.trim() && <button type="button" onClick={() => goToResults()} className="flex w-full items-center justify-between border-t border-outline bg-brand-50 px-3.5 py-3 text-left text-base font-semibold text-brand-700 hover:bg-brand-100"><span>“{query.trim()}”-এর সব ফলাফল দেখুন</span><ArrowRight size={17} /></button>}
    </div>}
  </div>
}
