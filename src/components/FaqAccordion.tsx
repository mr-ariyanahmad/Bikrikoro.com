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

  return <div className="space-y-5">
    <label className="relative block">
      <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-brand-600" />
      <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="প্রশ্ন খুঁজুন" aria-label="FAQ প্রশ্ন খুঁজুন" className="w-full rounded-2xl border border-outline bg-white py-3.5 pl-11 pr-4 text-sm text-ink-900 shadow-sm outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10" />
    </label>
    <div className="overflow-hidden rounded-[1.5rem] border border-outline bg-white shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
      {filteredItems.length === 0 ? <p className="p-5 text-sm text-ink-600">এই শব্দের সঙ্গে মিলে এমন কোনো প্রশ্ন পাওয়া যায়নি।</p> : filteredItems.map((item) => {
        const isOpen = openId === item.id
        const answerId = `faq-answer-${item.id}`
        return <div key={item.id} className="bg-white">
          <button type="button" aria-expanded={isOpen} aria-controls={answerId} onClick={() => setOpenId(isOpen ? null : item.id)} className="flex w-full items-center justify-between gap-4 px-5 py-5 text-left text-base font-extrabold leading-6 text-ink-900 transition hover:bg-brand-50 sm:px-6">
            <span>{item.title}</span>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-brand-200 bg-brand-50 text-brand-700">{isOpen ? <Minus size={16} /> : <Plus size={16} />}</span>
          </button>
          {isOpen && <div id={answerId} role="region" className="border-t border-outline bg-[#fbfefc] px-5 pb-6 pt-4 text-sm leading-8 text-ink-700 sm:px-6">{item.excerpt && <p className="mb-2 font-medium text-brand-700">{item.excerpt}</p>}<p className="whitespace-pre-line">{item.body}</p></div>}
        </div>
      })}
    </div>
    <p className="rounded-xl border border-brand-100 bg-brand-50 px-4 py-3 text-xs leading-5 text-ink-600">প্রশ্নের উত্তর না পেলে সহায়তা কেন্দ্র বা অর্ডারের বিস্তারিত পৃষ্ঠার সহায়তা অপশন ব্যবহার করুন।</p>
  </div>
}
