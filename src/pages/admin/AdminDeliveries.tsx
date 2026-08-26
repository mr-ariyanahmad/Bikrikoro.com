import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, Clock3, Download } from 'lucide-react'
import { AdminPageHeader, AdminShell, AdminTableCard } from '@/components/admin/AdminShell'
import { useAuth } from '@/context/AuthContext'
import { formatAdminRpcError } from '@/lib/adminRpcError'
import { adminRpc } from '@/lib/adminRpc'
import { supabase } from '@/lib/supabase'

type DigitalDelivery = { order_id: string; product_id: string; buyer_id: string; seller_id?: string; delivery_type: string; status: string; created_at: string; order_number?: number | null; product_title?: string; buyer_name?: string }
const displayName = (name?: string | null) => name?.trim() || 'নাম পাওয়া যায়নি'

export default function AdminDeliveries() {
  const { user } = useAuth()
  const [digital, setDigital] = useState<DigitalDelivery[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(async () => {
    if (!user?.uid) return
    setLoading(true); setError(null)
    const result = await adminRpc('admin_list_digital_deliveries', { p_admin_id: user.uid })
    const deliveries = (result.data ?? []) as DigitalDelivery[]
    if (result.error) setError(formatAdminRpcError(result.error, 'Digital delivery data', '046 admin read-scope migration'))
    const orderIds = [...new Set(deliveries.map((delivery) => delivery.order_id).filter(Boolean))]
    const { data: orders } = orderIds.length ? await supabase.from('orders').select('id,order_number,product_title,buyer_id').in('id', orderIds) : { data: [] }
    const orderById = new Map((orders ?? []).map((order) => [order.id, order]))
    const buyerIds = [...new Set(deliveries.map((delivery) => orderById.get(delivery.order_id)?.buyer_id ?? delivery.buyer_id).filter(Boolean))]
    const { data: profiles } = buyerIds.length ? await supabase.from('profiles').select('id,name').in('id', buyerIds) : { data: [] }
    const nameById = new Map((profiles ?? []).map((profile) => [profile.id, displayName(profile.name)]))
    setDigital(deliveries.map((delivery) => { const order = orderById.get(delivery.order_id); const buyerId = order?.buyer_id ?? delivery.buyer_id; return { ...delivery, order_number: order?.order_number ?? null, product_title: order?.product_title ?? 'পণ্যের তথ্য পাওয়া যায়নি', buyer_name: nameById.get(buyerId) ?? 'নাম পাওয়া যায়নি' } }))
    setLoading(false)
  }, [user?.uid])
  useEffect(() => { void load() }, [load])
  return <AdminShell><AdminPageHeader title="ডিজিটাল ডেলিভারি অপারেশন" description="License, key, file, access ও instructions delivery readiness এবং risk review এক জায়গা থেকে দেখুন।" /><AdminTableCard><div className="flex items-center gap-3 border-b border-slate-200 px-5 py-4"><span className="bg-brand-50 p-2 text-brand-700"><Download size={18} /></span><div><h2 className="font-semibold text-slate-900">Digital delivery queue</h2><p className="mt-1 text-xs text-slate-500">Payment verified হওয়ার পরে delivery record এবং access state নজরদারি করুন।</p></div></div>{loading ? <p className="p-8 text-center text-sm text-slate-500">লোড হচ্ছে...</p> : digital.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">কোনো digital delivery record নেই।</p> : <div className="divide-y divide-slate-100">{digital.map((delivery) => <div key={delivery.order_id} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold text-slate-800">অর্ডার #{delivery.order_number ?? '—'}</p><p className="mt-1 text-xs text-slate-400">{delivery.product_title} · ক্রেতা: {delivery.buyer_name} · {delivery.delivery_type}</p></div><span className={`inline-flex w-fit items-center gap-1 px-2.5 py-1 text-xs font-semibold ${delivery.status === 'READY' ? 'bg-brand-50 text-brand-700' : delivery.status === 'REVOKED' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>{delivery.status === 'READY' ? <CheckCircle2 size={13} /> : <Clock3 size={13} />}{delivery.status}</span></div>)}</div>}{error && <p className="border-t border-red-100 bg-red-50 p-4 text-sm text-red-700">{error}</p>}</AdminTableCard></AdminShell>
}
