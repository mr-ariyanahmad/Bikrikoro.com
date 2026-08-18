import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { formatDateTime, formatTaka } from '@/lib/format'
import { AdminPageHeader, AdminShell, AdminTableCard } from '@/components/admin/AdminShell'
import { BrandedDialog, DialogButton, DialogInput } from '@/components/BrandedDialog'

type AdminOrder = { id: string; product_title: string; product_image: string; price: number; quantity: number; buyer_id: string; seller_id: string; delivery_address: string; payment_method: string | null; status: string; escrow_fee: number; coupon_code: string | null; discount_amount: number; created_at: string; updated_at?: string; admin_review_status?: 'PENDING' | 'APPROVED' | 'REJECTED'; admin_reviewed_by?: string | null; admin_reviewed_email?: string | null; admin_reviewed_at?: string | null; admin_review_note?: string }
type OrderApprovalHistory = { id: string; order_id: string; admin_uid: string; admin_email: string; admin_name: string; decision: 'APPROVED' | 'REJECTED'; note: string; created_at: string }
const statuses = ['', 'PENDING_PAYMENT', 'ESCROW_HELD', 'SHIPPED', 'DELIVERED', 'COMPLETED', 'CANCELLED']
const labels: Record<string, string> = { PENDING_PAYMENT: 'পেমেন্ট বাকি', ESCROW_HELD: 'এসক্রোতে', SHIPPED: 'পাঠানো হয়েছে', DELIVERED: 'পৌঁছেছে', COMPLETED: 'সম্পন্ন', CANCELLED: 'বাতিল' }

export default function AdminOrders({ deliveriesOnly = false }: { deliveriesOnly?: boolean }) {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const [orders, setOrders] = useState<AdminOrder[]>([])
  const [selected, setSelected] = useState<AdminOrder | null>(null)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState(deliveriesOnly ? 'SHIPPED' : '')
  const [reviewStatus, setReviewStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error: loadError } = await supabase.rpc('admin_list_orders', { p_admin_id: user?.uid, p_status: status || null })
    if (loadError) setError('অর্ডার লোড করা যায়নি। 014 migration প্রয়োগ করা হয়েছে কি না দেখুন।')
    const result = (data ?? []) as AdminOrder[]
    setOrders(result)
    setSelected(id ? result.find((order) => order.id === id) ?? null : null)
    setLoading(false)
  }, [id, status, user?.uid])

  useEffect(() => { load() }, [load])

  const visible = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return orders.filter((order) => (!reviewStatus || (order.admin_review_status ?? 'PENDING') === reviewStatus) && (!normalized || `${order.id} ${order.product_title} ${order.buyer_id} ${order.seller_id}`.toLowerCase().includes(normalized)))
  }, [orders, query, reviewStatus])

  const changeStatus = async (nextStatus: string) => {
    if (!selected) return
    const { error: updateError } = await supabase.rpc('admin_update_order_status', { p_admin_id: user?.uid, p_order_id: selected.id, p_status: nextStatus })
    if (updateError) {
      setError('স্ট্যাটাস পরিবর্তন করা যায়নি। নতুন admin migration প্রয়োগ করা হয়েছে কি না দেখুন।')
      return
    }
    await load()
  }

  if (selected && id) {
    return <OrderDetail order={selected} onBack={() => { window.history.back() }} onStatus={changeStatus} />
  }

  return (
    <AdminShell>
      <AdminPageHeader title={deliveriesOnly ? 'ডেলিভারি' : 'অর্ডার ম্যানেজমেন্ট'} description={deliveriesOnly ? 'ফিজিক্যাল ও ডিজিটাল ডেলিভারির অপারেশন দেখুন।' : 'সব অর্ডারের payment, escrow এবং fulfillment status দেখুন।'} actions={<Link to="/admin/orders" className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:border-blue-400 hover:text-blue-600">রিফ্রেশ</Link>} />
      {error && <p className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
      <div className="mb-5 grid gap-3 sm:grid-cols-[1fr_220px_220px]"><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="অর্ডার ID, প্রোডাক্ট বা user ID খুঁজুন..." className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500" /><select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500">{statuses.map((value) => <option key={value} value={value}>{value ? labels[value] : 'সব স্ট্যাটাস'}</option>)}</select><select value={reviewStatus} onChange={(e) => setReviewStatus(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500"><option value="">সব admin review</option><option value="PENDING">অনুমোদন বাকি</option><option value="APPROVED">অনুমোদিত</option><option value="REJECTED">বাতিল</option></select></div>
      <AdminTableCard>
        <div className="hidden grid-cols-[1.5fr_0.8fr_0.8fr_0.8fr_0.6fr] gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs font-bold uppercase tracking-wide text-slate-500 md:grid"><span>অর্ডার</span><span>তারিখ</span><span>টাকা</span><span>স্ট্যাটাস</span><span>অ্যাকশন</span></div>
        {loading ? <div className="space-y-3 p-5">{[1, 2, 3, 4].map((item) => <div key={item} className="h-14 animate-pulse rounded-xl bg-slate-100" />)}</div> : visible.length === 0 ? <p className="p-10 text-center text-sm text-slate-500">কোনো অর্ডার পাওয়া যায়নি।</p> : <div className="divide-y divide-slate-100">{visible.map((order) => <Link key={order.id} to={`/admin/orders/${order.id}`} className="grid gap-2 px-5 py-4 transition hover:bg-slate-50 md:grid-cols-[1.5fr_0.8fr_0.8fr_0.8fr_0.6fr] md:items-center md:gap-4"><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-800">{order.product_title}</p><p className="mt-1 text-xs text-slate-400">#{order.id.slice(0, 10)} · buyer {order.buyer_id.slice(0, 8)}</p><p className={`mt-1 text-[10px] font-semibold ${order.admin_review_status === 'APPROVED' ? 'text-brand-700' : order.admin_review_status === 'REJECTED' ? 'text-red-600' : 'text-amber-700'}`}>Admin review: {order.admin_review_status === 'APPROVED' ? 'অনুমোদিত' : order.admin_review_status === 'REJECTED' ? 'বাতিল' : 'অনুমোদন বাকি'}</p></div><p className="text-xs text-slate-500">{formatDateTime(order.created_at)}</p><p className="text-sm font-semibold text-slate-800">{formatTaka(order.price + order.escrow_fee)}</p><span className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${order.status === 'CANCELLED' ? 'bg-red-50 text-red-700' : order.status === 'COMPLETED' ? 'bg-brand-50 text-brand-700' : 'bg-amber-50 text-amber-700'}`}>{labels[order.status] ?? order.status}</span><span className="text-sm font-semibold text-blue-600">দেখুন →</span></Link>)}</div>}
      </AdminTableCard>
    </AdminShell>
  )
}

function OrderDetail({ order, onBack, onStatus }: { order: AdminOrder; onBack: () => void; onStatus: (status: string) => Promise<void> }) {
  const { user } = useAuth()
  const [reviewTarget, setReviewTarget] = useState<'APPROVED' | 'REJECTED' | null>(null)
  const [reviewNote, setReviewNote] = useState('')
  const [reviewError, setReviewError] = useState<string | null>(null)
  const [history, setHistory] = useState<OrderApprovalHistory[]>([])
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)

  const reviewOrder = async () => {
    if (!reviewTarget || !user?.uid) return
    const { error } = await supabase.rpc('admin_review_order', { p_admin_id: user.uid, p_order_id: order.id, p_status: reviewTarget, p_admin_note: reviewNote.trim() })
    if (error) setReviewError(error.message.includes('permission') ? 'আপনার order approval permission নেই।' : error.message)
    else { setReviewTarget(null); setReviewNote(''); window.location.reload() }
  }

  const loadHistory = async () => {
    setHistoryOpen(true)
    setHistoryLoading(true)
    const { data, error } = await supabase.rpc('admin_list_order_approval_history', { p_admin_id: user?.uid, p_order_id: order.id })
    setHistory((data ?? []) as OrderApprovalHistory[])
    if (error) setReviewError('Order approval history লোড করা যায়নি। 031 migration প্রয়োগ করা হয়েছে কি না দেখুন।')
    setHistoryLoading(false)
  }

  return (
    <AdminShell>
      <AdminPageHeader title="অর্ডারের বিস্তারিত" description={`#${order.id}`} actions={<button onClick={onBack} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600">← অর্ডারে ফিরুন</button>} />
      <div className="grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
        <AdminTableCard><div className="border-b border-slate-200 px-5 py-4"><h2 className="font-semibold text-slate-900">অর্ডার সারাংশ</h2></div><div className="space-y-4 p-5"><div className="flex gap-4"><div className="h-20 w-20 overflow-hidden rounded-xl bg-slate-100">{order.product_image && <img src={order.product_image} alt="" className="h-full w-full object-cover" />}</div><div><p className="font-semibold text-slate-900">{order.product_title}</p><p className="mt-1 text-sm text-slate-500">পরিমাণ: {order.quantity} · {formatDateTime(order.created_at)}</p></div></div><div className="grid gap-3 sm:grid-cols-2"><Info label="Buyer ID" value={order.buyer_id} /><Info label="Seller ID" value={order.seller_id} /><Info label="Payment" value={order.payment_method ?? 'Pending'} /><Info label="Delivery" value={order.delivery_address} /></div><div className="rounded-xl bg-slate-50 p-4 text-sm"><div className="flex justify-between text-slate-600"><span>পণ্যের দাম</span><span>{formatTaka(order.price)}</span></div><div className="mt-2 flex justify-between text-slate-600"><span>Escrow fee</span><span>{formatTaka(order.escrow_fee)}</span></div><div className="mt-2 flex justify-between border-t border-slate-200 pt-2 font-bold text-slate-900"><span>মোট</span><span>{formatTaka(order.price + order.escrow_fee)}</span></div></div></div></AdminTableCard>
        <AdminTableCard><div className="border-b border-slate-200 px-5 py-4"><h2 className="font-semibold text-slate-900">অপারেশন অ্যাকশন</h2></div><div className="space-y-3 p-5"><p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">বর্তমান স্ট্যাটাস: <strong>{labels[order.status] ?? order.status}</strong></p><p className={`rounded-xl p-3 text-sm ${order.admin_review_status === 'APPROVED' ? 'bg-brand-50 text-brand-700' : order.admin_review_status === 'REJECTED' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>Admin review: <strong>{order.admin_review_status === 'APPROVED' ? 'অনুমোদিত' : order.admin_review_status === 'REJECTED' ? 'বাতিল' : 'অনুমোদন বাকি'}</strong>{order.admin_reviewed_email && <span className="mt-1 block text-xs">Reviewer: {order.admin_reviewed_email}</span>}{order.admin_reviewed_by && <span className="block break-all text-[10px] opacity-75">UID: {order.admin_reviewed_by}</span>}</p>{order.admin_review_status === 'PENDING' && <><button onClick={() => setReviewTarget('APPROVED')} className="w-full rounded-xl bg-brand-500 px-3 py-2.5 text-left text-sm font-bold text-white hover:bg-brand-600">Order approve করুন</button><button onClick={() => setReviewTarget('REJECTED')} className="w-full rounded-xl border border-red-200 px-3 py-2.5 text-left text-sm font-semibold text-red-600 hover:border-red-400">Order reject করুন</button></>}<button onClick={() => void loadHistory()} className="w-full rounded-xl border border-brand-200 px-3 py-2.5 text-left text-sm font-semibold text-brand-700 hover:border-brand-400">অনুমোদনের ইতিহাস দেখুন</button>{['ESCROW_HELD', 'SHIPPED', 'DELIVERED', 'COMPLETED', 'CANCELLED'].map((status) => <button key={status} onClick={() => onStatus(status)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-left text-sm font-medium text-slate-700 hover:border-blue-400 hover:text-blue-600">{labels[status]}</button>)}</div></AdminTableCard>
      </div>
      <BrandedDialog open={Boolean(reviewTarget)} title={reviewTarget === 'APPROVED' ? 'Order approve করবেন?' : 'Order reject করবেন?'} tone={reviewTarget === 'APPROVED' ? 'success' : 'danger'} onClose={() => setReviewTarget(null)} actions={<><DialogButton onClick={() => setReviewTarget(null)} variant="outline">বাতিল</DialogButton><DialogButton onClick={reviewOrder} tone={reviewTarget === 'APPROVED' ? 'success' : 'danger'}>নিশ্চিত করুন</DialogButton></>}><p>এই decision buyer ও seller-কে notification হিসেবে যাবে এবং admin history-তে আপনার Gmail/UID সংরক্ষিত হবে।</p><DialogInput value={reviewNote} onChange={setReviewNote} placeholder="Admin note (ঐচ্ছিক)" /></BrandedDialog>
      <BrandedDialog open={historyOpen} title="অর্ডার অনুমোদনের ইতিহাস" onClose={() => setHistoryOpen(false)} actions={<DialogButton onClick={() => setHistoryOpen(false)}>বন্ধ করুন</DialogButton>}><p className="mb-3">{order.product_title}</p>{historyLoading ? <p>ইতিহাস লোড হচ্ছে...</p> : history.length === 0 ? <p>এখনো কোনো অনুমোদনের ইতিহাস নেই।</p> : <div className="max-h-72 space-y-2 overflow-y-auto">{history.map((entry) => <div key={entry.id} className="rounded-xl border border-outline bg-bg p-3"><div className="flex items-center justify-between gap-2"><span className={`rounded-full px-2 py-1 text-[11px] font-bold ${entry.decision === 'APPROVED' ? 'bg-brand-50 text-brand-700' : 'bg-red-50 text-red-700'}`}>{entry.decision}</span><span className="text-[11px] text-ink-400">{new Date(entry.created_at).toLocaleString('bn-BD')}</span></div><p className="mt-2 text-xs text-ink-600">অ্যাডমিন: {entry.admin_email || 'ইমেইল নেই'}</p><p className="break-all text-[11px] text-ink-400">UID: {entry.admin_uid}</p>{entry.note && <p className="mt-1 text-xs text-ink-600">নোট: {entry.note}</p>}</div>)}</div>}</BrandedDialog>
      <BrandedDialog open={Boolean(reviewError)} title="Order review" onClose={() => setReviewError(null)} actions={<DialogButton onClick={() => setReviewError(null)}>ঠিক আছে</DialogButton>}><p>{reviewError}</p></BrandedDialog>
    </AdminShell>
  )
}

function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-slate-100 p-3"><p className="text-xs text-slate-400">{label}</p><p className="mt-1 break-words text-sm text-slate-700">{value}</p></div> }
