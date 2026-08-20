import type { PaymentMethodConfig } from '@/lib/publicSettings'

export function PaymentMethodBadges({ methods, compact = false }: { methods: PaymentMethodConfig[]; compact?: boolean }) {
  return <div className={`grid gap-2 ${compact ? 'grid-cols-3 sm:grid-cols-5' : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-9'}`}>
    {methods.map((method) => <div key={method.name} className={`flex items-center gap-2 border border-outline bg-surface ${compact ? 'min-h-12 px-2 py-2' : 'min-h-14 px-3 py-2.5'}`} style={{ borderColor: `${method.color}55` }} title={`${method.name} — তথ্য প্রদর্শন মাত্র`}>
      <span className={`flex shrink-0 items-center justify-center overflow-hidden border border-outline bg-white ${compact ? 'h-7 w-9 p-0.5' : 'h-9 w-12 p-1'}`}>
        {method.logo ? <img src={method.logo} alt={`${method.name} logo`} className="max-h-full max-w-full object-contain" loading="lazy" /> : <span className="text-center text-[9px] font-bold" style={{ color: method.color }}>{method.short}</span>}
      </span>
      <span className={`truncate font-semibold text-ink-700 ${compact ? 'text-xs' : 'text-sm'}`}>{method.name}</span>
    </div>)}
  </div>
}
