import { ShieldCheck } from 'lucide-react'

export function BikrifyBadge({ compact = false, className = '' }: { compact?: boolean; className?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full bg-brand-50 font-bold text-brand-700 ring-1 ring-brand-100 ${compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'} ${className}`}
      title="Bikrify verified seller"
      aria-label="Bikrify verified seller"
    >
      <ShieldCheck size={compact ? 12 : 15} strokeWidth={2.5} />
      <span>Bikrify</span>
    </span>
  )
}
