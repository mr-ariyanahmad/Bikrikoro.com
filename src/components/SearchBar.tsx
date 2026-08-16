import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { formatTaka } from '@/lib/format'

interface Suggestion {
  id: string
  title: string
  price: number
  image: string
}

export function SearchBar({ compact = false }: { compact?: boolean }) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const term = query.trim()
    if (term.length < 2) {
      setSuggestions([])
      return
    }

    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from('products')
        .select('id, title, price, images')
        .ilike('title', `%${term}%`)
        .limit(6)
      setSuggestions((data ?? []).map((p) => ({ id: p.id, title: p.title, price: p.price, image: p.images[0] ?? '' })))
    }, 250) // debounce — avoid a query on every keystroke

    return () => clearTimeout(timer)
  }, [query])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const goToResults = () => {
    if (!query.trim()) return
    setOpen(false)
    navigate(`/products?q=${encodeURIComponent(query.trim())}`)
  }

  return (
    <div ref={containerRef} className={`relative ${compact ? 'w-full' : 'w-full max-w-md'}`}>
      <input
        type="search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => e.key === 'Enter' && goToResults()}
        placeholder="পণ্য খুঁজুন..."
        className="w-full rounded-full border border-outline bg-bg px-4 py-2 text-sm outline-none focus:border-brand-500 focus:bg-surface focus:ring-1 focus:ring-brand-500"
      />

      {open && suggestions.length > 0 && (
        <div className="absolute top-full right-0 left-0 z-50 mt-2 max-h-80 overflow-y-auto rounded-xl border border-outline bg-surface shadow-lg">
          {suggestions.map((s) => (
            <button
              key={s.id}
              onClick={() => {
                setOpen(false)
                setQuery('')
                navigate(`/products/${s.id}`)
              }}
              className="flex w-full items-center gap-3 border-b border-outline px-3 py-2 text-left last:border-0 hover:bg-bg"
            >
              <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-outline/30">
                {s.image && <img src={s.image} alt="" className="h-full w-full object-cover" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-ink-900">{s.title}</p>
                <p className="tabular-amount text-xs text-brand-600">{formatTaka(s.price)}</p>
              </div>
            </button>
          ))}
          <button
            onClick={goToResults}
            className="w-full px-3 py-2.5 text-center text-sm font-medium text-brand-600 hover:bg-bg"
          >
            "{query}"-এর সব ফলাফল দেখুন →
          </button>
        </div>
      )}
    </div>
  )
}
