import { AppWindow, Camera, Clapperboard, Code2, Gamepad2, Globe2, GraduationCap, Headphones, LayoutGrid, MonitorCog, Palette, ShieldCheck, Smartphone, Sparkles, Store, type LucideIcon } from 'lucide-react'
import type { Category } from '@/types/product'

const categoryIcons: Array<{ match: string[]; icon: LucideIcon }> = [
  { match: ['গেম', 'game', 'free fire', 'ludo', 'pubg', 'gaming'], icon: Gamepad2 },
  { match: ['সফটওয়্যার', 'software', 'script', 'website', 'ওয়েব', 'web', 'code'], icon: Code2 },
  { match: ['সাবস্ক্রিপশন', 'subscription', 'netflix', 'premium', 'ai'], icon: Sparkles },
  { match: ['কোর্স', 'course', 'শিক্ষা', 'education', 'ebook', 'book'], icon: GraduationCap },
  { match: ['মোবাইল', 'mobile', 'অ্যাপ', 'app', 'android', 'ios'], icon: Smartphone },
  { match: ['ডিজাইন', 'design', 'গ্রাফিক', 'graphic', 'template'], icon: Palette },
  { match: ['ভিডিও', 'video', 'মুভি', 'movie', 'স্ট্রিম', 'stream'], icon: Clapperboard },
  { match: ['মিউজিক', 'music', 'অডিও', 'audio'], icon: Headphones },
  { match: ['ছবি', 'photo', 'camera'], icon: Camera },
  { match: ['সিকিউরিটি', 'security', 'vpn', 'নিরাপত্তা'], icon: ShieldCheck },
  { match: ['অফিস', 'office', 'productivity'], icon: MonitorCog },
  { match: ['শপ', 'shop', 'সেবা', 'service'], icon: Store },
  { match: ['ডিজিটাল', 'digital', 'অনলাইন', 'online'], icon: Globe2 },
]

const tileColors = [
  'border-brand-200 bg-brand-50 text-brand-700',
  'border-accent-200 bg-accent-50 text-accent-600',
  'border-orange-200 bg-orange-50 text-orange-600',
  'border-sky-200 bg-sky-50 text-sky-600',
  'border-violet-200 bg-violet-50 text-violet-600',
]

function getCategoryIcon(category: Category) {
  const normalizedName = category.name.toLowerCase()
  return categoryIcons.find(({ match }) => match.some((term) => normalizedName.includes(term)))?.icon ?? AppWindow
}

export function CategoryPills({ categories, selectedId, onSelect }: { categories: Category[]; selectedId: string | null; onSelect: (id: string | null) => void }) {
  return <div className="scrollbar-none -mx-4 flex gap-3 overflow-x-auto px-4 pb-1 sm:-mx-5 sm:px-5">
    <button type="button" onClick={() => onSelect(null)} aria-pressed={selectedId === null} className={`flex w-[4.4rem] shrink-0 flex-col items-center gap-1.5 text-center text-[11px] font-bold transition ${selectedId === null ? 'text-brand-700' : 'text-ink-600'}`}>
      <span className={`grid h-12 w-12 place-items-center rounded-2xl border shadow-sm transition ${selectedId === null ? 'border-brand-400 bg-brand-500 text-white shadow-brand-200' : 'border-outline bg-surface text-brand-600'}`}><LayoutGrid size={21} strokeWidth={2.4} /></span><span>সব</span>
    </button>
    {categories.map((cat, index) => {
      const Icon = getCategoryIcon(cat)
      const isSelected = selectedId === cat.id
      const color = tileColors[index % tileColors.length]
      return <button type="button" key={cat.id} onClick={() => onSelect(cat.id)} aria-pressed={isSelected} aria-label={`${cat.name} ক্যাটাগরি`} className={`flex w-[4.4rem] shrink-0 flex-col items-center gap-1.5 text-center text-[11px] font-bold transition ${isSelected ? 'text-brand-700' : 'text-ink-600'}`}>
        <span className={`grid h-12 w-12 place-items-center overflow-hidden rounded-2xl border shadow-sm transition ${isSelected ? 'border-brand-400 bg-brand-500 text-white shadow-brand-200' : color}`}>{cat.icon_url ? <img src={cat.icon_url} alt="" className="h-7 w-7 object-contain" /> : <Icon size={21} strokeWidth={2.25} />}</span><span className="max-w-full truncate">{cat.name}</span>
      </button>
    })}
  </div>
}
