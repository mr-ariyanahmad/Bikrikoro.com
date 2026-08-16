import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { supabase } from '@/lib/supabase'
import { Layout } from '@/components/Layout'
import { ProductCard } from '@/components/ProductCard'
import { CategoryPills } from '@/components/CategoryPills'
import type { Product, Category } from '@/types/product'

type SortOption = 'newest' | 'price_asc' | 'price_desc'

export default function Products() {
  const [searchParams, setSearchParams] = useSearchParams()
  const categoryId = searchParams.get('category')
  const initialQuery = searchParams.get('q') ?? ''

  const [categories, setCategories] = useState<Category[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState(initialQuery)
  const [sort, setSort] = useState<SortOption>('newest')

  useEffect(() => {
    supabase
      .from('categories')
      .select('*')
      .order('sort_order')
      .then(({ data }) => setCategories(data ?? []))
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    async function load() {
      let request = supabase.from('products').select('*')

      if (categoryId) request = request.eq('category_id', categoryId)
      if (query.trim()) request = request.ilike('title', `%${query.trim()}%`)

      if (sort === 'price_asc') request = request.order('price', { ascending: true })
      else if (sort === 'price_desc') request = request.order('price', { ascending: false })
      else request = request.order('created_at', { ascending: false })

      const { data } = await request.limit(60)
      if (!cancelled) {
        setProducts(data ?? [])
        setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [categoryId, query, sort])

  const handleCategorySelect = (id: string | null) => {
    const next = new URLSearchParams(searchParams)
    if (id) next.set('category', id)
    else next.delete('category')
    setSearchParams(next)
  }

  return (
    <Layout wide>
      <Helmet>
        <title>সব পণ্য ব্রাউজ করুন | BikriKoro.Com</title>
        <meta name="description" content="বাংলাদেশজুড়ে হাজারো পণ্য — ইলেকট্রনিক্স, ফ্যাশন, গাড়ি ও আরও অনেক কিছু। এসক্রো সুরক্ষায় নিরাপদে কিনুন BikriKoro-তে।" />
        <link rel="canonical" href="https://bikrikoro.com/products" />
      </Helmet>

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="পণ্য খুঁজুন..."
          className="flex-1 rounded-lg border border-outline px-4 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
        />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortOption)}
          className="rounded-lg border border-outline px-3 py-2.5 text-sm text-ink-600 outline-none focus:border-brand-500"
        >
          <option value="newest">নতুন আগে</option>
          <option value="price_asc">দাম: কম থেকে বেশি</option>
          <option value="price_desc">দাম: বেশি থেকে কম</option>
        </select>
      </div>

      <CategoryPills categories={categories} selectedId={categoryId} onSelect={handleCategorySelect} />

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {loading
          ? Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="aspect-[3/4] animate-pulse rounded-xl bg-outline/40" />
            ))
          : products.map((product) => <ProductCard key={product.id} product={product} />)}
      </div>

      {!loading && products.length === 0 && (
        <p className="mt-10 text-center text-ink-600">কোনো পণ্য পাওয়া যায়নি।</p>
      )}
    </Layout>
  )
}
