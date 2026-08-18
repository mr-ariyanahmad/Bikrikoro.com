import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { supabase } from '@/lib/supabase'
import { Layout } from '@/components/Layout'
import { ProductCard } from '@/components/ProductCard'
import { formatDate } from '@/lib/format'
import type { Product, Profile } from '@/types/product'
import type { Review } from '@/types/order'

export default function SellerProfile() {
  const { id } = useParams<{ id: string }>()
  const [seller, setSeller] = useState<Profile | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    let active = true
    setLoading(true)
    setLoadError(null)
    async function load() {
      try {
        const [sellerRes, productsRes, reviewsRes] = await Promise.all([
          supabase.from('profiles').select('*').eq('id', id).maybeSingle(),
          supabase.from('products').select('*').eq('seller_id', id).eq('is_hidden', false).eq('approval_status', 'APPROVED').order('created_at', { ascending: false }),
          supabase.from('reviews').select('*').eq('seller_id', id).order('created_at', { ascending: false }).limit(20),
        ])
        if (sellerRes.error) throw sellerRes.error
        if (productsRes.error) throw productsRes.error
        if (reviewsRes.error) throw reviewsRes.error
        if (!active) return
        setSeller(sellerRes.data)
        setProducts(productsRes.data ?? [])
        setReviews(reviewsRes.data ?? [])
      } catch (error) {
        console.error('Seller profile load failed:', error)
        if (active) setLoadError(error instanceof Error ? error.message : 'সেলার প্রোফাইল লোড করা যায়নি।')
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => { active = false }
  }, [id])

  if (loading) {
    return (
      <Layout wide>
        <div className="h-72 animate-pulse rounded-2xl bg-outline/40" />
      </Layout>
    )
  }

  if (!seller) {
    return (
      <Layout wide>
        <div className="py-16 text-center"><p className="text-ink-600">{loadError ? `সেলার প্রোফাইল লোড করা যায়নি: ${loadError}` : 'এই বিক্রেতাকে পাওয়া যায়নি।'}</p><a href="/products" className="mt-4 inline-flex border border-brand-500 px-4 py-2.5 text-sm font-semibold text-brand-700">সব পণ্য দেখুন</a></div>
      </Layout>
    )
  }

  const shopName = seller.shop_name?.trim() || seller.name || 'বিক্রেতা'
  const shopDescription = seller.shop_description?.trim()

  return (
    <Layout wide>
      <Helmet>
        <title>{`${shopName} — BikriKoro.Com`}</title>
        <meta name="description" content={shopDescription || `${shopName}-র পণ্য ও রিভিউ দেখুন BikriKoro-তে।`} />
      </Helmet>

      <div className="flex flex-col items-center gap-4 rounded-2xl border border-outline bg-surface p-6 sm:flex-row sm:items-start">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-100 text-2xl font-semibold text-brand-700">
          {seller.photo_url ? (
            <img src={seller.photo_url} alt="" className="h-full w-full object-cover" />
          ) : (
            (seller.name || '?').charAt(0)
          )}
        </div>

        <div className="text-center sm:text-left">
          <div className="flex items-center justify-center gap-2 sm:justify-start">
            <h1 className="text-xl font-semibold text-ink-900">{shopName}</h1>
            {seller.is_verified && (
              <span className="rounded-full bg-info/10 px-2 py-0.5 text-xs font-semibold text-info">
                ✓ যাচাইকৃত
              </span>
            )}
          </div>
          {seller.name && seller.name !== shopName && <p className="mt-1 text-xs text-ink-500">মালিক: {seller.name}</p>}
          {shopDescription && <p className="mt-2 max-w-xl text-sm leading-6 text-ink-600">{shopDescription}</p>}
          <p className="mt-1 text-sm text-ink-600">
            {seller.review_count > 0 ? `★ ${seller.rating.toFixed(1)} (${seller.review_count} রিভিউ)` : 'এখনো কোনো রিভিউ নেই'}
          </p>
          <p className="mt-1 text-xs text-ink-300">
            {formatDate(seller.created_at)} থেকে BikriKoro-তে · {products.length}টি পণ্য
          </p>
        </div>
      </div>

      <h2 className="mt-8 mb-4 text-base font-semibold text-ink-900">পণ্যসমূহ</h2>
      {products.length === 0 ? (
        <p className="text-sm text-ink-600">এই বিক্রেতার কোনো সক্রিয় পণ্য নেই।</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}

      <h2 className="mt-10 mb-4 text-base font-semibold text-ink-900">রিভিউ</h2>
      {reviews.length === 0 ? (
        <p className="text-sm text-ink-600">এখনো কোনো রিভিউ পাননি এই বিক্রেতা।</p>
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => (
            <div key={review.id} className="rounded-xl border border-outline bg-surface p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-ink-900">{review.buyer_name || 'ক্রেতা'}</p>
                <span className="text-warning">{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</span>
              </div>
              <p className="mt-1 text-xs text-ink-300">{review.product_title}</p>
              {review.comment && <p className="mt-2 text-sm text-ink-600">{review.comment}</p>}
              <p className="mt-2 text-xs text-ink-300">{formatDate(review.created_at)}</p>
            </div>
          ))}
        </div>
      )}
    </Layout>
  )
}
