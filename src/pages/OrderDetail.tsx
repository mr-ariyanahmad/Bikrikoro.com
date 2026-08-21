import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'
import { Layout } from '@/components/Layout'
import { auth } from '@/lib/firebase'
import { useAuth } from '@/context/AuthContext'
import { confirmDigitalDelivery, buyerCancelOrder, sellerDeliverDigital, sellerCancelOrder } from '@/lib/orders'
import { formatDate, formatTaka } from '@/lib/format'
import { formatOrderNumber } from '@/lib/orderNumber'
import { ReportDisputeModal } from '@/components/ReportDisputeModal'
import { ReviewModal } from '@/components/ReviewModal'
import type { Order, OrderStatus } from '@/types/order'

type DeliveryInfo = { order_id: string; delivery_type: string; delivery_text: string; status: 'PENDING' | 'READY' | 'REVOKED'; delivered_at: string | null; updated_at: string }

const STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING_PAYMENT: 'পেমেন্ট বাকি',
  ESCROW_HELD: 'এসক্রোতে সুরক্ষিত',
  PREPARING: 'পুরনো physical status',
  SHIPPED: 'পুরনো physical status',
  DELIVERED: 'পুরনো physical status',
  DIGITAL_DELIVERED: 'ডিজিটাল ডেলিভারি প্রস্তুত',
  COMPLETED: 'অর্ডার সম্পন্ন',
  CANCELLED: 'বাতিল',
  DISPUTED: 'ডিসপিউট পর্যালোচনাধীন',
  REFUNDED: 'রিফান্ড সম্পন্ন',
}

const TIMELINE: OrderStatus[] = ['PENDING_PAYMENT', 'ESCROW_HELD', 'DIGITAL_DELIVERED', 'COMPLETED']

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const [order, setOrder] = useState<Order | null>(null)
  const [delivery, setDelivery] = useState<DeliveryInfo | null>(null)
  const [reviewed, setReviewed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)
  const [showDispute, setShowDispute] = useState(false)
  const [showReview, setShowReview] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const loadOrder = useCallback(async () => {
    if (!id || !user) return
    const idToken = await auth.currentUser?.getIdToken()
    if (!idToken) throw new Error('আপনার Firebase session পাওয়া যায়নি।')
    const response = await fetch('/api/order-read', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` }, body: JSON.stringify({ action: 'detail', orderId: id }) })
    const payload = await response.json().catch(() => ({})) as { error?: string; order?: Order | null; delivery?: DeliveryInfo | null; reviewed?: boolean }
    if (!response.ok || !payload.order) throw new Error(payload.error || 'অর্ডারটি পাওয়া যায়নি বা দেখার অনুমতি নেই।')
    setOrder(payload.order)
    setDelivery(payload.delivery ?? null)
    setReviewed(payload.reviewed === true)
  }, [id, user])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      try {
        await loadOrder()
      } catch (loadError) {
        console.error('Order detail load failed:', loadError)
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'অর্ডারটি লোড করা যায়নি।')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void run()
    return () => { cancelled = true }
  }, [loadOrder])

  const showToast = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(null), 3000)
  }

  const runAction = async (action: () => Promise<void>, success: string) => {
    setProcessing(true)
    try {
      await action()
      await loadOrder()
      showToast(success)
    } catch (actionError) {
      console.error('Order action failed:', actionError)
      showToast(actionError instanceof Error ? actionError.message : 'কাজটি সম্পন্ন করা যায়নি। আবার চেষ্টা করুন।')
    } finally {
      setProcessing(false)
    }
  }

  if (loading) return <Layout><div className="h-96 animate-pulse bg-outline/40" /></Layout>

  if (error || !order || !user) return <Layout><div className="border border-outline bg-surface p-8 text-center"><p className="text-ink-700">{error ?? 'অর্ডারটি পাওয়া যায়নি।'}</p></div></Layout>

  const readableOrderNumber = formatOrderNumber(order.order_number, order.id)
  const isBuyer = order.buyer_id === user.uid
  const isSeller = order.seller_id === user.uid
  const currentIndex = TIMELINE.indexOf(order.status)
  const openDispute = order.dispute_status === 'REPORTED' || order.dispute_status === 'UNDER_REVIEW'
  const legacyPhysical = ['PREPARING', 'SHIPPED', 'DELIVERED'].includes(order.status)

  return (
    <Layout>
      <div className="flex items-center justify-between gap-3 print:hidden"><h1 className="text-xl font-semibold text-ink-900">অর্ডারের বিস্তারিত</h1><button type="button" onClick={() => window.print()} className="border border-outline px-3 py-2 text-base font-medium text-ink-700 hover:border-brand-500 hover:text-brand-700">রসিদ প্রিন্ট করুন</button></div>

      <div className="mt-6 border border-outline bg-surface p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm text-ink-500">অর্ডার নম্বর</p><p className="mt-1 text-base font-semibold tracking-wide text-brand-700">{readableOrderNumber}</p></div><span className={`px-3 py-1.5 text-base font-semibold ${order.status === 'CANCELLED' || order.status === 'REFUNDED' ? 'bg-error/10 text-error' : 'bg-brand-50 text-brand-700'}`}>{STATUS_LABEL[order.status]}</span></div>
        {legacyPhysical ? <div className="mt-5 border border-outline bg-bg p-3 text-sm text-ink-700">এই পুরনো অর্ডারের ইতিহাস সংরক্ষিত আছে। নতুন অর্ডারগুলো ডিজিটাল পণ্যভিত্তিক।</div> : <div className="mt-6 flex items-start">{TIMELINE.map((status, index) => { const done = !['CANCELLED', 'REFUNDED', 'DISPUTED'].includes(order.status) && currentIndex >= index; return <div key={status} className="flex min-w-0 flex-1 items-start"><div className="flex min-w-0 flex-col items-center text-center"><span className={`flex h-8 w-8 items-center justify-center text-sm font-bold ${done ? 'bg-brand-500 text-white' : 'bg-outline text-ink-700'}`}>{done ? '✓' : index + 1}</span><span className="mt-2 text-xs leading-tight text-ink-700 sm:text-sm">{STATUS_LABEL[status]}</span></div>{index < TIMELINE.length - 1 && <div className={`mt-4 h-0.5 flex-1 ${done && currentIndex > index ? 'bg-brand-500' : 'bg-outline'}`} />}</div> })}</div>}
      </div>

      <div className="mt-4 border border-outline bg-surface p-5"><div className="flex gap-3"><Link to={`/products/${order.product_id}`} className="h-20 w-20 shrink-0 overflow-hidden bg-outline/30">{order.product_image && <img src={order.product_image} alt="" className="h-full w-full object-cover" />}</Link><div className="min-w-0 flex-1"><Link to={`/products/${order.product_id}`} className="font-semibold text-ink-900 hover:text-brand-700">{order.product_title}</Link><p className="mt-1 text-base text-ink-700">অর্ডার করা হয়েছে {formatDate(order.created_at)}</p><p className="mt-1 text-sm text-ink-500">পরিমাণ: {order.quantity}</p></div></div>
        <div className="mt-5 space-y-2 bg-bg p-4 text-base"><div className="flex justify-between text-ink-700"><span>পণ্যের দাম</span><span>{formatTaka(order.price)}</span></div><div className="flex justify-between text-ink-700"><span>এসক্রো ফি</span><span>{formatTaka(order.escrow_fee)}</span></div><div className="flex justify-between border-t border-outline pt-2 font-bold text-ink-900"><span>মোট</span><span>{formatTaka(order.price + order.escrow_fee)}</span></div></div>{order.delivery_email && <div className="mt-3 border border-brand-200 bg-brand-50 p-3 text-sm text-ink-700"><span className="font-semibold text-ink-900">ডেলিভারি ইমেইল:</span> {order.delivery_email}</div>}

        {!legacyPhysical && <div className="mt-4 border border-brand-200 bg-brand-50 p-4"><div className="flex items-start gap-3"><ShieldCheck size={20} className="mt-0.5 shrink-0 text-brand-600" /><div><p className="font-semibold text-ink-900">ডিজিটাল ডেলিভারি</p><p className="mt-1 text-sm leading-6 text-ink-700">{delivery?.status === 'READY' ? 'ডেলিভারি প্রস্তুত। প্রবেশাধিকার পেলে আপনি নিশ্চিত করতে পারবেন।' : delivery?.status === 'PENDING' ? 'পেমেন্ট যাচাই হয়েছে; বিক্রেতার ডিজিটাল ডেলিভারি প্রস্তুত হওয়ার অপেক্ষায় আছে।' : order.status === 'COMPLETED' ? 'এই অর্ডারের ডিজিটাল ডেলিভারি সম্পন্ন হয়েছে।' : 'নিরাপদ পেমেন্ট যাচাই শেষ হলে ডেলিভারির তথ্য তৈরি হবে।'}</p>{isBuyer && delivery?.status === 'READY' && delivery.delivery_text && <p className="mt-3 break-words whitespace-pre-wrap border-t border-brand-200 pt-3 text-sm text-brand-900">{delivery.delivery_text}</p>}</div></div></div>}

        <div className="mt-4 flex flex-wrap gap-2 print:hidden">{isBuyer && order.status === 'ESCROW_HELD' && <ActionButton label="অর্ডার বাতিল করুন" variant="danger" loading={processing} onClick={() => void runAction(() => buyerCancelOrder(order.id, user.uid), 'অর্ডার বাতিলের অনুরোধ পাঠানো হয়েছে।')} />}{isBuyer && order.status === 'DIGITAL_DELIVERED' && !openDispute && <ActionButton label="ডিজিটাল পণ্য পেয়েছি — নিশ্চিত করুন" variant="primary" loading={processing} onClick={() => void runAction(() => confirmDigitalDelivery(order.id, user.uid), 'ডিজিটাল ডেলিভারি নিশ্চিত হয়েছে।')} />}{isBuyer && ['ESCROW_HELD', 'DIGITAL_DELIVERED'].includes(order.status) && !openDispute && <ActionButton label="পাইনি/সমস্যা রিপোর্ট করুন" variant="outline" onClick={() => setShowDispute(true)} />}{isBuyer && order.status === 'COMPLETED' && !reviewed && <ActionButton label="রিভিউ দিন" variant="outline" onClick={() => setShowReview(true)} />}{isSeller && order.status === 'ESCROW_HELD' && <ActionButton label="ডিজিটাল ডেলিভারি দিন" variant="primary" loading={processing} onClick={() => void runAction(() => sellerDeliverDigital(order.id, user.uid), 'ডিজিটাল ডেলিভারি তৈরি হয়েছে।')} />}{isSeller && order.status === 'ESCROW_HELD' && <ActionButton label="অর্ডার বাতিল করুন" variant="danger" loading={processing} onClick={() => void runAction(() => sellerCancelOrder(order.id, user.uid), 'অর্ডার বাতিল হয়েছে।')} />}</div>
      </div>

      {showDispute && <ReportDisputeModal orderId={order.id} buyerId={user.uid} onClose={() => setShowDispute(false)} onSuccess={() => { setShowDispute(false); void loadOrder(); showToast('রিপোর্ট জমা হয়েছে।') }} />}
      {showReview && <ReviewModal order={order} buyerName={user.displayName ?? ''} onClose={() => setShowReview(false)} onSuccess={() => { setShowReview(false); setReviewed(true); showToast('রিভিউ জমা হয়েছে।') }} />}
      {toast && <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 bg-ink-900 px-4 py-3 text-base text-white shadow-lg print:hidden">{toast}</div>}
    </Layout>
  )
}

function ActionButton({ label, variant, loading, onClick }: { label: string; variant: 'primary' | 'outline' | 'danger'; loading?: boolean; onClick: () => void }) {
  const styles = { primary: 'bg-brand-500 text-white hover:bg-brand-600', outline: 'border border-outline text-ink-700 hover:border-brand-500 hover:text-brand-700', danger: 'border border-error/40 text-error hover:bg-error/5' }[variant]
  return <button type="button" onClick={onClick} disabled={loading} className={`px-3 py-1.5 text-base font-medium transition disabled:opacity-50 ${styles}`}>{loading ? '...' : label}</button>
}
