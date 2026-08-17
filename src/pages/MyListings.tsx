import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { Layout } from '@/components/Layout'
import { formatTaka } from '@/lib/format'
import type { Product } from '@/types/product'

export default function MyListings() {
  const { user } = useAuth()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('products')
      .select('*')
      .eq('seller_id', user.uid)
      .order('created_at', { ascending: false })
    setProducts(data ?? [])
    setLoading(false)
  }, [user])

  useEffect(() => {
    load()
  }, [load])

  const handleDuplicate = async (product: Product) => {
    if (!user) return
    setDuplicatingId(product.id)
    const { data, error } = await supabase
      .from('products')
      .insert({
        title: `${product.title} (কপি)`,
        description: product.description,
        price: product.price,
        original_price: product.original_price,
        images: product.images,
        category_id: product.category_id,
        condition: product.condition,
        location: product.location,
        is_digital: product.is_digital,
        seller_id: user.uid,
      })
      .select('*')
      .single()
    setDuplicatingId(null)
    if (error || !data) return
    setProducts((prev) => [data as Product, ...prev])
  }

  const handleDelete = async (productId: string) => {
    if (!confirm('এই লিস্টিংটি মুছে ফেলবেন? এটি আর ফিরিয়ে আনা যাবে না।')) return
    setDeletingId(productId)
    await supabase.from('products').delete().eq('id', productId)
    setProducts((prev) => prev.filter((p) => p.id !== productId))
    setDeletingId(null)
  }

  return (
    <Layout>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-ink-900">আমার লিস্টিং</h1>
        <div className="flex gap-2">
          <Link
            to="/seller/dashboard"
            className="rounded-lg border border-outline px-4 py-2 text-sm font-medium text-ink-600 hover:border-brand-500 hover:text-brand-600"
          >
            ড্যাশবোর্ড
          </Link>
          <Link
            to="/sell"
            className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600"
          >
            + নতুন পণ্য
          </Link>
        </div>
      </div>

      <div className="mt-6 space-y-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-outline/40" />
          ))
        ) : products.length === 0 ? (
          <div className="rounded-2xl border border-outline bg-surface p-8 text-center">
            <p className="text-ink-600">আপনার কোনো লিস্টিং নেই এখনো।</p>
            <Link to="/sell" className="mt-2 inline-block text-sm font-medium text-brand-600">
              প্রথম পণ্য পোস্ট করুন →
            </Link>
          </div>
        ) : (
          products.map((product) => (
            <div
              key={product.id}
              className="flex items-center gap-3 rounded-xl border border-outline bg-surface p-3"
            >
              <Link to={`/products/${product.id}`} className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-outline/30">
                {product.images[0] && (
                  <img src={product.images[0]} alt="" className="h-full w-full object-cover" />
                )}
              </Link>
              <div className="min-w-0 flex-1">
                <Link to={`/products/${product.id}`} className="line-clamp-1 text-sm font-medium text-ink-900">
                  {product.title}
                </Link>
                <p className="tabular-amount mt-0.5 text-sm text-brand-600">{formatTaka(product.price)}</p>
                <p className="mt-0.5 text-xs text-ink-300">{product.view_count} বার দেখা হয়েছে</p>
              </div>
              <div className="flex shrink-0 flex-col gap-1.5">
                <Link
                  to={`/sell/${product.id}`}
                  className="rounded-lg border border-outline px-3 py-1.5 text-center text-xs font-medium text-ink-600 hover:border-brand-500 hover:text-brand-600"
                >
                  এডিট
                </Link>
                <button
                  onClick={() => handleDuplicate(product)}
                  disabled={duplicatingId === product.id}
                  className="rounded-lg border border-outline px-3 py-1.5 text-xs font-medium text-brand-600 hover:border-brand-500 disabled:opacity-50"
                >
                  {duplicatingId === product.id ? '...' : 'কপি'}
                </button>
                <button
                  onClick={() => handleDelete(product.id)}
                  disabled={deletingId === product.id}
                  className="rounded-lg border border-outline px-3 py-1.5 text-xs font-medium text-error hover:border-error disabled:opacity-50"
                >
                  {deletingId === product.id ? '...' : 'মুছুন'}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </Layout>
  )
}
