import { useCallback, useEffect, useMemo, useState } from 'react'
import { Search, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { auth } from '@/lib/firebase'
import { useAuth } from '@/context/AuthContext'
import { Layout } from '@/components/Layout'
import { BrandSelect } from '@/components/BrandSelect'
import { ReportDisputeModal } from '@/components/ReportDisputeModal'
import { BrandedDialog, DialogButton } from '@/components/BrandedDialog'
import { ReviewModal } from '@/components/ReviewModal'
import { buyerCancelOrder, confirmDigitalDelivery, sellerCancelOrder, sellerDeliverDigital } from '@/lib/orders'
import { startUddoktaPayCheckout, cancelPendingOrder } from '@/lib/payments'
import { formatTaka, formatDate } from '@/lib/format'
import type { Order, OrderStatus } from '@/types/order'

type Tab = 'buying' | 'selling'
type DeliveryInfo = { order_id: string; delivery_type: string; delivery_text: string; status: 'PENDING' | 'READY' | 'REVOKED'; delivered_at: string | null; updated_at: string }

const STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING_PAYMENT: 'পেমেন্ট বাকি',
  ESCROW_HELD: 'এসক্রোতে',
  PREPARING: 'পুরনো physical status',
  SHIPPED: 'পুরনো physical status',
  DELIVERED: 'পুরনো physical status',
  DIGITAL_DELIVERED: 'ডিজিটাল ডেলিভারি প্রস্তুত',
  COMPLETED: 'সম্পন্ন',
  CANCELLED: 'বাতিল',
  DISPUTED: 'ডিসপিউট পর্যালোচনাধীন',
  REFUNDED: 'রিফান্ড সম্পন্ন',
}

export default function Orders() {
  const { user } = useAuth()
  const uid = user!.uid
  const [tab, setTab] = useState<Tab>('buying')
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'ALL'>('ALL')
  const [orderQuery, setOrderQuery] = useState('')
  const [orders, setOrders] = useState<Order[]>([])
  const [deliveries, setDeliveries] = useState<Map<string, DeliveryInfo>>(new Map())
  const [reviewedOrderIds, setReviewedOrderIds] = useState<Set<string>>(new Set())
  const [disputeIdByOrder, setDisputeIdByOrder] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [disputeTarget, setDisputeTarget] = useState<Order | null>(null)
  const [reviewTarget, setReviewTarget] = useState<Order | null>(null)
  const [sellerCancelTarget, setSellerCancelTarget] = useState<Order | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const idToken = await auth.currentUser?.getIdToken()
      if (!idToken) throw new Error('আপনার Firebase session পাওয়া যায়নি।')
      const response = await fetch('/api/order-read', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` }, body: JSON.stringify({ action: 'list' }) })
      const payload = await response.json().catch(() => ({})) as { error?: string; orders?: Order[]; deliveries?: DeliveryInfo[]; reviewedOrderIds?: string[]; disputes?: Array<{ id: string; order_id: string }> }
      if (!response.ok) throw new Error(payload.error || `Order load failed (HTTP ${response.status})`)
      setOrders(payload.orders ?? [])
      setDeliveries(new Map((payload.deliveries ?? []).map((delivery) => [delivery.order_id, delivery])))
      setReviewedOrderIds(new Set(payload.reviewedOrderIds ?? []))
      setDisputeIdByOrder(new Map((payload.disputes ?? []).map((dispute) => [dispute.order_id, dispute.id])))
    } catch (loadOrderError) {
      console.error('Orders load failed:', loadOrderError)
      setLoadError(loadOrderError instanceof Error ? loadOrderError.message : 'অর্ডার লোড করা যায়নি।')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    const channel = supabase.channel(`orders-${uid}`).on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => { void load() }).subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [uid, load])

  const showToast = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(null), 3500)
  }

  const runAction = async (orderId: string, action: () => Promise<void>) => {
    setProcessingId(orderId)
    try {
      await action()
      await load()
    } catch (actionError) {
      showToast(actionError instanceof Error ? actionError.message : 'কাজটি সম্পন্ন করা যায়নি — আবার চেষ্টা করুন।')
    } finally {
      setProcessingId(null)
    }
  }

  const buying = orders.filter((order) => order.buyer_id === uid)
  const selling = orders.filter((order) => order.seller_id === uid)
  const source = tab === 'buying' ? buying : selling
  const list = useMemo(() => source.filter((order) => (statusFilter === 'ALL' || order.status === statusFilter) && (!orderQuery.trim() || order.product_title.toLowerCase().includes(orderQuery.trim().toLowerCase()))), [source, statusFilter, orderQuery])
  const activeCount = source.filter((order) => !['COMPLETED', 'CANCELLED', 'REFUNDED'].includes(order.status)).length

  return (
    <Layout wide>
      <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm font-semibold text-brand-700">Escrow-protected digital orders</p><h1 className="mt-1 text-xl font-semibold text-ink-900">আমার অর্ডার</h1><p className="mt-1 text-base text-ink-600">{activeCount}টি চলমান অর্ডার</p></div><div className="bg-brand-50 px-3 py-2 text-base font-semibold text-brand-700">মোট {orders.length}টি</div></div>

      <div className="mt-4 flex border border-outline p-1"><button type="button" onClick={() => setTab('buying')} className={`flex-1 py-2 text-base font-medium ${tab === 'buying' ? 'bg-brand-500 text-white' : 'text-ink-700'}`}>কিনেছি</button><button type="button" onClick={() => setTab('selling')} className={`flex-1 py-2 text-base font-medium ${tab === 'selling' ? 'bg-brand-500 text-white' : 'text-ink-700'}`}>বিক্রি করেছি</button></div>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row"><label className="relative flex-1"><Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" /><input value={orderQuery} onChange={(event) => setOrderQuery(event.target.value)} placeholder="digital product নামে অর্ডার খুঁজুন..." className="w-full border border-outline py-2.5 pl-9 pr-3 text-base outline-none focus:border-brand-500" /></label><div className="min-w-52"><BrandSelect label="অর্ডারের status" value={statusFilter} options={[{ value: 'ALL', label: 'সব status' }, ...Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label }))]} onChange={(value) => setStatusFilter(value as OrderStatus | 'ALL')} /></div></div>

      {loadError && <p className="mt-4 border border-error/20 bg-error/5 p-3 text-base text-error">অর্ডার লোড করা যায়নি: {loadError}</p>}
      <div className="mt-5 space-y-3">
        {loading ? Array.from({ length: 3 }).map((_, index) => <div key={index} className="h-28 animate-pulse bg-outline/40" />) : list.length === 0 ? <div className="border border-outline bg-surface p-8 text-center text-base text-ink-700">{tab === 'buying' ? 'আপনি এখনো কোনো digital product অর্ডার করেননি।' : 'আপনার digital product-এর অর্ডার এখনো আসেনি।'}</div> : list.map((order) => {
          const delivery = deliveries.get(order.id)
          const openDispute = order.dispute_status === 'REPORTED' || order.dispute_status === 'UNDER_REVIEW'
          const canDispute = tab === 'buying' && !openDispute && ['ESCROW_HELD', 'DIGITAL_DELIVERED'].includes(order.status)
          return (
            <div key={order.id} className="border border-outline bg-surface p-4">
              <div className="flex items-center gap-3"><Link to={`/products/${order.product_id}`} className="h-14 w-14 shrink-0 overflow-hidden bg-outline/30">{order.product_image && <img src={order.product_image} alt="" className="h-full w-full object-cover" />}</Link><div className="min-w-0 flex-1"><p className="line-clamp-1 text-base font-medium text-ink-900">{order.product_title}</p><p className="tabular-amount mt-0.5 text-base text-brand-700">{formatTaka(order.price)}</p><p className="mt-0.5 text-sm text-ink-500">{formatDate(order.created_at)}</p></div><span className="shrink-0 bg-bg px-2 py-1 text-sm font-medium text-ink-700">{STATUS_LABEL[order.status]}</span></div>

              {delivery && <div className={`mt-3 flex items-start gap-2 border p-3 text-sm ${delivery.status === 'READY' ? 'border-brand-200 bg-brand-50 text-brand-800' : 'border-outline bg-bg text-ink-700'}`}><ShieldCheck size={17} className="mt-0.5 shrink-0" /><div><p className="font-semibold">{delivery.status === 'READY' ? 'ডিজিটাল ডেলিভারি প্রস্তুত' : delivery.status === 'PENDING' ? 'ডিজিটাল ডেলিভারি প্রস্তুত হচ্ছে' : 'ডেলিভারি প্রত্যাহার করা হয়েছে'}</p>{tab === 'buying' && delivery.status === 'READY' && delivery.delivery_text && <p className="mt-1 break-words whitespace-pre-wrap text-sm">{delivery.delivery_text}</p>}</div></div>}

              {order.dispute_status && <Link to={disputeIdByOrder.has(order.id) ? `/disputes/${disputeIdByOrder.get(order.id)}` : '#'} className="mt-3 block border border-warning/20 bg-warning/10 px-3 py-2 text-sm font-medium text-warning">{openDispute ? 'ডিসপিউট পর্যালোচনাধীন — বিস্তারিত দেখতে চাপুন' : order.dispute_status === 'RESOLVED_REFUNDED' ? 'সমাধান হয়েছে — টাকা ফেরত দেওয়া হয়েছে' : 'সমাধান হয়েছে — রিফান্ড প্রযোজ্য নয়'}</Link>}

              <div className="mt-3 flex flex-wrap gap-2"><Link to={`/orders/${order.id}`} className="border border-outline px-3 py-1.5 text-base font-medium text-ink-700 hover:border-brand-500 hover:text-brand-700">বিস্তারিত দেখুন</Link>
                {tab === 'buying' && order.status === 'PENDING_PAYMENT' && <><ActionButton label="পেমেন্ট সম্পন্ন করুন" variant="primary" loading={processingId === order.id} onClick={() => void runAction(order.id, async () => { const url = await startUddoktaPayCheckout(order.id); window.location.href = url })} /><ActionButton label="বাতিল করুন" variant="danger" loading={processingId === order.id} onClick={() => void runAction(order.id, () => cancelPendingOrder(order.id, uid))} /></>}
                {tab === 'buying' && order.status === 'ESCROW_HELD' && <ActionButton label="বাতিল করুন" variant="danger" loading={processingId === order.id} onClick={() => void runAction(order.id, () => buyerCancelOrder(order.id, uid))} />}
                {tab === 'buying' && order.status === 'DIGITAL_DELIVERED' && !openDispute && <ActionButton label="ডিজিটাল পণ্য পেয়েছি — নিশ্চিত করুন" variant="primary" loading={processingId === order.id} onClick={() => void runAction(order.id, () => confirmDigitalDelivery(order.id, uid))} />}
                {canDispute && <ActionButton label="পাইনি/সমস্যা রিপোর্ট করুন" variant="outline" onClick={() => setDisputeTarget(order)} />}
                {tab === 'buying' && order.status === 'COMPLETED' && !reviewedOrderIds.has(order.id) && <ActionButton label="রিভিউ দিন" variant="outline" onClick={() => setReviewTarget(order)} />}
                {tab === 'selling' && order.status === 'ESCROW_HELD' && <ActionButton label="ডিজিটাল ডেলিভারি দিন" variant="primary" loading={processingId === order.id} onClick={() => void runAction(order.id, () => sellerDeliverDigital(order.id, uid))} />}
                {tab === 'selling' && order.status === 'ESCROW_HELD' && <ActionButton label="বাতিল করুন" variant="danger" loading={processingId === order.id} onClick={() => setSellerCancelTarget(order)} />}
              </div>
            </div>
          )
        })}
      </div>

      {disputeTarget && <ReportDisputeModal orderId={disputeTarget.id} buyerId={uid} onClose={() => setDisputeTarget(null)} onSuccess={() => { setDisputeTarget(null); showToast('রিপোর্ট জমা হয়েছে — পর্যালোচনার পর জানানো হবে।'); void load() }} />}
      {reviewTarget && <ReviewModal order={reviewTarget} buyerName={user?.displayName ?? ''} onClose={() => setReviewTarget(null)} onSuccess={() => { setReviewTarget(null); showToast('রিভিউ জমা হয়েছে — ধন্যবাদ!'); void load() }} />}
      <BrandedDialog open={Boolean(sellerCancelTarget)} title="অর্ডার বাতিল করবেন?" tone="warning" onClose={() => setSellerCancelTarget(null)} actions={<><DialogButton onClick={() => setSellerCancelTarget(null)} variant="outline">থাক</DialogButton><DialogButton onClick={() => { if (sellerCancelTarget) void runAction(sellerCancelTarget.id, () => sellerCancelOrder(sellerCancelTarget.id, uid)); setSellerCancelTarget(null) }} tone="warning">বাতিল নিশ্চিত করুন</DialogButton></>}><p>এই action-এর পরে buyer refund প্রক্রিয়া শুরু হবে। Digital delivery দেওয়ার আগে বাতিল করুন।</p></BrandedDialog>
      {toast && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-ink-900 px-4 py-3 text-base text-white shadow-lg">{toast}</div>}
    </Layout>
  )
}

function ActionButton({ label, variant, loading, onClick }: { label: string; variant: 'primary' | 'outline' | 'danger'; loading?: boolean; onClick: () => void }) {
  const styles = { primary: 'bg-brand-500 text-white hover:bg-brand-600', outline: 'border border-outline text-ink-700 hover:border-brand-500 hover:text-brand-700', danger: 'border border-error/40 text-error hover:bg-error/5' }[variant]
  return <button type="button" onClick={onClick} disabled={loading} className={`px-3 py-1.5 text-base font-medium transition disabled:opacity-50 ${styles}`}>{loading ? '...' : label}</button>
}
