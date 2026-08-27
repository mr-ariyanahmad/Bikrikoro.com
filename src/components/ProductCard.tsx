import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { BadgeCheck, GitCompareArrows, Heart, RotateCcw, ShieldCheck, Star, Truck, Zap } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { isFavorited, addFavorite, removeFavorite } from '@/lib/favorites'
import type { Product, Profile } from '@/types/product'
import { formatTaka } from '@/lib/format'
import { isCompared, toggleCompared } from '@/lib/compare'
import { BrandedDialog, DialogButton } from '@/components/BrandedDialog'
import { ProductDeliveryBadge } from '@/components/ProductDeliveryBadge'
import { isTestDemoProduct, trackCategoryInterest } from '@/lib/recommendationPreferences'

type CardSeller = Pick<Profile, 'id' | 'name' | 'photo_url' | 'shop_name' | 'is_verified' | 'rating' | 'review_count'>

export function ProductCard({ product, compact = false, seller }: { product: Product; compact?: boolean; seller?: CardSeller | null }) {
  const { user } = useAuth()
  const [favorited, setFavorited] = useState(false)
  const [toggling, setToggling] = useState(false)
  const [compared, setCompared] = useState(() => isCompared(product.id))
  const [compareLimitOpen, setCompareLimitOpen] = useState(false)

  const discount = product.original_price && product.original_price > product.price
    ? Math.round(100 - (product.price / product.original_price) * 100)
    : null
  const sellerName = seller?.shop_name?.trim() || seller?.name || 'BikriKoro seller'

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
      if (next) {
        await addFavorite(user.uid, product.id)
        if (!isTestDemoProduct(product)) trackCategoryInterest(product.category_id, 'favorite')
      }
      else await removeFavorite(user.uid, product.id)
    } catch {
      setFavorited(!next)
    } finally {
      setToggling(false)
    }
  }

  const handleProductOpen = () => {
    if (!isTestDemoProduct(product)) trackCategoryInterest(product.category_id, 'click')
  }

  return (
    <>
      <article className={`group relative overflow-hidden rounded-2xl border border-outline/90 bg-surface shadow-[0_5px_16px_rgba(17,24,39,0.05)] transition duration-200 hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-[0_11px_24px_rgba(14,96,68,0.12)] ${compact ? 'flex items-stretch' : ''}`}>
        <Link to={`/products/${product.id}`} onClick={handleProductOpen} className={`block ${compact ? 'h-28 w-28 shrink-0 sm:h-32 sm:w-32' : ''}`}>
          <div className={`relative overflow-hidden bg-outline/30 ${compact ? 'h-28 w-28 shrink-0 sm:h-32 sm:w-32' : 'aspect-[1.2/1] w-full'}`}>
            {product.images[0] ? <img src={product.images[0]} alt={product.title} loading="lazy" className="h-full w-full object-cover transition duration-300 group-hover:scale-105" /> : <div className="flex h-full w-full items-center justify-center text-ink-300">ছবি নেই</div>}
            <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/50 to-transparent" />
            {discount && <span className="absolute left-2 top-2 rounded-lg bg-error px-1.5 py-0.5 text-[10px] font-extrabold text-white shadow-sm">-{discount}%</span>}
            {product.is_escrow_protected && <span className="absolute right-2 top-2 inline-flex items-center gap-0.5 rounded-lg bg-white/95 px-1.5 py-1 text-[9px] font-bold text-brand-700 shadow-sm"><ShieldCheck size={10} />নিরাপদ</span>}
            <div className="absolute bottom-1.5 left-1.5 flex max-w-[88%] flex-wrap gap-1">
              <ProductDeliveryBadge product={product} compact />
              {!product.is_digital && product.supports_cod && <span className="inline-flex items-center gap-1 rounded-md bg-brand-600/90 px-1.5 py-1 text-[10px] font-semibold text-white"><ShieldCheck size={11} />COD</span>}
              {!product.is_digital && product.free_delivery && <span className="inline-flex items-center gap-1 rounded-md bg-brand-600/90 px-1.5 py-1 text-[10px] font-semibold text-white"><Truck size={11} />ফ্রি ডেলিভারি</span>}
              {!product.is_digital && product.fast_delivery && <span className="inline-flex items-center gap-1 rounded-md bg-brand-600/90 px-1.5 py-1 text-[10px] font-semibold text-white"><Zap size={11} />দ্রুত</span>}
              {!product.is_digital && product.free_return && <span className="inline-flex items-center gap-1 rounded-md bg-brand-600/90 px-1.5 py-1 text-[10px] font-semibold text-white"><RotateCcw size={11} />ফ্রি রিটার্ন</span>}
            </div>
            </div>
        </Link>
        <div className={`min-w-0 flex-1 p-3 ${compact ? 'flex flex-col justify-center' : ''}`}>
          <Link to={`/products/${product.id}`} onClick={handleProductOpen} className="block"><p className="line-clamp-2 min-h-10 text-[13px] font-bold leading-5 text-ink-900 sm:text-sm">{product.title}</p></Link>
          <div className="mt-1.5 flex min-h-7 items-center justify-between gap-1"><Link to={`/products/${product.id}`} onClick={handleProductOpen} className="flex min-w-0 flex-wrap items-baseline gap-x-1.5"><span className="tabular-amount text-[17px] font-extrabold tracking-tight text-brand-600">{formatTaka(product.price)}</span>{product.original_price && product.original_price > product.price && <span className="tabular-amount text-[10px] text-ink-400 line-through">{formatTaka(product.original_price)}</span>}</Link><div className="flex shrink-0 items-center gap-1">{user && <button type="button" onClick={handleToggleFavorite} disabled={toggling} aria-label={favorited ? 'পছন্দের তালিকা থেকে সরান' : 'পছন্দের তালিকায় যোগ করুন'} className="flex h-7 w-7 items-center justify-center rounded-full bg-bg text-lg transition hover:bg-error/5 disabled:opacity-50"><Heart size={14} className={favorited ? 'fill-error text-error' : 'text-ink-400'} /></button>}<button type="button" onClick={handleToggleCompare} aria-pressed={compared} aria-label={compared ? 'তুলনায় আছে' : 'তুলনায় যোগ করুন'} className={`flex h-7 w-7 items-center justify-center rounded-full bg-bg transition ${compared ? 'text-brand-700' : 'text-ink-500 hover:text-brand-700'}`}><GitCompareArrows size={13} /></button></div></div>
          {seller && <Link to={`/products/${product.id}`} onClick={handleProductOpen} className="mt-2 flex min-w-0 items-center gap-1.5 border-t border-outline/70 pt-2"><span className="flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-100 text-[9px] font-bold text-brand-700">{seller.photo_url ? <img src={seller.photo_url} alt="" className="h-full w-full object-cover" loading="lazy" /> : sellerName.charAt(0)}</span><span className="truncate text-[11px] font-semibold text-ink-700">{sellerName}</span>{seller.is_verified && <BadgeCheck size={13} className="shrink-0 text-brand-600" aria-label="যাচাইকৃত বিক্রেতা" />}{seller.review_count > 0 ? <span className="ml-auto inline-flex shrink-0 items-center gap-0.5 text-[10px] text-ink-500"><Star size={11} className="fill-amber-400 text-amber-400" />{seller.rating.toFixed(1)}</span> : <span className="ml-auto inline-flex shrink-0 items-center gap-0.5 text-[10px] text-amber-600"><Star size={11} className="fill-amber-400 text-amber-400" />নতুন</span>}</Link>}
          {!seller && <Link to={`/products/${product.id}`} onClick={handleProductOpen} className="mt-2 block truncate border-t border-outline/70 pt-2 text-[11px] font-medium text-ink-400">{product.location || (product.is_digital ? 'ডিজিটাল পণ্য' : '')}</Link>}
        </div>
      </article>
      <BrandedDialog open={compareLimitOpen} title="তুলনা তালিকা পূর্ণ" onClose={() => setCompareLimitOpen(false)} tone="warning" actions={<DialogButton onClick={() => setCompareLimitOpen(false)}>ঠিক আছে</DialogButton>}>একসাথে সর্বোচ্চ ৩টি পণ্য তুলনা করা যাবে। আগে Compare page থেকে একটি পণ্য সরিয়ে আবার চেষ্টা করুন।</BrandedDialog>
    </>
  )
}
