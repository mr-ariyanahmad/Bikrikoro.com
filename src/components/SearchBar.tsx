import { useEffect, useRef, useState } from 'react'
import { Clock3, Search, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { formatTaka } from '@/lib/format'

interface Suggestion { id: string; title: string; price: number; image: string }
const RECENT_KEY = 'bikrikoro:recent-searches'

export function SearchBar({ compact = false }: { compact?: boolean }) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => { try { setRecentSearches(JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]')) } catch { setRecentSearches([]) } }, [])
  useEffect(() => {
    const term = query.trim()
    if (term.length < 2) { setSuggestions([]); return }
    const timer = setTimeout(async () => {
      const { data } = await supabase.from('products').select('id, title, price, images').ilike('title', `%${term}%`).limit(6)
      setSuggestions((data ?? []).map((p) => ({ id: p.id, title: p.title, price: p.price, image: p.images[0] ?? '' })))
    }, 250)
    return () => clearTimeout(timer)
  }, [query])
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
  const goToResults = (term = query.trim()) => { if (!term) return; remember(term); setOpen(false); navigate(`/products?q=${encodeURIComponent(term)}`) }
  const clearRecent = () => { setRecentSearches([]); localStorage.removeItem(RECENT_KEY) }

  return <div ref={containerRef} className={`relative ${compact ? 'w-full' : 'w-full max-w-md'}`}>
    <div className="relative"><Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-300" /><input type="search" value={query} onChange={(e) => { setQuery(e.target.value); setOpen(true) }} onFocus={() => setOpen(true)} onKeyDown={(e) => e.key === 'Enter' && goToResults()} placeholder="পণ্য খুঁজুন..." className="w-full rounded-full border border-outline bg-bg py-2.5 pl-10 pr-10 text-sm outline-none focus:border-brand-500 focus:bg-surface focus:ring-1 focus:ring-brand-500" />{query && <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-300 hover:text-ink-700" aria-label="সার্চ পরিষ্কার করুন"><X size={15} /></button>}</div>
    {open && (suggestions.length > 0 || (query.trim().length < 2 && recentSearches.length > 0)) && <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-outline bg-surface shadow-xl">
      {query.trim().length < 2 && recentSearches.length > 0 && <div className="p-3"><div className="mb-2 flex items-center justify-between"><p className="text-xs font-semibold text-ink-500">সাম্প্রতিক সার্চ</p><button onClick={clearRecent} className="text-xs text-ink-400 hover:text-error">মুছে দিন</button></div>{recentSearches.map((term) => <button key={term} onClick={() => goToResults(term)} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-ink-700 hover:bg-bg"><Clock3 size={14} className="text-ink-300" />{term}</button>)}</div>}
      {suggestions.map((suggestion) => <button key={suggestion.id} onClick={() => { setOpen(false); setQuery(''); navigate(`/products/${suggestion.id}`) }} className="flex w-full items-center gap-3 border-b border-outline px-3 py-2.5 text-left last:border-0 hover:bg-bg"><div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-outline/30">{suggestion.image && <img src={suggestion.image} alt="" className="h-full w-full object-cover" />}</div><div className="min-w-0 flex-1"><p className="truncate text-sm text-ink-900">{suggestion.title}</p><p className="tabular-amount text-xs text-brand-600">{formatTaka(suggestion.price)}</p></div></button>)}
      {query.trim() && <button onClick={() => goToResults()} className="w-full border-t border-outline px-3 py-2.5 text-center text-sm font-medium text-brand-600 hover:bg-bg">“{query}”-এর সব ফলাফল দেখুন</button>}
    </div>}
  </div>
}
