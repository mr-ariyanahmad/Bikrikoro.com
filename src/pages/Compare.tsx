import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Layout } from '@/components/Layout'
import { supabase } from '@/lib/supabase'
import { formatTaka } from '@/lib/format'
import { getComparedProductIds, removeCompared } from '@/lib/compare'
import type { Product } from '@/types/product'

const rows: Array<{ label: string; get: (product: Product) => string }> = [
  { label: 'দাম', get: (product) => formatTaka(product.price) },
  { label: 'অবস্থা', get: (product) => (product.condition === 'NEW' ? 'নতুন' : 'ব্যবহৃত') },
  { label: 'ধরন', get: (product) => (product.is_digital ? 'ডিজিটাল' : 'ফিজিক্যাল') },
  { label: 'লোকেশন', get: (product) => product.location || 'প্রযোজ্য নয়' },
  { label: 'ভিউ', get: (product) => product.view_count.toLocaleString('bn-BD') },
]

export default function Compare() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const ids = getComparedProductIds()
      if (ids.length === 0) {
        setProducts([])
        setLoading(false)
        return
      }
      const { data } = await supabase.from('products').select('*').in('id', ids)
      if (!cancelled) {
        const byId = new Map((data ?? []).map((product) => [product.id, product as Product]))
        setProducts(ids.map((id) => byId.get(id)).filter((product): product is Product => Boolean(product)))
        setLoading(false)
      }
    }
    load()
    const refresh = () => load()
    window.addEventListener('bikrikoro:compare-changed', refresh)
    return () => {
      cancelled = true
      window.removeEventListener('bikrikoro:compare-changed', refresh)
    }
  }, [])

  const remove = (productId: string) => {
    removeCompared(productId)
    setProducts((current) => current.filter((product) => product.id !== productId))
  }

  return (
    <Layout wide>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink-900">পণ্য তুলনা</h1>
          <p className="mt-1 text-sm text-ink-600">সর্বোচ্চ তিনটি পণ্যের দাম ও বৈশিষ্ট্য একসাথে দেখুন।</p>
        </div>
        <Link to="/products" className="rounded-lg border border-outline px-3 py-2 text-sm font-medium text-ink-600 hover:border-brand-500 hover:text-brand-600">
          আরও পণ্য খুঁজুন
        </Link>
      </div>

      {loading ? (
        <div className="mt-8 h-64 animate-pulse rounded-2xl bg-outline/40" />
      ) : products.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-outline bg-surface p-10 text-center">
          <p className="font-medium text-ink-900">তুলনা করার জন্য কোনো পণ্য বাছাই করা হয়নি।</p>
          <p className="mt-2 text-sm text-ink-600">পণ্যের কার্ডে “তুলনা” চাপলে সেগুলো এখানে দেখা যাবে।</p>
          <Link to="/products" className="mt-5 inline-flex rounded-xl bg-brand-500 px-5 py-3 text-sm font-semibold text-white hover:bg-brand-600">
            প্রোডাক্ট ব্রাউজ করুন
          </Link>
        </div>
      ) : (
        <div className="mt-8 overflow-x-auto rounded-2xl border border-outline bg-surface">
          <table className="min-w-[620px] w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-outline">
                <th className="w-32 p-4 font-medium text-ink-600">বৈশিষ্ট্য</th>
                {products.map((product) => (
                  <th key={product.id} className="min-w-[180px] p-4 align-top font-medium text-ink-900">
                    <div className="relative">
                      <button onClick={() => remove(product.id)} className="absolute right-0 top-0 text-ink-300 hover:text-error" aria-label="তুলনা থেকে সরান">
                        ✕
                      </button>
                      <Link to={`/products/${product.id}`} className="block pr-5 hover:text-brand-600">
                        <div className="mb-3 aspect-square overflow-hidden rounded-xl bg-outline/30">
                          {product.images[0] && <img src={product.images[0]} alt="" className="h-full w-full object-cover" />}
                        </div>
                        <span className="line-clamp-2">{product.title}</span>
                      </Link>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label} className="border-b border-outline last:border-0">
                  <th className="p-4 font-medium text-ink-600">{row.label}</th>
                  {products.map((product) => (
                    <td key={product.id} className="p-4 text-ink-900">{row.get(product)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Layout>
  )
}
