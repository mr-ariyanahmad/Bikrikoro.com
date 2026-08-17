import { Link } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { RotateCcw, ShieldCheck, Truck, Zap } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { isFavorited, addFavorite, removeFavorite } from '@/lib/favorites'
import type { Product } from '@/types/product'
import { formatTaka } from '@/lib/format'
import { isCompared, toggleCompared } from '@/lib/compare'

export function ProductCard({ product, compact = false }: { product: Product; compact?: boolean }) {
  const { user } = useAuth()
  const [favorited, setFavorited] = useState(false)
  const [toggling, setToggling] = useState(false)
  const [compared, setCompared] = useState(() => isCompared(product.id))

  const discount =
    product.original_price && product.original_price > product.price
      ? Math.round(100 - (product.price / product.original_price) * 100)
      : null

  useEffect(() => {
    if (!user) return
    let cancelled = false
    isFavorited(user.uid, product.id).then((v) => {
      if (!cancelled) setFavorited(v)
    })
    return () => {
      cancelled = true
    }
  }, [user, product.id])

  useEffect(() => {
    const sync = () => setCompared(isCompared(product.id))
    window.addEventListener('bikrikoro:compare-changed', sync)
    return () => window.removeEventListener('bikrikoro:compare-changed', sync)
  }, [product.id])

  const handleToggleCompare = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const result = toggleCompared(product.id)
    if (result.limitReached) {
      window.alert('একসাথে সর্বোচ্চ ৩টি পণ্য তুলনা করা যাবে।')
      return
    }
    setCompared(result.selected)
  }

  const handleToggleFavorite = async (e: React.MouseEvent) => {
    e.preventDefault() // don't navigate to the product when tapping the heart
    e.stopPropagation()
    if (!user || toggling) return
    setToggling(true)
    const next = !favorited
    setFavorited(next) // optimistic
    try {
      if (next) await addFavorite(user.uid, product.id)
      else await removeFavorite(user.uid, product.id)
    } catch {
      setFavorited(!next) // revert on failure
    } finally {
      setToggling(false)
    }
  }

  return (
    <Link
      to={`/products/${product.id}`}
      className={`group block overflow-hidden rounded-xl border border-outline bg-surface transition hover:border-brand-500/40 hover:shadow-md ${compact ? 'flex items-stretch' : ''}`}
    >
      <div className={`relative overflow-hidden bg-outline/30 ${compact ? 'h-32 w-32 shrink-0 sm:h-36 sm:w-36' : 'aspect-square w-full'}`}>
        {product.images[0] ? (
          <img
            src={product.images[0]}
            alt={product.title}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-ink-300">ছবি নেই</div>
        )}
        {discount && (
          <span className="absolute top-2 left-2 rounded-md bg-error px-1.5 py-0.5 text-xs font-semibold text-white">
            -{discount}%
          </span>
        )}
        {product.is_escrow_protected && (
          <span className="absolute top-2 right-2 rounded-md bg-brand-500/90 px-1.5 py-0.5 text-[10px] font-semibold text-white">
            এসক্রো সুরক্ষিত
          </span>
        )}
        <div className="absolute bottom-2 left-2 flex max-w-[85%] flex-wrap gap-1">
          {product.is_digital && <span className="inline-flex items-center gap-1 rounded-md bg-violet-600/90 px-1.5 py-1 text-[10px] font-semibold text-white">ডিজিটাল ডেলিভারি</span>}
          {!product.is_digital && product.supports_cod && <span className="inline-flex items-center gap-1 rounded-md bg-emerald-600/90 px-1.5 py-1 text-[10px] font-semibold text-white"><ShieldCheck size={11} />COD</span>}
          {!product.is_digital && product.free_delivery && <span className="inline-flex items-center gap-1 rounded-md bg-sky-600/90 px-1.5 py-1 text-[10px] font-semibold text-white"><Truck size={11} />ফ্রি ডেলিভারি</span>}
          {!product.is_digital && product.fast_delivery && <span className="inline-flex items-center gap-1 rounded-md bg-orange-500/90 px-1.5 py-1 text-[10px] font-semibold text-white"><Zap size={11} />দ্রুত</span>}
          {!product.is_digital && product.free_return && <span className="inline-flex items-center gap-1 rounded-md bg-ink-800/80 px-1.5 py-1 text-[10px] font-semibold text-white"><RotateCcw size={11} />ফ্রি রিটার্ন</span>}
        </div>
        {user && (
          <button
            onClick={handleToggleFavorite}
            aria-label={favorited ? 'পছন্দের তালিকা থেকে সরান' : 'পছন্দের তালিকায় যোগ করুন'}
            className="absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-lg shadow-sm transition hover:scale-110"
          >
            <span className={favorited ? 'text-error' : 'text-ink-300'}>{favorited ? '♥' : '♡'}</span>
          </button>
        )}
      </div>
      <div className={`min-w-0 flex-1 p-3 ${compact ? 'flex flex-col justify-center' : ''}`}>
        <p className="line-clamp-2 min-h-[2.5rem] text-sm text-ink-900">{product.title}</p>
        <div className="mt-1.5 flex items-baseline gap-2">
          <span className="tabular-amount text-base font-semibold text-brand-600">
            {formatTaka(product.price)}
          </span>
          {product.original_price && product.original_price > product.price && (
            <span className="tabular-amount text-xs text-ink-300 line-through">
              {formatTaka(product.original_price)}
            </span>
          )}
        </div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <p className="truncate text-xs text-ink-300">{product.location || (product.is_digital ? 'ডিজিটাল পণ্য' : '')}</p>
          <button
            onClick={handleToggleCompare}
            className={`shrink-0 rounded-md px-2 py-1 text-[11px] font-medium transition ${
              compared ? 'bg-brand-100 text-brand-700' : 'border border-outline text-ink-600 hover:border-brand-500 hover:text-brand-600'
            }`}
          >
            {compared ? 'তুলনায় আছে' : 'তুলনা'}
          </button>
        </div>
      </div>
    </Link>
  )
}
