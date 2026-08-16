import { Link } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { isFavorited, addFavorite, removeFavorite } from '@/lib/favorites'
import type { Product } from '@/types/product'
import { formatTaka } from '@/lib/format'

export function ProductCard({ product }: { product: Product }) {
  const { user } = useAuth()
  const [favorited, setFavorited] = useState(false)
  const [toggling, setToggling] = useState(false)

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
      className="group block overflow-hidden rounded-xl border border-outline bg-surface transition hover:border-brand-500/40 hover:shadow-md"
    >
      <div className="relative aspect-square overflow-hidden bg-outline/30">
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
      <div className="p-3">
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
        <p className="mt-1 truncate text-xs text-ink-300">{product.location}</p>
      </div>
    </Link>
  )
}
