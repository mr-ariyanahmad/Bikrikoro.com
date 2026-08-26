import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { formatAdminRpcError } from '@/lib/adminRpcError'
import { useAuth } from '@/context/AuthContext'
import { formatDateTime, formatTaka } from '@/lib/format'
import { AdminPageHeader, AdminShell, AdminTableCard } from '@/components/admin/AdminShell'
import { BrandSelect } from '@/components/BrandSelect'
import { adminRpc } from '@/lib/adminRpc'
import { supabase } from '@/lib/supabase'

type AdminOrder = { id: string; order_number: number | null; product_title: string; product_image: string; price: number; quantity: number; buyer_id: string; seller_id: string; buyer_name: string; seller_name: string; delivery_address: string; payment_method: string | null; status: string; escrow_fee: number; coupon_code: string | null; discount_amount: number; created_at: string; updated_at?: string }
const statuses = ['', 'PENDING_PAYMENT', 'ESCROW_HELD', 'DIGITAL_DELIVERED', 'DISPUTED', 'COMPLETED', 'CANCELLED', 'REFUNDED']
const labels: Record<string, string> = { PENDING_PAYMENT: 'পেমেন্ট বাকি', ESCROW_HELD: 'এসক্রোতে', DIGITAL_DELIVERED: 'ডিজিটাল ডেলিভারি প্রস্তুত', DISPUTED: 'ডিসপিউট পর্যালোচনাধীন', COMPLETED: 'সম্পন্ন', CANCELLED: 'বাতিল', REFUNDED: 'রিফান্ড সম্পন্ন' }
const displayName = (name?: string | null) => name?.trim() || 'নাম পাওয়া যায়নি'
const readableOrderNumber = (order: AdminOrder) => order.order_number ? `#${order.order_number}` : 'অর্ডার নম্বর পাওয়া যায়নি'

export default function AdminOrders({ deliveriesOnly = false }: { deliveriesOnly?: boolean }) {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const [orders, setOrders] = useState<AdminOrder[]>([])
  const [selected, setSelected] = useState<AdminOrder | null>(null)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState(deliveriesOnly ? 'DIGITAL_DELIVERED' : '')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error: loadError } = await adminRpc('admin_list_orders', { p_admin_id: user?.uid, p_status: status || null })
    if (loadError) setError(formatAdminRpcError(loadError, 'অর্ডার data', '014 admin workspace migration'))
    const baseOrders = (data ?? []) as Omit<AdminOrder, 'buyer_name' | 'seller_name'>[]
    const participantIds = [...new Set(baseOrders.flatMap((order) => [order.buyer_id, order.seller_id]).filter(Boolean))]
    const { data: profiles } = participantIds.length ? await supabase.from('profiles').select('id,name').in('id', participantIds) : { data: [] }
    const nameById = new Map((profiles ?? []).map((profile) => [profile.id, displayName(profile.name)]))
    const enriched = baseOrders.map((order) => ({ ...order, buyer_name: nameById.get(order.buyer_id) ?? 'নাম পাওয়া যায়নি', seller_name: nameById.get(order.seller_id) ?? 'নাম পাওয়া যায়নি' }))
    setOrders(enriched)
    setSelected(id ? enriched.find((order) => order.id === id) ?? null : null)
    setLoading(false)
  }, [id, status, user?.uid])

  useEffect(() => { void load() }, [load])
  const visible = useMemo(() => { const value = query.trim().toLowerCase(); return value ? orders.filter((order) => `${order.order_number ?? ''} ${order.product_title} ${order.buyer_name} ${order.seller_name}`.toLowerCase().includes(value)) : orders }, [orders, query])
  const changeStatus = async (nextStatus: string) => { if (!selected) return; const { error: updateError } = await adminRpc('admin_update_order_status', { p_admin_id: user?.uid, p_order_id: selected.id, p_status: nextStatus }); if (updateError) { setError(formatAdminRpcError(updateError, 'অর্ডার status update', '033 order lifecycle migration')); return }; await load() }

  if (selected && id) return <OrderDetail order={selected} onStatus={changeStatus} />
  return <AdminShell><AdminPageHeader title={deliveriesOnly ? 'ডেলিভারি' : 'অর্ডার ম্যানেজমেন্ট'} description={deliveriesOnly ? 'Digital delivery readiness ও risk queue দেখুন।' : 'সব digital order-এর payment, escrow, delivery, dispute ও payout state দেখুন।'} actions={<Link to="/admin/orders" className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:border-brand-400 hover:text-brand-700">রিফ্রেশ</Link>} />{error && <p className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}<div className="mb-5 grid gap-3 sm:grid-cols-[1fr_220px]"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="অর্ডার নম্বর, প্রোডাক্ট বা নাম খুঁজুন..." className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-brand-500" /><BrandSelect label="অর্ডারের status" value={status} options={statuses.map((value) => ({ value, label: value ? labels[value] : 'সব স্ট্যাটাস' }))} onChange={setStatus} /></div><AdminTableCard><div className="hidden grid-cols-[1.5fr_0.8fr_0.8fr_0.8fr_0.6fr] gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs font-bold uppercase tracking-wide text-slate-500 md:grid"><span>অর্ডার</span><span>তারিখ</span><span>টাকা</span><span>স্ট্যাটাস</span><span>অ্যাকশন</span></div>{loading ? <div className="space-y-3 p-5">{[1, 2, 3, 4].map((item) => <div key={item} className="h-14 animate-pulse rounded-xl bg-slate-100" />)}</div> : visible.length === 0 ? <p className="p-10 text-center text-sm text-slate-500">কোনো অর্ডার পাওয়া যায়নি।</p> : <div className="divide-y divide-slate-100">{visible.map((order) => <Link key={order.id} to={`/admin/orders/${order.id}`} className="grid gap-2 px-5 py-4 transition hover:bg-slate-50 md:grid-cols-[1.5fr_0.8fr_0.8fr_0.8fr_0.6fr] md:items-center md:gap-4"><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-800">{order.product_title}</p><p className="mt-1 text-xs text-slate-400">{readableOrderNumber(order)} · ক্রেতা: {order.buyer_name}</p></div><p className="text-xs text-slate-500">{formatDateTime(order.created_at)}</p><p className="text-sm font-semibold text-slate-800">{formatTaka(order.price + order.escrow_fee)}</p><span className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${order.status === 'CANCELLED' ? 'bg-red-50 text-red-700' : order.status === 'COMPLETED' ? 'bg-brand-50 text-brand-700' : 'bg-amber-50 text-amber-700'}`}>{labels[order.status] ?? order.status}</span><span className="text-sm font-semibold text-brand-700">দেখুন →</span></Link>)}</div>}</AdminTableCard></AdminShell>
}

function OrderDetail({ order, onStatus }: { order: AdminOrder; onStatus: (status: string) => Promise<void> }) {
  const availableStatuses: Record<string, string[]> = { PENDING_PAYMENT: ['CANCELLED'], ESCROW_HELD: ['CANCELLED'], DIGITAL_DELIVERED: [], DISPUTED: [] }
  return <AdminShell><AdminPageHeader title="অর্ডারের বিস্তারিত" description={readableOrderNumber(order)} /><div className="grid gap-6 lg:grid-cols-[1.4fr_0.8fr]"><AdminTableCard><div className="border-b border-slate-200 px-5 py-4"><h2 className="font-semibold text-slate-900">অর্ডার সারাংশ</h2></div><div className="space-y-4 p-5"><div className="flex gap-4"><div className="h-20 w-20 overflow-hidden rounded-xl bg-slate-100">{order.product_image && <img src={order.product_image} alt="" className="h-full w-full object-cover" />}</div><div><p className="font-semibold text-slate-900">{order.product_title}</p><p className="mt-1 text-sm text-slate-500">পরিমাণ: {order.quantity} · {formatDateTime(order.created_at)}</p></div></div><div className="grid gap-3 sm:grid-cols-2"><Info label="ক্রেতা" value={order.buyer_name} /><Info label="বিক্রেতা" value={order.seller_name} /><Info label="Payment" value={order.payment_method ?? 'Pending'} /><Info label="Delivery" value="Digital delivery — shipping address নেই" /></div><div className="rounded-xl bg-slate-50 p-4 text-sm"><div className="flex justify-between text-slate-600"><span>পণ্যের দাম</span><span>{formatTaka(order.price)}</span></div><div className="mt-2 flex justify-between text-slate-600"><span>Escrow fee</span><span>{formatTaka(order.escrow_fee)}</span></div><div className="mt-2 flex justify-between border-t border-slate-200 pt-2 font-bold text-slate-900"><span>মোট</span><span>{formatTaka(order.price + order.escrow_fee)}</span></div></div></div></AdminTableCard><AdminTableCard><div className="border-b border-slate-200 px-5 py-4"><h2 className="font-semibold text-slate-900">অপারেশন অ্যাকশন</h2></div><div className="space-y-3 p-5"><p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">বর্তমান স্ট্যাটাস: <strong>{labels[order.status] ?? order.status}</strong></p>{(availableStatuses[order.status] ?? []).length === 0 ? <p className="rounded-xl border border-slate-100 p-3 text-sm text-slate-500">এই অর্ডারের আর কোনো manual transition নেই।</p> : (availableStatuses[order.status] ?? []).map((status) => <button type="button" key={status} onClick={() => void onStatus(status)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-left text-sm font-medium text-slate-700 hover:border-brand-400 hover:text-brand-700">{labels[status]}</button>)}</div></AdminTableCard></div></AdminShell>
}

function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-slate-100 p-3"><p className="text-xs text-slate-400">{label}</p><p className="mt-1 break-words text-sm text-slate-700">{value}</p></div> }
