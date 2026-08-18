import { useMemo, useState } from 'react'
import { Minus, Plus, Search } from 'lucide-react'

type FAQItem = { id: string; title: string; excerpt: string; body: string }

export function FaqAccordion({ items }: { items: FAQItem[] }) {
  const [query, setQuery] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('bn-BD')
    if (!normalizedQuery) return items
    return items.filter((item) => `${item.title} ${item.excerpt} ${item.body}`.toLocaleLowerCase('bn-BD').includes(normalizedQuery))
  }, [items, query])

  return <div className="space-y-4">
    <label className="relative block">
      <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-brand-600" />
      <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="প্রশ্ন খুঁজুন" aria-label="FAQ প্রশ্ন খুঁজুন" className="w-full border border-outline bg-surface py-3 pl-10 pr-3 text-sm text-ink-900 outline-none focus:border-brand-500" />
    </label>
    <div className="divide-y divide-outline border-y border-outline bg-surface">
      {filteredItems.length === 0 ? <p className="p-5 text-sm text-ink-600">এই শব্দের সঙ্গে মিলে এমন কোনো প্রশ্ন পাওয়া যায়নি।</p> : filteredItems.map((item) => {
        const isOpen = openId === item.id
        const answerId = `faq-answer-${item.id}`
        return <div key={item.id} className="bg-surface">
          <button type="button" aria-expanded={isOpen} aria-controls={answerId} onClick={() => setOpenId(isOpen ? null : item.id)} className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left text-base font-semibold text-ink-900 hover:bg-brand-50 sm:px-5">
            <span>{item.title}</span>
            <span className="flex h-7 w-7 shrink-0 items-center justify-center border border-brand-200 text-brand-700">{isOpen ? <Minus size={16} /> : <Plus size={16} />}</span>
          </button>
          {isOpen && <div id={answerId} role="region" className="border-t border-outline px-4 pb-5 pt-3 text-sm leading-7 text-ink-700 sm:px-5">{item.excerpt && <p className="mb-2 font-medium text-brand-700">{item.excerpt}</p>}<p className="whitespace-pre-line">{item.body}</p></div>}
        </div>
      })}
    </div>
    <p className="text-xs text-ink-500">প্রশ্নের উত্তর না পেলে Help Center বা order detail-এর support option ব্যবহার করুন।</p>
  </div>
}
