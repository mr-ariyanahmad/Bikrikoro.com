import { useEffect, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { Layout } from '@/components/Layout'
import { ProductCard } from '@/components/ProductCard'
import type { Product } from '@/types/product'

export default function Favorites() {
  const { user } = useAuth()
  const uid = user!.uid
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: favs } = await supabase.from('favorites').select('product_id').eq('user_id', uid)
      const ids = (favs ?? []).map((f) => f.product_id)
      if (ids.length === 0) {
        setProducts([])
        setLoading(false)
        return
      }
      const { data } = await supabase.from('products').select('*').in('id', ids)
      setProducts(data ?? [])
      setLoading(false)
    }
    load()
  }, [uid])

  return (
    <Layout wide>
      <Helmet>
        <title>পছন্দের তালিকা | BikriKoro.Com</title>
      </Helmet>

      <h1 className="text-xl font-semibold text-ink-900">পছন্দের তালিকা</h1>

      <div className="mt-6">
        {loading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-[3/4] animate-pulse rounded-xl bg-outline/40" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="rounded-2xl border border-outline bg-surface p-8 text-center text-ink-600">
            এখনো কিছু পছন্দের তালিকায় যোগ করেননি। পণ্যের ছবিতে ♡ চাপুন।
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}
