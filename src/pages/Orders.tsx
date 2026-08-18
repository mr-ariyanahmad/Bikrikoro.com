import { useEffect, useState, useCallback } from 'react'
import { Search } from 'lucide-react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { Layout } from '@/components/Layout'
import { BrandSelect } from '@/components/BrandSelect'
import { ReportDisputeModal } from '@/components/ReportDisputeModal'
import { BrandedDialog, DialogButton } from '@/components/BrandedDialog'
import { ReviewModal } from '@/components/ReviewModal'
import { confirmOrderDelivery, buyerCancelOrder, sellerMarkPreparing, sellerMarkShipped, sellerMarkDelivered, sellerCancelOrder } from '@/lib/orders'
import { startUddoktaPayCheckout, cancelPendingOrder } from '@/lib/payments'
import { formatTaka, formatDate } from '@/lib/format'
import type { Order, OrderStatus } from '@/types/order'

type Tab = 'buying' | 'selling'

const STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING_PAYMENT: 'পেমেন্ট বাকি',
  ESCROW_HELD: 'এসক্রোতে',
  PREPARING: 'প্রস্তুত করা হচ্ছে',
  SHIPPED: 'পাঠানো হয়েছে',
  DELIVERED: 'পৌঁছেছে',
  COMPLETED: 'সম্পন্ন',
  CANCELLED: 'বাতিল',
}

export default function Orders() {
  const { user } = useAuth()
  const uid = user!.uid

  const [tab, setTab] = useState<Tab>('buying')
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'ALL'>('ALL')
  const [orderQuery, setOrderQuery] = useState('')
  const [orders, setOrders] = useState<Order[]>([])
  const [reviewedOrderIds, setReviewedOrderIds] = useState<Set<string>>(new Set())
  const [disputeIdByOrder, setDisputeIdByOrder] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(true)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [disputeTarget, setDisputeTarget] = useState<Order | null>(null)
  const [reviewTarget, setReviewTarget] = useState<Order | null>(null)
  const [sellerCancelTarget, setSellerCancelTarget] = useState<Order | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [ordersRes, reviewsRes, disputesRes] = await Promise.all([
      supabase
        .from('orders')
        .select('*')
        .or(`buyer_id.eq.${uid},seller_id.eq.${uid}`)
        .order('created_at', { ascending: false }),
      supabase.from('reviews').select('order_id').eq('buyer_id', uid),
      supabase.from('order_disputes').select('id, order_id').eq('buyer_id', uid),
    ])
    setOrders(ordersRes.data ?? [])
    setReviewedOrderIds(new Set((reviewsRes.data ?? []).map((r) => r.order_id)))
    setDisputeIdByOrder(new Map((disputesRes.data ?? []).map((d) => [d.order_id, d.id])))
    setLoading(false)
  }, [uid])

  useEffect(() => {
    load()

    const channel = supabase
      .channel(`orders-${uid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, load)
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [uid, load])

  const showToast = (message: string) => {
    setToast(message)
    setTimeout(() => setToast(null), 3500)
  }

  const runAction = async (orderId: string, action: () => Promise<void>) => {
    setProcessingId(orderId)
    try {
      await action()
    } catch {
      showToast('কাজটি সম্পন্ন করা যায়নি — আবার চেষ্টা করুন।')
    } finally {
      setProcessingId(null)
    }
  }

  const buying = orders.filter((o) => o.buyer_id === uid)
  const selling = orders.filter((o) => o.seller_id === uid)
  const list = (tab === 'buying' ? buying : selling).filter((order) => (statusFilter === 'ALL' || order.status === statusFilter) && (!orderQuery.trim() || order.product_title.toLowerCase().includes(orderQuery.trim().toLowerCase())))
  const activeCount = (tab === 'buying' ? buying : selling).filter((order) => !['COMPLETED', 'CANCELLED'].includes(order.status)).length

  return (
    <Layout wide>
      <div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-xl font-semibold text-ink-900">আমার অর্ডার</h1><p className="mt-1 text-sm text-ink-500">{activeCount}টি চলমান অর্ডার</p></div><div className="flex items-center gap-2 rounded-xl bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-700">মোট {orders.length}টি</div></div>

      <div className="mt-4 flex rounded-lg border border-outline p-1">
        <button
          onClick={() => setTab('buying')}
          className={`flex-1 rounded-md py-2 text-sm font-medium transition ${
            tab === 'buying' ? 'bg-brand-500 text-white' : 'text-ink-600'
          }`}
        >
          কিনেছি
        </button>
        <button
          onClick={() => setTab('selling')}
          className={`flex-1 rounded-md py-2 text-sm font-medium transition ${
            tab === 'selling' ? 'bg-brand-500 text-white' : 'text-ink-600'
          }`}
        >
          বিক্রি করেছি
        </button>
      </div>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row"><label className="relative flex-1"><Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-300" /><input value={orderQuery} onChange={(e) => setOrderQuery(e.target.value)} placeholder="পণ্যের নামে অর্ডার খুঁজুন..." className="w-full rounded-xl border border-outline py-2.5 pl-9 pr-3 text-sm outline-none focus:border-brand-500" /></label><div className="min-w-52"><BrandSelect label="অর্ডারের status" value={statusFilter} options={[{ value: 'ALL', label: 'সব status' }, ...Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label }))]} onChange={(value) => setStatusFilter(value as OrderStatus | 'ALL')} /></div></div>

      <div className="mt-5 space-y-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl bg-outline/40" />
          ))
        ) : list.length === 0 ? (
          <div className="rounded-2xl border border-outline bg-surface p-8 text-center text-ink-600">
            {tab === 'buying' ? 'আপনি এখনো কোনো পণ্য অর্ডার করেননি।' : 'আপনার কোনো পণ্যের অর্ডার এখনো আসেনি।'}
          </div>
        ) : (
          list.map((order) => (
            <div key={order.id} className="rounded-xl border border-outline bg-surface p-4">
              <div className="flex items-center gap-3">
                <Link
                  to={`/products/${order.product_id}`}
                  className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-outline/30"
                >
                  {order.product_image && (
                    <img src={order.product_image} alt="" className="h-full w-full object-cover" />
                  )}
                </Link>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 text-sm font-medium text-ink-900">{order.product_title}</p>
                  <p className="tabular-amount mt-0.5 text-sm text-brand-600">{formatTaka(order.price)}</p>
                  <p className="mt-0.5 text-xs text-ink-300">{formatDate(order.created_at)}</p>
                </div>
                <span className="shrink-0 rounded-md bg-bg px-2 py-1 text-xs font-medium text-ink-600">
                  {STATUS_LABEL[order.status]}
                </span>
              </div>

              {order.dispute_status && (
                <Link
                  to={disputeIdByOrder.has(order.id) ? `/disputes/${disputeIdByOrder.get(order.id)}` : '#'}
                  className="mt-3 block rounded-lg bg-warning/10 px-3 py-2 text-xs font-medium text-warning hover:bg-warning/20"
                >
                  {order.dispute_status === 'REPORTED' || order.dispute_status === 'UNDER_REVIEW'
                    ? 'রিপোর্ট পর্যালোচনাধীন — বিস্তারিত দেখতে ট্যাপ করুন'
                    : order.dispute_status === 'RESOLVED_REFUNDED'
                      ? 'সমাধান হয়েছে — টাকা ফেরত দেওয়া হয়েছে'
                      : 'সমাধান হয়েছে — রিফান্ড প্রযোজ্য নয়'}
                </Link>
              )}

              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  to={`/orders/${order.id}`}
                  className="rounded-lg border border-outline px-3 py-1.5 text-sm font-medium text-ink-600 hover:border-brand-500 hover:text-brand-600"
                >
                  বিস্তারিত দেখুন
                </Link>
                {tab === 'buying' && order.status === 'PENDING_PAYMENT' && (
                  <>
                    <ActionButton
                      label="পেমেন্ট সম্পন্ন করুন"
                      variant="primary"
                      loading={processingId === order.id}
                      onClick={() =>
                        runAction(order.id, async () => {
                          const url = await startUddoktaPayCheckout(order.id)
                          window.location.href = url
                        })
                      }
                    />
                    <ActionButton
                      label="বাতিল করুন"
                      variant="danger"
                      loading={processingId === order.id}
                      onClick={() => runAction(order.id, () => cancelPendingOrder(order.id, uid))}
                    />
                  </>
                )}
                {tab === 'buying' && order.status === 'ESCROW_HELD' && (
                  <ActionButton
                    label="বাতিল করুন"
                    variant="danger"
                    loading={processingId === order.id}
                    onClick={() => runAction(order.id, () => buyerCancelOrder(order.id, uid))}
                  />
                )}
                {tab === 'buying' && order.status === 'DELIVERED' && (!order.dispute_status || order.dispute_status === 'RESOLVED_DENIED') && (
                  <ActionButton
                    label="পণ্য পেয়েছি — নিশ্চিত করুন"
                    variant="primary"
                    loading={processingId === order.id}
                    onClick={() => runAction(order.id, () => confirmOrderDelivery(order.id, uid))}
                  />
                )}
                {tab === 'buying' && ['SHIPPED', 'DELIVERED'].includes(order.status) && (!order.dispute_status || order.dispute_status === 'RESOLVED_DENIED') && (
                  <ActionButton label="পাইনি/সমস্যা রিপোর্ট করুন" variant="outline" onClick={() => setDisputeTarget(order)} />
                )}
                {tab === 'buying' && order.status === 'COMPLETED' && !reviewedOrderIds.has(order.id) && (
                  <ActionButton label="রিভিউ দিন" variant="outline" onClick={() => setReviewTarget(order)} />
                )}

                {tab === 'selling' && order.status === 'ESCROW_HELD' && (
                  <ActionButton
                    label="প্রস্তুতি শুরু করুন"
                    variant="primary"
                    loading={processingId === order.id}
                    onClick={() => runAction(order.id, () => sellerMarkPreparing(order.id, uid))}
                  />
                )}
                {tab === 'selling' && order.status === 'PREPARING' && (
                  <ActionButton
                    label="শিপড মার্ক করুন"
                    variant="primary"
                    loading={processingId === order.id}
                    onClick={() => runAction(order.id, () => sellerMarkShipped(order.id, uid))}
                  />
                )}
                {tab === 'selling' && order.status === 'SHIPPED' && (
                  <ActionButton
                    label="ডেলিভার্ড মার্ক করুন"
                    variant="primary"
                    loading={processingId === order.id}
                    onClick={() => runAction(order.id, () => sellerMarkDelivered(order.id, uid))}
                  />
                )}
                {tab === 'selling' && ['ESCROW_HELD', 'PREPARING', 'SHIPPED'].includes(order.status) && (
                  <ActionButton
                    label="বাতিল করুন"
                    variant="danger"
                    loading={processingId === order.id}
                    onClick={() => setSellerCancelTarget(order)}
                  />
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {disputeTarget && (
        <ReportDisputeModal
          orderId={disputeTarget.id}
          buyerId={uid}
          onClose={() => setDisputeTarget(null)}
          onSuccess={() => {
            setDisputeTarget(null)
            showToast('রিপোর্ট জমা হয়েছে — পর্যালোচনার পর জানানো হবে।')
            load()
          }}
        />
      )}

      {reviewTarget && (
        <ReviewModal
          order={reviewTarget}
          buyerName={user?.displayName ?? ''}
          onClose={() => setReviewTarget(null)}
          onSuccess={() => {
            setReviewTarget(null)
            showToast('রিভিউ জমা হয়েছে — ধন্যবাদ!')
            load()
          }}
        />
      )}

      <BrandedDialog open={Boolean(sellerCancelTarget)} title="অর্ডার বাতিল করবেন?" tone="warning" onClose={() => setSellerCancelTarget(null)} actions={<><DialogButton onClick={() => setSellerCancelTarget(null)} variant="outline">থাক</DialogButton><DialogButton onClick={() => { if (sellerCancelTarget) runAction(sellerCancelTarget.id, () => sellerCancelOrder(sellerCancelTarget.id, uid)); setSellerCancelTarget(null) }} tone="warning">বাতিল নিশ্চিত করুন</DialogButton></>}><p>এই action-এর পরে ক্রেতার refund প্রক্রিয়া শুরু হবে। Seller হিসেবে সত্যিই বাতিল করতে চান কি না নিশ্চিত করুন।</p></BrandedDialog>
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-xl bg-ink-900 px-4 py-3 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </Layout>
  )
}

function ActionButton({
  label,
  variant,
  loading,
  onClick,
}: {
  label: string
  variant: 'primary' | 'outline' | 'danger'
  loading?: boolean
  onClick: () => void
}) {
  const styles = {
    primary: 'bg-brand-500 text-white hover:bg-brand-600',
    outline: 'border border-outline text-ink-600 hover:border-brand-500 hover:text-brand-600',
    danger: 'border border-error/40 text-error hover:bg-error/5',
  }[variant]

  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition disabled:opacity-50 ${styles}`}
    >
      {loading ? '...' : label}
    </button>
  )
}
