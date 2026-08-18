import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Layout } from '@/components/Layout'
import { auth } from '@/lib/firebase'
import { useAuth } from '@/context/AuthContext'
import { confirmOrderDelivery, buyerCancelOrder, sellerMarkPreparing, sellerMarkShipped, sellerMarkDelivered, sellerCancelOrder } from '@/lib/orders'
import { formatDate, formatTaka } from '@/lib/format'
import { ReportDisputeModal } from '@/components/ReportDisputeModal'
import { ReviewModal } from '@/components/ReviewModal'
import type { Order, OrderStatus } from '@/types/order'

const STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING_PAYMENT: 'পেমেন্ট বাকি',
  ESCROW_HELD: 'এসক্রোতে সুরক্ষিত',
  PREPARING: 'প্রস্তুত করা হচ্ছে',
  SHIPPED: 'পাঠানো হয়েছে',
  DELIVERED: 'পৌঁছে গেছে',
  COMPLETED: 'অর্ডার সম্পন্ন',
  CANCELLED: 'বাতিল',
}

const TIMELINE: OrderStatus[] = ['PENDING_PAYMENT', 'ESCROW_HELD', 'PREPARING', 'SHIPPED', 'DELIVERED', 'COMPLETED']

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const [order, setOrder] = useState<Order | null>(null)
  const [reviewed, setReviewed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)
  const [showDispute, setShowDispute] = useState(false)
  const [showReview, setShowReview] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    if (!id || !user) return
    let cancelled = false

    async function loadOrder() {
      try {
        const idToken = await auth.currentUser?.getIdToken()
        if (!idToken) throw new Error('আপনার Firebase session পাওয়া যায়নি।')
        const response = await fetch('/api/order-read', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
          body: JSON.stringify({ action: 'detail', orderId: id }),
        })
        const payload = await response.json().catch(() => ({})) as { error?: string; order?: Order | null; reviewed?: boolean }
        if (!response.ok || !payload.order) throw new Error(payload.error || 'অর্ডারটি পাওয়া যায়নি বা দেখার অনুমতি নেই।')
        if (cancelled) return
        setOrder(payload.order)
        setReviewed(payload.reviewed === true)
      } catch (loadError) {
        console.error('Order detail load failed:', loadError)
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'অর্ডারটি লোড করা যায়নি।')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadOrder()
    return () => {
      cancelled = true
    }
  }, [id, user])

  const showToast = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(null), 3000)
  }

  const run = async (action: () => Promise<void>, success: string) => {
    setProcessing(true)
    try {
      await action()
      showToast(success)
      if (id) {
        const idToken = await auth.currentUser?.getIdToken()
        if (!idToken) throw new Error('আপনার Firebase session পাওয়া যায়নি।')
        const response = await fetch('/api/order-read', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` }, body: JSON.stringify({ action: 'detail', orderId: id }) })
        const payload = await response.json().catch(() => ({})) as { error?: string; order?: Order | null; reviewed?: boolean }
        if (!response.ok || !payload.order) throw new Error(payload.error || 'অর্ডারটি আবার লোড করা যায়নি।')
        setOrder(payload.order)
        setReviewed(payload.reviewed === true)
      }
    } catch (err) {
      console.error('order action failed:', err)
      showToast(err instanceof Error ? err.message : 'কাজটি সম্পন্ন করা যায়নি। আবার চেষ্টা করুন।')
    } finally {
      setProcessing(false)
    }
  }

  if (loading) {
    return (
      <Layout backFallback="/orders" backLabel="অর্ডারে ফিরুন">
        <div className="h-96 animate-pulse rounded-2xl bg-outline/40" />
      </Layout>
    )
  }

  if (error || !order || !user) {
    return (
      <Layout backFallback="/orders" backLabel="অর্ডারে ফিরুন">
        <div className="rounded-2xl border border-outline bg-surface p-8 text-center">
          <p className="text-ink-600">{error ?? 'অর্ডারটি পাওয়া যায়নি।'}</p>
        </div>
      </Layout>
    )
  }

  const isBuyer = order.buyer_id === user.uid
  const isSeller = order.seller_id === user.uid
  const currentIndex = TIMELINE.indexOf(order.status)

  return (
    <Layout backFallback="/orders" backLabel="অর্ডারে ফিরুন">
      <div className="flex items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-xl font-semibold text-ink-900">অর্ডারের বিস্তারিত</h1>
        </div>
        <button type="button" onClick={() => window.print()} className="rounded-lg border border-outline px-3 py-2 text-sm font-medium text-ink-600 hover:border-brand-500 hover:text-brand-600">
          রসিদ প্রিন্ট করুন
        </button>
      </div>

      <div className="mt-6 rounded-2xl border border-outline bg-surface p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs text-ink-300">অর্ডার নম্বর</p>
            <p className="mt-1 break-all font-mono text-sm text-ink-900">{order.id}</p>
          </div>
          <span className={`rounded-full px-3 py-1.5 text-sm font-semibold ${order.status === 'CANCELLED' ? 'bg-error/10 text-error' : 'bg-brand-50 text-brand-700'}`}>
            {STATUS_LABEL[order.status]}
          </span>
        </div>

        <div className="mt-6 flex items-start">
          {TIMELINE.map((status, index) => {
            const done = order.status !== 'CANCELLED' && currentIndex >= index
            return (
              <div key={status} className="flex min-w-0 flex-1 items-start">
                <div className="flex min-w-0 flex-col items-center text-center">
                  <span className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${done ? 'bg-brand-500 text-white' : 'bg-outline text-ink-600'}`}>
                    {done ? '✓' : index + 1}
                  </span>
                  <span className="mt-2 text-[10px] leading-tight text-ink-600 sm:text-xs">{STATUS_LABEL[status]}</span>
                </div>
                {index < TIMELINE.length - 1 && <div className={`mt-4 h-0.5 flex-1 ${done && currentIndex > index ? 'bg-brand-500' : 'bg-outline'}`} />}
              </div>
            )
          })}
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-outline bg-surface p-5">
        <div className="flex gap-3">
          {order.product_id ? (
            <Link to={`/products/${order.product_id}`} className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-outline/30">
              {order.product_image && <img src={order.product_image} alt="" className="h-full w-full object-cover" />}
            </Link>
          ) : (
            <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-outline/30">
              {order.product_image && <img src={order.product_image} alt="" className="h-full w-full object-cover" />}
            </div>
          )}
          <div className="min-w-0 flex-1">
            {order.product_id ? (
              <Link to={`/products/${order.product_id}`} className="font-semibold text-ink-900 hover:text-brand-600">
                {order.product_title}
              </Link>
            ) : (
              <p className="font-semibold text-ink-900">{order.product_title}</p>
            )}
            <p className="mt-1 text-sm text-ink-600">অর্ডার করা হয়েছে {formatDate(order.created_at)}</p>
            <p className="mt-1 text-xs text-ink-300">পরিমাণ: {order.quantity}</p>
          </div>
        </div>

        <div className="mt-5 space-y-2 rounded-xl bg-bg p-4 text-sm">
          <div className="flex justify-between text-ink-600"><span>পণ্যের দাম</span><span>{formatTaka(order.price)}</span></div>
          <div className="flex justify-between text-ink-600"><span>এসক্রো ফি</span><span>{formatTaka(order.escrow_fee)}</span></div>
          <div className="flex justify-between border-t border-outline pt-2 font-bold text-ink-900"><span>মোট</span><span>{formatTaka(order.price + order.escrow_fee)}</span></div>
        </div>

        <div className="mt-4 rounded-xl border border-outline p-4 text-sm">
          <p className="font-medium text-ink-900">ডেলিভারি তথ্য</p>
          <p className="mt-1 leading-relaxed text-ink-600">{order.delivery_address}</p>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 print:hidden">
          {isBuyer && order.status === 'ESCROW_HELD' && (
            <ActionButton label="অর্ডার বাতিল করুন" variant="danger" loading={processing} onClick={() => run(() => buyerCancelOrder(order.id, user.uid), 'অর্ডার বাতিলের অনুরোধ পাঠানো হয়েছে।')} />
          )}
          {isBuyer && order.status === 'DELIVERED' && (!order.dispute_status || order.dispute_status === 'RESOLVED_DENIED') && <ActionButton label="পণ্য পেয়েছি — নিশ্চিত করুন" variant="primary" loading={processing} onClick={() => run(() => confirmOrderDelivery(order.id, user.uid), 'ডেলিভারি নিশ্চিত হয়েছে।')} />}
          {isBuyer && ['SHIPPED', 'DELIVERED'].includes(order.status) && (!order.dispute_status || order.dispute_status === 'RESOLVED_DENIED') && <ActionButton label="পাইনি/সমস্যা রিপোর্ট করুন" variant="outline" onClick={() => setShowDispute(true)} />}
          {isBuyer && order.status === 'COMPLETED' && !reviewed && <ActionButton label="রিভিউ দিন" variant="outline" onClick={() => setShowReview(true)} />}
          {isSeller && order.status === 'ESCROW_HELD' && <ActionButton label="প্রস্তুতি শুরু করুন" variant="primary" loading={processing} onClick={() => run(() => sellerMarkPreparing(order.id, user.uid), 'অর্ডার প্রস্তুত করা শুরু হয়েছে।')} />}
          {isSeller && order.status === 'PREPARING' && <ActionButton label="শিপড মার্ক করুন" variant="primary" loading={processing} onClick={() => run(() => sellerMarkShipped(order.id, user.uid), 'অর্ডারটি শিপড হিসেবে চিহ্নিত হয়েছে।')} />}
          {isSeller && order.status === 'SHIPPED' && <ActionButton label="ডেলিভার্ড মার্ক করুন" variant="primary" loading={processing} onClick={() => run(() => sellerMarkDelivered(order.id, user.uid), 'অর্ডারটি ডেলিভার্ড হিসেবে চিহ্নিত হয়েছে।')} />}
          {isSeller && ['ESCROW_HELD', 'PREPARING', 'SHIPPED'].includes(order.status) && <ActionButton label="অর্ডার বাতিল করুন" variant="danger" loading={processing} onClick={() => run(() => sellerCancelOrder(order.id, user.uid), 'অর্ডার বাতিল হয়েছে।')} />}
        </div>
      </div>

      {showDispute && <ReportDisputeModal orderId={order.id} buyerId={user.uid} onClose={() => setShowDispute(false)} onSuccess={() => { setShowDispute(false); showToast('রিপোর্ট জমা হয়েছে।') }} />}
      {showReview && <ReviewModal order={order} buyerName={user.displayName ?? ''} onClose={() => setShowReview(false)} onSuccess={() => { setShowReview(false); setReviewed(true); showToast('রিভিউ জমা হয়েছে।') }} />}
      {toast && <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-ink-900 px-4 py-3 text-sm text-white shadow-lg print:hidden">{toast}</div>}
    </Layout>
  )
}

function ActionButton({ label, variant, loading, onClick }: { label: string; variant: 'primary' | 'outline' | 'danger'; loading?: boolean; onClick: () => void }) {
  const styles = {
    primary: 'bg-brand-500 text-white hover:bg-brand-600',
    outline: 'border border-outline text-ink-600 hover:border-brand-500 hover:text-brand-600',
    danger: 'border border-error/40 text-error hover:bg-error/5',
  }[variant]
  return <button type="button" onClick={onClick} disabled={loading} className={`rounded-lg px-3 py-1.5 text-sm font-medium transition disabled:opacity-50 ${styles}`}>{loading ? '...' : label}</button>
}
