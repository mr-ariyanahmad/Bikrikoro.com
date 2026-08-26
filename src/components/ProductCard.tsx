import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { RotateCcw, ShieldCheck, Truck, Zap } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { isFavorited, addFavorite, removeFavorite } from '@/lib/favorites'
import type { Product } from '@/types/product'
import { formatTaka } from '@/lib/format'
import { isCompared, toggleCompared } from '@/lib/compare'
import { BrandedDialog, DialogButton } from '@/components/BrandedDialog'
import { ProductDeliveryBadge } from '@/components/ProductDeliveryBadge'

export function ProductCard({ product, compact = false }: { product: Product; compact?: boolean }) {
  const { user } = useAuth()
  const [favorited, setFavorited] = useState(false)
  const [toggling, setToggling] = useState(false)
  const [compared, setCompared] = useState(() => isCompared(product.id))
  const [compareLimitOpen, setCompareLimitOpen] = useState(false)

  const discount = product.original_price && product.original_price > product.price
    ? Math.round(100 - (product.price / product.original_price) * 100)
    : null

  useEffect(() => {
    if (!user) return
    let cancelled = false
    isFavorited(user.uid, product.id).then((value) => {
      if (!cancelled) setFavorited(value)
    })
    return () => { cancelled = true }
  }, [user, product.id])

  useEffect(() => {
    const sync = () => setCompared(isCompared(product.id))
    window.addEventListener('bikrikoro:compare-changed', sync)
    return () => window.removeEventListener('bikrikoro:compare-changed', sync)
  }, [product.id])

  const handleToggleCompare = (event: React.MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    const result = toggleCompared(product.id)
    if (result.limitReached) {
      setCompareLimitOpen(true)
      return
    }
    setCompared(result.selected)
  }

  const handleToggleFavorite = async (event: React.MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    if (!user || toggling) return
    setToggling(true)
    const next = !favorited
    setFavorited(next)
    try {
      if (next) await addFavorite(user.uid, product.id)
      else await removeFavorite(user.uid, product.id)
    } catch {
      setFavorited(!next)
    } finally {
      setToggling(false)
    }
  }

  return (
    <>
      <article className={`group relative overflow-hidden rounded-xl border border-outline bg-surface transition hover:border-brand-500/40 hover:shadow-md ${compact ? 'flex items-stretch' : ''}`}>
        <Link to={`/products/${product.id}`} className={`block ${compact ? 'flex min-w-0 flex-1 items-stretch' : ''}`}>
          <div className={`relative overflow-hidden bg-outline/30 ${compact ? 'h-32 w-32 shrink-0 sm:h-36 sm:w-36' : 'aspect-square w-full'}`}>
            {product.images[0] ? <img src={product.images[0]} alt={product.title} loading="lazy" className="h-full w-full object-cover transition duration-300 group-hover:scale-105" /> : <div className="flex h-full w-full items-center justify-center text-ink-300">ছবি নেই</div>}
            {discount && <span className="absolute left-2 top-2 rounded-md bg-error px-1.5 py-0.5 text-xs font-semibold text-white">-{discount}%</span>}
            {product.is_escrow_protected && <span className="absolute right-2 top-2 rounded-md bg-brand-500/90 px-1.5 py-0.5 text-[10px] font-semibold text-white">এসক্রো সুরক্ষিত</span>}
            <div className="absolute bottom-2 left-2 flex max-w-[85%] flex-wrap gap-1">
              <ProductDeliveryBadge product={product} compact />
              {!product.is_digital && product.supports_cod && <span className="inline-flex items-center gap-1 rounded-md bg-brand-600/90 px-1.5 py-1 text-[10px] font-semibold text-white"><ShieldCheck size={11} />COD</span>}
              {!product.is_digital && product.free_delivery && <span className="inline-flex items-center gap-1 rounded-md bg-brand-600/90 px-1.5 py-1 text-[10px] font-semibold text-white"><Truck size={11} />ফ্রি ডেলিভারি</span>}
              {!product.is_digital && product.fast_delivery && <span className="inline-flex items-center gap-1 rounded-md bg-brand-600/90 px-1.5 py-1 text-[10px] font-semibold text-white"><Zap size={11} />দ্রুত</span>}
              {!product.is_digital && product.free_return && <span className="inline-flex items-center gap-1 rounded-md bg-brand-600/90 px-1.5 py-1 text-[10px] font-semibold text-white"><RotateCcw size={11} />ফ্রি রিটার্ন</span>}
            </div>
          </div>
          <div className={`min-w-0 flex-1 p-3 ${compact ? 'flex flex-col justify-center' : ''}`}>
            <p className="line-clamp-2 min-h-[2.5rem] text-sm text-ink-900">{product.title}</p>
            <div className="mt-1.5 flex items-baseline gap-2"><span className="tabular-amount text-base font-semibold text-brand-600">{formatTaka(product.price)}</span>{product.original_price && product.original_price > product.price && <span className="tabular-amount text-xs text-ink-300 line-through">{formatTaka(product.original_price)}</span>}</div>
            <p className="mt-2 truncate text-xs text-ink-300">{product.location || (product.is_digital ? 'ডিজিটাল পণ্য' : '')}</p>
          </div>
        </Link>
        <div className={`flex ${compact ? 'flex-col' : 'absolute bottom-2 right-2'} gap-1.5 ${compact ? 'p-2' : ''}`}>
          {user && <button type="button" onClick={handleToggleFavorite} disabled={toggling} aria-label={favorited ? 'পছন্দের তালিকা থেকে সরান' : 'পছন্দের তালিকায় যোগ করুন'} className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-lg shadow-sm transition hover:scale-110 disabled:opacity-50"><span className={favorited ? 'text-error' : 'text-ink-300'}>{favorited ? '♥' : '♡'}</span></button>}
          <button type="button" onClick={handleToggleCompare} aria-pressed={compared} className={`shrink-0 rounded-md px-2 py-1 text-[11px] font-medium transition ${compared ? 'bg-brand-100 text-brand-700' : 'border border-outline text-ink-600 hover:border-brand-500 hover:text-brand-600'}`}>{compared ? 'তুলনায় আছে' : 'তুলনা'}</button>
        </div>
      </article>
      <BrandedDialog open={compareLimitOpen} title="তুলনা তালিকা পূর্ণ" onClose={() => setCompareLimitOpen(false)} tone="warning" actions={<DialogButton onClick={() => setCompareLimitOpen(false)}>ঠিক আছে</DialogButton>}>একসাথে সর্বোচ্চ ৩টি পণ্য তুলনা করা যাবে। আগে Compare page থেকে একটি পণ্য সরিয়ে আবার চেষ্টা করুন।</BrandedDialog>
    </>
  )
}
