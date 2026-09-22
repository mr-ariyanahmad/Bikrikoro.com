import type { Category } from '@/types/product'

export function CategoryPills({ categories, selectedId, onSelect }: { categories: Category[]; selectedId: string | null; onSelect: (id: string | null) => void }) {
  return <div className="scrollbar-none -mx-4 flex gap-3 overflow-x-auto px-4 pb-1 sm:-mx-5 sm:px-5">
    <button type="button" onClick={() => onSelect(null)} className={`flex w-[4.4rem] shrink-0 flex-col items-center gap-1.5 text-center text-[11px] font-semibold ${selectedId === null ? 'text-brand-700' : 'text-ink-600'}`}>
      <span className={`grid h-12 w-12 place-items-center rounded-2xl border text-xl shadow-sm ${selectedId === null ? 'border-brand-300 bg-brand-100' : 'border-outline bg-surface'}`}>✦</span><span>সব</span>
    </button>
    {categories.map((cat) => <button type="button" key={cat.id} onClick={() => onSelect(cat.id)} className={`flex w-[4.4rem] shrink-0 flex-col items-center gap-1.5 text-center text-[11px] font-semibold ${selectedId === cat.id ? 'text-brand-700' : 'text-ink-600'}`}>
      <span className={`grid h-12 w-12 place-items-center overflow-hidden rounded-2xl border shadow-sm ${selectedId === cat.id ? 'border-brand-300 bg-brand-100' : 'border-outline bg-surface'}`}>{cat.icon_url ? <img src={cat.icon_url} alt="" className="h-7 w-7 object-contain" /> : <span className="text-lg text-brand-500">◆</span>}</span><span className="max-w-full truncate">{cat.name}</span>
    </button>)}
  </div>
}
