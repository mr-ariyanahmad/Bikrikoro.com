import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { GitCompareArrows, Heart, MoreVertical, ShieldCheck, Star } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { isFavorited, addFavorite, removeFavorite } from '@/lib/favorites'
import type { Product, Profile } from '@/types/product'
import { formatTaka } from '@/lib/format'
import { isCompared, toggleCompared } from '@/lib/compare'
import { BrandedDialog, DialogButton } from '@/components/BrandedDialog'
import { isTestDemoProduct, trackCategoryInterest } from '@/lib/recommendationPreferences'
import { BikrifyBadge } from '@/components/BikrifyBadge'

type CardSeller = Pick<Profile, 'id' | 'name' | 'photo_url' | 'shop_name' | 'is_verified' | 'rating' | 'review_count'>

export function ProductCard({ product, compact = false, seller }: { product: Product; compact?: boolean; seller?: CardSeller | null }) {
  const { user } = useAuth()
  const [favorited, setFavorited] = useState(false)
  const [toggling, setToggling] = useState(false)
  const [compared, setCompared] = useState(() => isCompared(product.id))
  const [compareLimitOpen, setCompareLimitOpen] = useState(false)
  const discount = product.original_price && product.original_price > product.price ? Math.round(100 - (product.price / product.original_price) * 100) : null
  const sellerName = seller?.shop_name?.trim() || seller?.name || 'BikriKoro seller'
  const rating = Number(seller?.rating ?? 0)
  const reviewCount = Number(seller?.review_count ?? 0)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    isFavorited(user.uid, product.id).then((value) => { if (!cancelled) setFavorited(value) })
    return () => { cancelled = true }
  }, [user, product.id])

  useEffect(() => {
    const sync = () => setCompared(isCompared(product.id))
    window.addEventListener('bikrikoro:compare-changed', sync)
    return () => window.removeEventListener('bikrikoro:compare-changed', sync)
  }, [product.id])

  const handleToggleCompare = (event: React.MouseEvent) => {
    event.preventDefault(); event.stopPropagation()
    const result = toggleCompared(product.id)
    if (result.limitReached) setCompareLimitOpen(true)
    else setCompared(result.selected)
  }

  const handleToggleFavorite = async (event: React.MouseEvent) => {
    event.preventDefault(); event.stopPropagation()
    if (!user || toggling) return
    setToggling(true)
    const next = !favorited
    setFavorited(next)
    try {
      if (next) { await addFavorite(user.uid, product.id); if (!isTestDemoProduct(product)) trackCategoryInterest(product.category_id, 'favorite') }
      else await removeFavorite(user.uid, product.id)
    } catch { setFavorited(!next) } finally { setToggling(false) }
  }

  const handleProductOpen = () => { if (!isTestDemoProduct(product)) trackCategoryInterest(product.category_id, 'click') }
  const cardClass = compact ? 'flex items-stretch rounded-2xl border border-outline bg-surface p-1.5 shadow-sm' : 'rounded-[1.15rem] border border-outline bg-surface p-1.5 shadow-[0_5px_16px_rgba(15,23,42,0.06)] transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-[0_10px_22px_rgba(15,23,42,0.1)] sm:rounded-[1.25rem]'

  return <>
    <article className={`group relative min-w-0 overflow-hidden ${cardClass}`}>
      <Link to={`/products/${product.id}`} onClick={handleProductOpen} className={compact ? 'h-28 w-28 shrink-0' : 'block'}>
          <div className={`relative overflow-hidden bg-brand-50 ${compact ? 'h-28 w-28 rounded-xl' : 'aspect-[1.14] w-full rounded-[0.85rem] sm:aspect-[1.28] sm:rounded-[0.9rem]'}`}>
          {product.images[0] ? <img src={product.images[0]} alt={product.title} loading="lazy" className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.04]" /> : <div className="flex h-full w-full items-center justify-center text-xs text-ink-300">ছবি নেই</div>}
          {discount && <span className="absolute right-2 top-2 rounded-xl bg-error px-2 py-1 text-[11px] font-extrabold text-white shadow-sm">-{discount}%</span>}
          {product.is_escrow_protected && <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-lg bg-brand-700/90 px-2 py-1 text-[10px] font-bold text-white"><ShieldCheck size={11} />নিরাপদ</span>}
        </div>
      </Link>
      <div className={`min-w-0 flex-1 ${compact ? 'p-3' : 'px-1.5 pb-1.5 pt-2.5'}`}>
        <Link to={`/products/${product.id}`} onClick={handleProductOpen} className="block"><p className="line-clamp-2 min-h-9 text-[13px] font-bold leading-4.5 text-ink-900">{product.title}</p></Link>
        <div className="mt-1 flex items-baseline gap-1.5"><Link to={`/products/${product.id}`} onClick={handleProductOpen} className="tabular-amount text-[1.05rem] font-extrabold text-accent-500">{formatTaka(product.price)}</Link>{product.original_price && product.original_price > product.price && <span className="tabular-amount text-[11px] text-ink-400 line-through">{formatTaka(product.original_price)}</span>}</div>
        <Link to={`/products/${product.id}`} onClick={handleProductOpen} className="mt-1.5 flex min-w-0 items-center gap-1.5 border-t border-outline pt-1.5"><span className="flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-100 text-[8px] font-bold text-brand-700">{seller?.photo_url ? <img src={seller.photo_url} alt="" className="h-full w-full object-cover" loading="lazy" /> : sellerName.charAt(0)}</span><span className="min-w-0 truncate text-[11px] font-semibold text-brand-700">{sellerName}</span>{seller?.is_verified && <BikrifyBadge compact />}<MoreVertical size={14} className="ml-auto shrink-0 text-ink-300" /></Link>
        <div className="mt-0.5 flex min-h-7 items-center justify-between gap-1 text-[10px] text-ink-500"><span className="flex min-w-0 items-center gap-1">{reviewCount > 0 ? <><span className="flex shrink-0 items-center gap-0.5 text-accent-500">{Array.from({ length: 5 }, (_, index) => <Star key={index} size={10} className={index < Math.round(rating) ? 'fill-accent-500 text-accent-500' : 'text-accent-200'} />)}</span><span>({reviewCount})</span></> : <><span className="flex shrink-0 items-center gap-0.5 text-accent-300">{Array.from({ length: 5 }, (_, index) => <Star key={index} size={10} />)}</span><span className="truncate">কোনো রিভিউ নেই</span></>}</span><span className="flex shrink-0 items-center gap-0.5">{user && <button type="button" onClick={handleToggleFavorite} disabled={toggling} aria-label={favorited ? 'পছন্দের তালিকা থেকে সরান' : 'পছন্দের তালিকায় যোগ করুন'} className="flex h-6 w-6 items-center justify-center rounded-full text-ink-300 hover:bg-accent-100 hover:text-error disabled:opacity-50"><Heart size={13} className={favorited ? 'fill-error text-error' : ''} /></button>}<button type="button" onClick={handleToggleCompare} aria-pressed={compared} aria-label={compared ? 'তুলনায় আছে' : 'তুলনায় যোগ করুন'} className={`flex h-6 w-6 items-center justify-center rounded-full text-ink-300 hover:bg-brand-50 hover:text-brand-700 ${compared ? 'bg-brand-50 text-brand-700' : ''}`}><GitCompareArrows size={13} /></button></span></div>
      </div>
    </article>
    <BrandedDialog open={compareLimitOpen} title="তুলনা তালিকা পূর্ণ" onClose={() => setCompareLimitOpen(false)} tone="warning" actions={<DialogButton onClick={() => setCompareLimitOpen(false)}>ঠিক আছে</DialogButton>}>একসাথে সর্বোচ্চ ৩টি পণ্য তুলনা করা যাবে। আগে Compare page থেকে একটি পণ্য সরিয়ে আবার চেষ্টা করুন।</BrandedDialog>
  </>
}
