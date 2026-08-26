import { Clock3, PackageCheck, Zap } from 'lucide-react'
import type { Product } from '@/types/product'

export function ProductDeliveryBadge({ product, compact = false }: { product: Pick<Product, 'is_digital' | 'auto_delivery_enabled'>; compact?: boolean }) {
  if (!product.is_digital) return null
  const automatic = product.auto_delivery_enabled === true
  const Icon = automatic ? Zap : Clock3
  return <span className={`inline-flex items-center gap-1.5 font-semibold ${compact ? 'rounded-md bg-ink-900/80 px-1.5 py-1 text-[10px] text-white' : automatic ? 'rounded-full bg-brand-500 px-2.5 py-1 text-xs text-white' : 'rounded-full bg-amber-100 px-2.5 py-1 text-xs text-amber-900'}`}><Icon size={compact ? 11 : 14} />{automatic ? 'অটো ডেলিভারি' : 'ম্যানুয়াল ডেলিভারি'}</span>
}

export function ProductDeliveryTypeBadge({ product }: { product: Pick<Product, 'is_digital'> }) {
  if (!product.is_digital) return null
  return <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700"><PackageCheck size={14} />ডিজিটাল পণ্য</span>
}
