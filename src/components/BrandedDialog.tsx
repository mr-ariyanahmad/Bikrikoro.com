import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'
import type { ReactNode } from 'react'

type DialogTone = 'brand' | 'danger' | 'warning' | 'success'
const toneStyles: Record<DialogTone, { icon: typeof Info; iconClass: string; buttonClass: string }> = {
  brand: { icon: Info, iconClass: 'bg-brand-50 text-brand-700', buttonClass: 'bg-brand-500 hover:bg-brand-600' },
  danger: { icon: AlertTriangle, iconClass: 'bg-red-50 text-red-600', buttonClass: 'bg-red-500 hover:bg-red-600' },
  warning: { icon: AlertTriangle, iconClass: 'bg-amber-50 text-amber-700', buttonClass: 'bg-amber-500 hover:bg-amber-600' },
  success: { icon: CheckCircle2, iconClass: 'bg-emerald-50 text-emerald-700', buttonClass: 'bg-brand-500 hover:bg-brand-600' },
}

export function BrandedDialog({ open, title, children, tone = 'brand', onClose, actions }: { open: boolean; title: string; children: ReactNode; tone?: DialogTone; onClose: () => void; actions?: ReactNode }) {
  if (!open) return null
  const style = toneStyles[tone]
  const Icon = style.icon
  return <div className="fixed inset-0 z-[70] flex items-end justify-center bg-ink-900/55 p-0 backdrop-blur-[2px] sm:items-center sm:p-5" role="dialog" aria-modal="true" aria-label={title}><div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-white/70 bg-surface p-5 shadow-2xl sm:rounded-3xl sm:p-6"><div className="flex items-start gap-3"><span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${style.iconClass}`}><Icon size={20} /></span><div className="min-w-0 flex-1"><h2 className="text-lg font-bold text-ink-900">{title}</h2><div className="mt-2 text-sm leading-6 text-ink-600">{children}</div></div><button type="button" onClick={onClose} className="rounded-xl p-2 text-ink-400 hover:bg-bg hover:text-ink-700" aria-label="বন্ধ করুন"><X size={19} /></button></div>{actions && <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{actions}</div>}</div></div>
}

export function DialogButton({ children, onClick, tone = 'brand', variant = 'solid', disabled = false }: { children: ReactNode; onClick: () => void; tone?: DialogTone; variant?: 'solid' | 'outline'; disabled?: boolean }) {
  const style = toneStyles[tone]
  return <button type="button" onClick={onClick} disabled={disabled} className={variant === 'solid' ? `rounded-xl px-4 py-2.5 text-sm font-bold text-white transition ${style.buttonClass} disabled:opacity-50` : 'rounded-xl border border-outline px-4 py-2.5 text-sm font-semibold text-ink-600 transition hover:border-brand-400 hover:text-brand-700 disabled:opacity-50'}>{children}</button>
}

export function DialogInput({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder?: string }) { return <input autoFocus value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="mt-1 w-full rounded-xl border border-outline bg-surface px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100" /> }
