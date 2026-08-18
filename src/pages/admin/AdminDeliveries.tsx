import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, Clock3, Download, Truck } from 'lucide-react'
import { AdminPageHeader, AdminShell, AdminTableCard } from '@/components/admin/AdminShell'
import { useAuth } from '@/context/AuthContext'
import { formatDateTime } from '@/lib/format'
import { supabase } from '@/lib/supabase'
import { formatAdminRpcError } from '@/lib/adminRpcError'

type PhysicalOrder = { id: string; product_title: string; buyer_id: string; delivery_address: string; status: string; created_at: string }
type DigitalDelivery = { order_id: string; product_id: string; buyer_id: string; delivery_type: string; status: string; created_at: string }

export default function AdminDeliveries() {
  const { user } = useAuth()
  const [physical, setPhysical] = useState<PhysicalOrder[]>([])
  const [digital, setDigital] = useState<DigitalDelivery[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(async () => {
    if (!user?.uid) return
    setLoading(true)
    setError(null)
    const [preparingResult, shippedResult, digitalResult] = await Promise.all([
      supabase.rpc('admin_list_orders', { p_admin_id: user.uid, p_status: 'PREPARING' }),
      supabase.rpc('admin_list_orders', { p_admin_id: user.uid, p_status: 'SHIPPED' }),
      supabase.rpc('admin_list_digital_deliveries', { p_admin_id: user.uid }),
    ])
    setPhysical([
      ...((preparingResult.data ?? []) as PhysicalOrder[]),
      ...((shippedResult.data ?? []) as PhysicalOrder[]),
    ])
    setDigital((digitalResult.data ?? []) as DigitalDelivery[])
    const firstError = preparingResult.error ?? shippedResult.error ?? digitalResult.error
    if (firstError) setError(formatAdminRpcError(firstError, 'Delivery data', '014/015 admin workspace migration'))
    setLoading(false)
  }, [user?.uid])
  useEffect(() => { load() }, [load])
  return <AdminShell><AdminPageHeader title="ডেলিভারি অপারেশন" description="Physical shipment এবং digital product delivery readiness এক জায়গা থেকে দেখুন।" /><div className="grid gap-6 xl:grid-cols-2"><AdminTableCard><div className="flex items-center gap-3 border-b border-slate-200 px-5 py-4"><span className="rounded-xl bg-brand-50 p-2 text-brand-700"><Truck size={18} /></span><div><h2 className="font-semibold text-slate-900">Physical shipment</h2><p className="mt-1 text-xs text-slate-500">প্রস্তুতি ও shipped order fulfillment queue</p></div></div>{loading ? <p className="p-8 text-center text-sm text-slate-500">লোড হচ্ছে...</p> : physical.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">কোনো fulfillment order নেই।</p> : <div className="divide-y divide-slate-100">{physical.map((order) => <div key={order.id} className="px-5 py-4"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-slate-800">{order.product_title}</p><p className="mt-1 text-xs text-slate-400">#{order.id.slice(0, 10)} · {formatDateTime(order.created_at)}</p></div><Clock3 size={17} className="text-amber-500" /></div><p className="mt-2 text-sm text-slate-600">{order.delivery_address}</p></div>)}</div>}</AdminTableCard><AdminTableCard><div className="flex items-center gap-3 border-b border-slate-200 px-5 py-4"><span className="rounded-xl bg-brand-50 p-2 text-brand-700"><Download size={18} /></span><div><h2 className="font-semibold text-slate-900">Digital delivery</h2><p className="mt-1 text-xs text-slate-500">License/key/file readiness ও access state</p></div></div>{loading ? <p className="p-8 text-center text-sm text-slate-500">লোড হচ্ছে...</p> : digital.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">কোনো digital delivery record নেই।</p> : <div className="divide-y divide-slate-100">{digital.map((delivery) => <div key={delivery.order_id} className="flex items-center justify-between gap-3 px-5 py-4"><div><p className="font-mono text-sm text-slate-800">Order {delivery.order_id.slice(0, 10)}</p><p className="mt-1 text-xs text-slate-400">Buyer {delivery.buyer_id.slice(0, 10)} · {delivery.delivery_type}</p></div><span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${delivery.status === 'READY' ? 'bg-brand-50 text-brand-700' : 'bg-amber-50 text-amber-700'}`}>{delivery.status === 'READY' ? <CheckCircle2 size={13} /> : <Clock3 size={13} />}{delivery.status}</span></div>)}</div>}</AdminTableCard></div>{error && <p className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}</AdminShell>
}
