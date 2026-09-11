import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { BadgeCheck, GitCompareArrows, Heart, ShieldCheck, Star } from 'lucide-react'
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
  const discount = product.original_price && product.original_price > product.price ? Math.round(100 - (product.price / product.original_price) * 100) : null
  const sellerName = seller?.shop_name?.trim() || seller?.name || 'BikriKoro seller'

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

  return <>
    <article className={`group relative min-w-0 ${compact ? 'flex items-stretch border border-outline bg-surface' : ''}`}>
      <Link to={`/products/${product.id}`} onClick={handleProductOpen} className={`block ${compact ? 'h-28 w-28 shrink-0' : ''}`}>
        <div className={`relative overflow-hidden bg-outline/30 ${compact ? 'h-28 w-28' : 'aspect-[0.92] w-full'}`}>
          {product.images[0] ? <img src={product.images[0]} alt={product.title} loading="lazy" className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" /> : <div className="flex h-full w-full items-center justify-center text-xs text-ink-300">ছবি নেই</div>}
          {discount && <span className="absolute left-2 top-2 bg-error px-1.5 py-0.5 text-[10px] font-bold text-white">-{discount}%</span>}
        </div>
      </Link>
      <div className={`min-w-0 flex-1 ${compact ? 'p-3' : 'pt-2'}`}>
        <Link to={`/products/${product.id}`} onClick={handleProductOpen} className="block"><p className="line-clamp-2 min-h-9 text-[13px] font-semibold leading-4 text-ink-900">{product.title}</p></Link>
        <p className="mt-1 truncate text-[10px] text-ink-500">{product.is_digital ? 'ডিজিটাল পণ্য' : product.location || 'Marketplace'}<span className="mx-1">•</span>{product.is_digital ? <ProductDeliveryBadge product={product} compact /> : 'দ্রুত ডেলিভারি'}</p>
        <div className="mt-1.5 flex items-center justify-between gap-1"><Link to={`/products/${product.id}`} onClick={handleProductOpen} className="flex min-w-0 flex-wrap items-baseline gap-1"><span className="tabular-amount text-[16px] font-bold text-brand-600">{formatTaka(product.price)}</span>{product.original_price && product.original_price > product.price && <span className="tabular-amount text-[10px] text-ink-400 line-through">{formatTaka(product.original_price)}</span>}</Link><div className="flex shrink-0 items-center gap-1">{user && <button type="button" onClick={handleToggleFavorite} disabled={toggling} aria-label={favorited ? 'পছন্দের তালিকা থেকে সরান' : 'পছন্দের তালিকায় যোগ করুন'} className="flex h-6 w-6 items-center justify-center text-ink-400 hover:text-error disabled:opacity-50"><Heart size={14} className={favorited ? 'fill-error text-error' : ''} /></button>}<button type="button" onClick={handleToggleCompare} aria-pressed={compared} aria-label={compared ? 'তুলনায় আছে' : 'তুলনায় যোগ করুন'} className={`flex h-6 w-6 items-center justify-center text-ink-400 hover:text-brand-700 ${compared ? 'text-brand-700' : ''}`}><GitCompareArrows size={13} /></button></div></div>
        {seller && <Link to={`/products/${product.id}`} onClick={handleProductOpen} className="mt-1.5 flex min-w-0 items-center gap-1 border-t border-outline pt-1.5"><span className="flex h-4 w-4 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-100 text-[8px] font-bold text-brand-700">{seller.photo_url ? <img src={seller.photo_url} alt="" className="h-full w-full object-cover" loading="lazy" /> : sellerName.charAt(0)}</span><span className="truncate text-[10px] font-medium text-ink-600">{sellerName}</span>{seller.is_verified && <BadgeCheck size={12} className="shrink-0 text-brand-500" aria-label="যাচাইকৃত বিক্রেতা" />}{seller.review_count > 0 && <span className="ml-auto inline-flex shrink-0 items-center gap-0.5 text-[9px] text-ink-500"><Star size={10} className="fill-amber-400 text-amber-400" />{seller.rating.toFixed(1)}</span>}</Link>}
        {!seller && <Link to={`/products/${product.id}`} onClick={handleProductOpen} className="mt-1.5 flex items-center gap-1 border-t border-outline pt-1.5 text-[10px] font-medium text-ink-500">{product.is_escrow_protected && <ShieldCheck size={11} className="text-brand-500" />}Buyer protected</Link>}
      </div>
    </article>
    <BrandedDialog open={compareLimitOpen} title="তুলনা তালিকা পূর্ণ" onClose={() => setCompareLimitOpen(false)} tone="warning" actions={<DialogButton onClick={() => setCompareLimitOpen(false)}>ঠিক আছে</DialogButton>}>একসাথে সর্বোচ্চ ৩টি পণ্য তুলনা করা যাবে। আগে Compare page থেকে একটি পণ্য সরিয়ে আবার চেষ্টা করুন।</BrandedDialog>
  </>
}
