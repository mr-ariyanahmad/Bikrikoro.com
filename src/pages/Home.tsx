import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { supabase } from '@/lib/supabase'
import { Layout } from '@/components/Layout'
import { ProductCard } from '@/components/ProductCard'
import { CategoryPills } from '@/components/CategoryPills'
import { RecommendedProducts } from '@/components/RecommendedProducts'
import { getRecentlyViewedIds } from '@/lib/recentlyViewed'
import type { Product, Category, PromoBanner } from '@/types/product'

export default function Home() {
  const [banners, setBanners] = useState<PromoBanner[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [bannersRes, categoriesRes, productsRes] = await Promise.all([
        supabase.from('promo_banners').select('*').order('sort_order'),
        supabase.from('categories').select('*').order('sort_order'),
        supabase.from('products').select('*').order('created_at', { ascending: false }).limit(12),
      ])
      setBanners(bannersRes.data ?? [])
      setCategories(categoriesRes.data ?? [])
      setProducts(productsRes.data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  return (
    <Layout wide>
      <Helmet>
        <title>BikriKoro.Com — বাংলাদেশের নিরাপদ অনলাইন কেনাবেচার প্ল্যাটফর্ম</title>
        <meta
          name="description"
          content="এসক্রো-সুরক্ষিত মার্কেটপ্লেস — নিরাপদে কিনুন, নিশ্চিন্তে বিক্রি করুন। নতুন-পুরাতন পণ্য বাংলাদেশজুড়ে।"
        />
      </Helmet>

      {banners.length > 0 && (
        <div className="scrollbar-none -mx-5 mb-6 flex gap-3 overflow-x-auto px-5 pb-1">
          {banners.map((banner) => (
            <Link
              key={banner.id}
              to={banner.target_category_id ? `/products?category=${banner.target_category_id}` : '/products'}
              className="h-36 w-64 shrink-0 overflow-hidden rounded-2xl bg-outline/30 sm:h-44 sm:w-96"
            >
              <img src={banner.image_url} alt="" className="h-full w-full object-cover" />
            </Link>
          ))}
        </div>
      )}

      <section className="mb-6 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 p-6 text-white sm:p-8">
        <p className="text-sm font-medium text-brand-50/80">নিরাপদ কেনাবেচার প্ল্যাটফর্ম</p>
        <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">বিশ্বাস করে কিনুন, নিশ্চিন্তে বিক্রি করুন</h1>
        <p className="mt-2 max-w-md text-sm text-brand-50/90">
          এসক্রো সুরক্ষায় প্রতিটা লেনদেন — টাকা বিক্রেতার কাছে যায় শুধু আপনি পণ্য হাতে পাওয়ার পর।
        </p>
        <Link
          to="/sell"
          className="mt-4 inline-block rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-brand-700 transition hover:bg-brand-50"
        >
          পণ্য বিক্রি করুন
        </Link>
      </section>

      <CategoryPills
        categories={categories}
        selectedId={null}
        onSelect={(id) => {
          window.location.href = id ? `/products?category=${id}` : '/products'
        }}
      />

      <div className="mt-6 flex items-center justify-between">
        <h2 className="text-base font-semibold text-ink-900">সাম্প্রতিক পণ্য</h2>
        <Link to="/products" className="text-sm font-medium text-brand-600 hover:text-brand-700">
          সব দেখুন →
        </Link>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {loading
          ? Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-[3/4] animate-pulse rounded-xl bg-outline/40" />
            ))
          : products.map((product) => <ProductCard key={product.id} product={product} />)}
      </div>

      {!loading && products.length === 0 && (
        <p className="mt-8 text-center text-ink-600">এখনো কোনো পণ্য যোগ হয়নি।</p>
      )}

      <RecommendedProducts title="জনপ্রিয় পণ্য" mode={{ type: 'popular' }} />

      {getRecentlyViewedIds().length > 0 && (
        <RecommendedProducts title="আপনি যা দেখেছেন" mode={{ type: 'ids', productIds: getRecentlyViewedIds() }} />
      )}
    </Layout>
  )
}
