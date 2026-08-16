import type { Category } from '@/types/product'

export function CategoryPills({
  categories,
  selectedId,
  onSelect,
}: {
  categories: Category[]
  selectedId: string | null
  onSelect: (id: string | null) => void
}) {
  return (
    <div className="scrollbar-none -mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
      <button
        onClick={() => onSelect(null)}
        className={`shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition ${
          selectedId === null
            ? 'border-brand-500 bg-brand-500 text-white'
            : 'border-outline text-ink-600 hover:border-brand-500/40'
        }`}
      >
        সব
      </button>
      {categories.map((cat) => (
        <button
          key={cat.id}
          onClick={() => onSelect(cat.id)}
          className={`shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition ${
            selectedId === cat.id
              ? 'border-brand-500 bg-brand-500 text-white'
              : 'border-outline text-ink-600 hover:border-brand-500/40'
          }`}
        >
          {cat.name}
        </button>
      ))}
    </div>
  )
}
