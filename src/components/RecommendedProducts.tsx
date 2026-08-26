import { useEffect, useState } from 'react'
import { supabase, supabaseConfigured } from '@/lib/supabase'
import { ProductCard } from '@/components/ProductCard'
import type { Product, Profile } from '@/types/product'
import { PUBLIC_PRODUCT_FIELDS, PUBLIC_PRODUCT_TABLE } from '@/lib/publicProductFields'
import { getPreferredCategoryIds, isTestDemoProduct, rankProductsByCategoryInterest } from '@/lib/recommendationPreferences'

type Mode =
  | { type: 'related'; categoryId: string; excludeProductId: string }
  | { type: 'seller'; sellerId: string; excludeProductId: string }
  | { type: 'popular'; excludeProductId?: string }
  | { type: 'personalized'; excludeProductId?: string }
  | { type: 'ids'; productIds: string[] }

export function RecommendedProducts({ title, mode, limit = 8, layout = 'default' }: { title: string; mode: Mode; limit?: number; layout?: 'default' | 'media' }) {
  const [products, setProducts] = useState<Product[]>([])
  const [sellersById, setSellersById] = useState<Record<string, Pick<Profile, 'id' | 'name' | 'photo_url' | 'shop_name' | 'is_verified' | 'rating' | 'review_count'>>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setSellersById({})
      if (!supabaseConfigured) {
        if (!cancelled) setLoading(false)
        return
      }

      try {
        const applyProducts = async (rows: Product[]) => {
          const sellerIds = [...new Set(rows.map((product) => product.seller_id).filter(Boolean))]
          const { data: sellerRows } = sellerIds.length > 0
            ? await supabase.from('profiles').select('id, name, photo_url, shop_name, is_verified, rating, review_count').in('id', sellerIds)
            : { data: [] }
          if (cancelled) return
          setSellersById(Object.fromEntries((sellerRows ?? []).map((seller) => [seller.id, seller])))
          setProducts(rows)
        }

        if (mode.type === 'ids') {
          if (mode.productIds.length === 0) {
            if (!cancelled) setProducts([])
            return
          }
          const { data } = await supabase.from(PUBLIC_PRODUCT_TABLE).select(PUBLIC_PRODUCT_FIELDS).in('id', mode.productIds)
          const rows = (data ?? []) as Product[]
          const byId = new Map(rows.map((product) => [product.id, product]))
          const ordered = mode.productIds.map((id) => byId.get(id)).filter((product): product is Product => Boolean(product))
          await applyProducts(ordered)
          return
        }

        if (mode.type === 'personalized') {
          const preferredCategoryIds = getPreferredCategoryIds()
          let preferredRequest = supabase.from(PUBLIC_PRODUCT_TABLE).select(PUBLIC_PRODUCT_FIELDS).not('title', 'ilike', 'TEST / Demo only —%')
          if (preferredCategoryIds.length > 0) preferredRequest = preferredRequest.in('category_id', preferredCategoryIds)
          if (mode.excludeProductId) preferredRequest = preferredRequest.neq('id', mode.excludeProductId)
          let fallbackRequest = supabase
            .from(PUBLIC_PRODUCT_TABLE)
            .select(PUBLIC_PRODUCT_FIELDS)
            .not('title', 'ilike', 'TEST / Demo only —%')
            .order('popularity_score', { ascending: false })
            .order('view_count', { ascending: false })
            .order('created_at', { ascending: false })
            .limit(limit * 3)
          if (mode.excludeProductId) fallbackRequest = fallbackRequest.neq('id', mode.excludeProductId)
          const [preferredResponse, fallbackResponse] = await Promise.all([
            preferredCategoryIds.length > 0 ? preferredRequest.order('popularity_score', { ascending: false }).order('view_count', { ascending: false }).limit(limit * 4) : Promise.resolve({ data: [] as Product[], error: null }),
            fallbackRequest,
          ])
          if (preferredResponse.error || fallbackResponse.error) throw preferredResponse.error ?? fallbackResponse.error
          const uniqueProducts = new Map<string, Product>()
          for (const product of [...((preferredResponse.data ?? []) as Product[]), ...((fallbackResponse.data ?? []) as Product[])]) {
            if (!isTestDemoProduct(product)) uniqueProducts.set(product.id, product)
          }
          await applyProducts(rankProductsByCategoryInterest([...uniqueProducts.values()]).slice(0, limit))
          return
        }

        let request = supabase.from(PUBLIC_PRODUCT_TABLE).select(PUBLIC_PRODUCT_FIELDS)
        if (mode.type === 'related') request = request.eq('category_id', mode.categoryId).neq('id', mode.excludeProductId)
        if (mode.type === 'seller') request = request.eq('seller_id', mode.sellerId).neq('id', mode.excludeProductId)
        if (mode.type === 'popular' && mode.excludeProductId) request = request.neq('id', mode.excludeProductId)
        request = mode.type === 'popular' ? request.order('popularity_score', { ascending: false }).order('view_count', { ascending: false }) : request.order('created_at', { ascending: false })
        const { data } = await request.limit(limit)
        await applyProducts((data ?? []) as Product[])
      } catch (error) {
        console.error('Recommended products load failed:', error)
        if (!cancelled) setProducts([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(mode), limit])

  if (!loading && products.length === 0) return null

  return (
    <section className={layout === 'media' ? 'mt-5 hidden rounded-2xl border border-outline bg-surface p-4 shadow-sm md:block' : 'mt-10'}>
      <div className="mb-3 flex items-center justify-between gap-3"><h2 className="text-base font-semibold text-ink-900">{title}</h2>{layout === 'media' && <a href="/products" className="text-xs font-semibold text-brand-700 hover:underline">সব দেখুন</a>}</div>
      <div className={layout === 'media' ? 'grid grid-cols-2 gap-3' : 'grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4'}>
        {loading
          ? Array.from({ length: 4 }).map((_, i) => <div key={i} className="aspect-[3/4] animate-pulse rounded-xl bg-outline/40" />)
          : products.map((product) => <ProductCard key={product.id} product={product} seller={sellersById[product.seller_id] ?? null} />)}
      </div>
    </section>
  )
}
