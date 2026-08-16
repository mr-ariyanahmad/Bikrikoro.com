import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ProductCard } from '@/components/ProductCard'
import type { Product } from '@/types/product'

type Mode =
  | { type: 'related'; categoryId: string; excludeProductId: string }
  | { type: 'popular' }
  | { type: 'ids'; productIds: string[] }

export function RecommendedProducts({ title, mode, limit = 8 }: { title: string; mode: Mode; limit?: number }) {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)

      if (mode.type === 'ids') {
        if (mode.productIds.length === 0) {
          if (!cancelled) {
            setProducts([])
            setLoading(false)
          }
          return
        }
        const { data } = await supabase.from('products').select('*').in('id', mode.productIds)
        // preserve the caller's ordering (e.g. most-recently-viewed first) —
        // .in() doesn't guarantee row order matches the id list
        const byId = new Map((data ?? []).map((p) => [p.id, p]))
        const ordered = mode.productIds.map((id) => byId.get(id)).filter((p): p is Product => Boolean(p))
        if (!cancelled) {
          setProducts(ordered)
          setLoading(false)
        }
        return
      }

      let request = supabase.from('products').select('*')
      if (mode.type === 'related') {
        request = request.eq('category_id', mode.categoryId).neq('id', mode.excludeProductId)
      }
      request = mode.type === 'popular' ? request.order('view_count', { ascending: false }) : request.order('created_at', { ascending: false })

      const { data } = await request.limit(limit)
      if (!cancelled) {
        setProducts(data ?? [])
        setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(mode), limit])

  if (!loading && products.length === 0) return null

  return (
    <section className="mt-10">
      <h2 className="mb-4 text-base font-semibold text-ink-900">{title}</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="aspect-[3/4] animate-pulse rounded-xl bg-outline/40" />
            ))
          : products.map((product) => <ProductCard key={product.id} product={product} />)}
      </div>
    </section>
  )
}
