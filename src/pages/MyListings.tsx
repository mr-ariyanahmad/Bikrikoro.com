import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { auth } from '@/lib/firebase'
import { useAuth } from '@/context/AuthContext'
import { Layout } from '@/components/Layout'
import { formatTaka } from '@/lib/format'
import { BrandedDialog, DialogButton } from '@/components/BrandedDialog'
import type { Product } from '@/types/product'

export default function MyListings() {
  const { user } = useAuth()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!user) return
    const { data, error } = await supabase.rpc('seller_list_products', { p_seller_id: user.uid })
    if (error) setMessage('আপনার লিস্টিং লোড করা যায়নি। কিছুক্ষণ পরে আবার চেষ্টা করুন।')
    setProducts((data ?? []) as Product[])
    setLoading(false)
  }, [user])

  useEffect(() => {
    load()
  }, [load])

  const handleDuplicate = async (product: Product) => {
    if (!user) return
    if (!product.is_digital) {
      setMessage('পুরনো তালিকাটি সংরক্ষিত আছে; নতুন করে কপি বা প্রকাশ করা যাবে না।')
      return
    }
    setDuplicatingId(product.id)
    setMessage(null)
    const idToken = await auth.currentUser?.getIdToken()
    if (!idToken) {
      setMessage('আপনার Firebase সেশন পাওয়া যায়নি। আবার লগইন করুন।')
      setDuplicatingId(null)
      return
    }
    const [contentResponse, optionsResponse] = await Promise.all([
      fetch('/api/seller-digital-content', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` }, body: JSON.stringify({ action: 'get', productId: product.id }) }),
      fetch('/api/seller-listing-options', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` }, body: JSON.stringify({ action: 'get', productId: product.id }) }),
    ])
    const contentPayload = await contentResponse.json().catch(() => ({})) as { content?: { delivery_type: 'INSTRUCTIONS' | 'LICENSE_KEY' | 'DOWNLOAD_LINK'; delivery_text: string }; error?: string }
    const optionsPayload = await optionsResponse.json().catch(() => ({})) as { options?: Record<string, unknown> | null; error?: string }
    const digitalContent = contentPayload.content
    if (!contentResponse.ok || !optionsResponse.ok) {
      setMessage(contentPayload.error || optionsPayload.error || 'ডিজিটাল তালিকার তথ্য পড়া যায়নি; কপি করা বন্ধ রাখা হয়েছে।')
      setDuplicatingId(null)
      return
    }
    const productResponse = await fetch('/api/seller-product', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ action: 'create', title: `${product.title} (কপি)`, description: product.description, price: product.price, originalPrice: product.original_price, categoryId: product.category_id, condition: product.condition, images: product.images, videoUrl: product.video_url ?? null }),
    })
    const productPayload = await productResponse.json().catch(() => ({})) as { productId?: string; error?: string }
    const newProductId = productPayload.productId
    if (!productResponse.ok || !newProductId) {
      setMessage(`লিস্টিং কপি করা যায়নি: ${productPayload.error || 'অজানা সমস্যা'}`)
      setDuplicatingId(null)
      return
    }
    if (digitalContent) {
      const saveResponse = await fetch('/api/seller-digital-content', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` }, body: JSON.stringify({ action: 'save', productId: newProductId, deliveryType: digitalContent.delivery_type, deliveryText: digitalContent.delivery_text }) })
      if (!saveResponse.ok) {
        await supabase.rpc('seller_archive_product', { p_seller_id: user.uid, p_product_id: newProductId })
        setMessage('লিস্টিং তৈরি হয়েছিল, কিন্তু ডিজিটাল ডেলিভারির তথ্য কপি হয়নি; নিরাপত্তার জন্য তালিকাটি সংরক্ষণ করা হয়েছে।')
        setDuplicatingId(null)
        return
      }
    }
    if (optionsPayload.options) {
      const options = optionsPayload.options as Record<string, unknown>
      const saveOptionsResponse = await fetch('/api/seller-listing-options', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` }, body: JSON.stringify({ action: 'save', productId: newProductId, specifications: options.specifications, autoDeliveryEnabled: options.auto_delivery_enabled, deactivateWhenOutOfStock: options.deactivate_when_out_of_stock, stockMode: options.stock_mode === 'KEY_POOL' ? 'UNLIMITED' : options.stock_mode, stockQuantity: options.stock_quantity, fulfillmentWindowMinutes: options.fulfillment_window_minutes, regionCode: options.region_code, subscriptionPeriod: options.subscription_period, warrantyPeriod: options.warranty_period, deliveryNote: options.delivery_note }) })
      if (!saveOptionsResponse.ok) {
        await supabase.rpc('seller_archive_product', { p_seller_id: user.uid, p_product_id: newProductId })
        setMessage('লিস্টিং তৈরি হয়েছিল, কিন্তু তালিকার অতিরিক্ত তথ্য কপি হয়নি; নিরাপত্তার জন্য তালিকাটি সংরক্ষণ করা হয়েছে।')
        setDuplicatingId(null)
        return
      }
    }
    const { data: createdProduct } = await supabase.rpc('seller_get_product', { p_seller_id: user.uid, p_product_id: newProductId })
    setProducts((prev) => [createdProduct as Product, ...prev])
    setMessage('লিস্টিং কপি হয়েছে। সম্পাদনা করে প্রকাশের আগে তথ্য যাচাই করুন।')
    setDuplicatingId(null)
  }

  const handleDelete = async (productId: string) => {
    if (!user) return
    setDeletingId(productId)
    const { error } = await supabase.rpc('seller_archive_product', { p_seller_id: user.uid, p_product_id: productId })
    if (error) {
      setMessage(`লিস্টিং সংরক্ষণ করা যায়নি: ${error.message}`)
    } else {
      setProducts((prev) => prev.map((product) => product.id === productId ? { ...product, is_hidden: true } : product))
      setMessage('লিস্টিং সংরক্ষণ করা হয়েছে। এটি ক্রেতাদের তালিকায় আর দেখা যাবে না।')
    }
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

      {message && <p className="mt-4 rounded-xl bg-brand-50 p-3 text-sm text-brand-700">{message}</p>}
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
                <span className={`mt-1 inline-flex w-fit rounded-full px-2 py-0.5 text-[10px] font-semibold ${product.approval_status === 'APPROVED' ? 'bg-brand-50 text-brand-700' : product.approval_status === 'REJECTED' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>{product.approval_status === 'APPROVED' ? 'এডমিন অনুমোদিত' : product.approval_status === 'REJECTED' ? 'এডমিন বাতিল করেছে' : 'এডমিনের অনুমোদন বাকি'}</span>
                  {product.is_hidden && <span className="mt-1 inline-flex w-fit rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">আর্কাইভ করা</span>}
                  {product.approval_status === 'REJECTED' && product.approval_note && <p className="mt-1 line-clamp-2 text-xs text-red-600">কারণ: {product.approval_note}</p>}
              </div>
              <div className="flex shrink-0 flex-col gap-1.5">
                <Link
                  to={`/sell/${product.id}`}
                  className="rounded-lg border border-outline px-3 py-1.5 text-center text-xs font-medium text-ink-600 hover:border-brand-500 hover:text-brand-600"
                >
                  এডিট
                </Link>
                <button
                  onClick={() => void handleDuplicate(product)}
                  disabled={duplicatingId === product.id || !product.is_digital}
                  className="border border-outline px-3 py-1.5 text-base font-medium text-brand-600 hover:border-brand-500 disabled:opacity-50"
                >
                  {duplicatingId === product.id ? '...' : product.is_digital ? 'কপি' : 'সংরক্ষিত'}
                </button>
                <button
                  onClick={() => setDeleteTarget(product)}
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
      <BrandedDialog open={Boolean(deleteTarget)} title="লিস্টিং মুছে ফেলবেন?" tone="danger" onClose={() => setDeleteTarget(null)} actions={<><DialogButton onClick={() => setDeleteTarget(null)} variant="outline">বাতিল</DialogButton><DialogButton onClick={async () => { if (deleteTarget) { await handleDelete(deleteTarget.id); setDeleteTarget(null) } }} tone="danger">মুছে ফেলুন</DialogButton></>}><p>এই তালিকা আর ফিরিয়ে আনা যাবে না। ক্রেতাদের সামনে এটি আর দেখা যাবে না।</p></BrandedDialog>
    </Layout>
  )
}
