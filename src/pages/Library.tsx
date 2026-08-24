import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Layout } from '@/components/Layout'
import { useAuth } from '@/context/AuthContext'
import { loadDigitalLibrary, type DigitalLibraryItem } from '@/lib/marketplace'
import { formatDate, formatTaka } from '@/lib/format'

export default function Library() {
  const { user } = useAuth()
  const [items, setItems] = useState<DigitalLibraryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    loadDigitalLibrary(user.uid)
      .then(setItems)
      .catch((err) => {
        console.error('digital library load failed:', err)
        setError('ডিজিটাল লাইব্রেরি লোড করা যায়নি। কিছুক্ষণ পরে আবার চেষ্টা করুন।')
      })
      .finally(() => setLoading(false))
  }, [user])

  return (
    <Layout wide>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink-900">ডিজিটাল লাইব্রেরি</h1>
          <p className="mt-1 text-sm text-ink-600">আপনার কেনা ডিজিটাল পণ্য ও ডেলিভারি তথ্য এখানে থাকবে।</p>
        </div>
        <Link to="/orders" className="rounded-lg border border-outline px-3 py-2 text-sm font-medium text-ink-600 hover:border-brand-500 hover:text-brand-600">
          অর্ডার দেখুন
        </Link>
      </div>

      {error && <p className="mt-5 rounded-xl bg-error/10 p-4 text-sm text-error">{error}</p>}
      {loading ? (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {[1, 2].map((item) => <div key={item} className="h-40 animate-pulse rounded-2xl bg-outline/40" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-outline bg-surface p-10 text-center">
          <p className="font-medium text-ink-900">এখনো কোনো ডিজিটাল পণ্য নেই।</p>
          <p className="mt-2 text-sm text-ink-600">ডিজিটাল পণ্য কিনলে পেমেন্ট সম্পন্ন হওয়ার পর তা এখানে দেখা যাবে।</p>
          <Link to="/products?digital=digital" className="mt-5 inline-flex rounded-xl bg-brand-500 px-5 py-3 text-sm font-semibold text-white hover:bg-brand-600">
            ডিজিটাল পণ্য ব্রাউজ করুন
          </Link>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {items.map((item) => (
            <article key={item.order_id} className="rounded-2xl border border-outline bg-surface p-4">
              <div className="flex gap-3">
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-outline/30">
                  {item.product_image && <img src={item.product_image} alt="" className="h-full w-full object-cover" />}
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="line-clamp-2 font-semibold text-ink-900">{item.product_title}</h2>
                  <p className="mt-1 text-xs text-ink-300">কেনা হয়েছে {formatDate(item.purchased_at)} · {formatTaka(item.price)}</p>
                </div>
              </div>
              <div className={`mt-4 rounded-xl p-4 text-sm ${item.delivery_status === 'READY' ? 'bg-brand-50 text-brand-800' : item.delivery_status === 'REVOKED' ? 'bg-error/10 text-error' : 'bg-bg text-ink-600'}`}>
                {item.delivery_status === 'READY' && item.delivery_text ? (
                  <>
                    <p className="font-semibold">ডেলিভারি প্রস্তুত</p>
                    <p className="mt-2 whitespace-pre-wrap break-words leading-relaxed">{item.delivery_text}</p>
                    <p className="mt-3 text-xs opacity-80">এই তথ্য কপি বা শেয়ার করার আগে বিক্রেতার শর্ত যাচাই করুন।</p>
                  </>
                ) : item.delivery_status === 'REVOKED' ? (
                  <p>এই ডেলিভারি সাময়িকভাবে বন্ধ আছে। সহায়তার জন্য অর্ডার বিস্তারিত দেখুন।</p>
                ) : (
                  <p>{item.auto_delivery_enabled !== false ? 'পেমেন্ট নিশ্চিত হয়েছে। অটো ডেলিভারি প্রস্তুত হলে তথ্য এখানে নিরাপদে দেখা যাবে।' : 'পেমেন্ট নিশ্চিত হয়েছে। এই লিস্টিংয়ে সেলার ম্যানুয়ালি ডেলিভারি সম্পন্ন করলে তথ্য এখানে দেখা যাবে।'}</p>
                )}
              </div>
              <Link to={`/orders/${item.order_id}`} className="mt-3 inline-flex text-sm font-semibold text-brand-600 hover:underline">
                অর্ডারের বিস্তারিত দেখুন →
              </Link>
            </article>
          ))}
        </div>
      )}
    </Layout>
  )
}
