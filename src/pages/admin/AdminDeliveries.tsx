import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, Clock3, Download } from 'lucide-react'
import { AdminPageHeader, AdminShell, AdminTableCard } from '@/components/admin/AdminShell'
import { useAuth } from '@/context/AuthContext'
import { formatAdminRpcError } from '@/lib/adminRpcError'
import { adminRpc } from '@/lib/adminRpc'

type DigitalDelivery = { order_id: string; product_id: string; buyer_id: string; seller_id?: string; delivery_type: string; status: string; created_at: string }

export default function AdminDeliveries() {
  const { user } = useAuth()
  const [digital, setDigital] = useState<DigitalDelivery[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!user?.uid) return
    setLoading(true)
    setError(null)
    const result = await adminRpc('admin_list_digital_deliveries', { p_admin_id: user.uid })
    setDigital((result.data ?? []) as DigitalDelivery[])
    if (result.error) setError(formatAdminRpcError(result.error, 'Digital delivery data', '046 admin read-scope migration'))
    setLoading(false)
  }, [user?.uid])

  useEffect(() => { void load() }, [load])

  return <AdminShell><AdminPageHeader title="ডিজিটাল ডেলিভারি অপারেশন" description="License, key, file, access ও instructions delivery readiness এবং risk review এক জায়গা থেকে দেখুন।" /><AdminTableCard><div className="flex items-center gap-3 border-b border-slate-200 px-5 py-4"><span className="bg-brand-50 p-2 text-brand-700"><Download size={18} /></span><div><h2 className="font-semibold text-slate-900">Digital delivery queue</h2><p className="mt-1 text-xs text-slate-500">Payment verified হওয়ার পরে delivery record এবং access state নজরদারি করুন।</p></div></div>{loading ? <p className="p-8 text-center text-sm text-slate-500">লোড হচ্ছে...</p> : digital.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">কোনো digital delivery record নেই।</p> : <div className="divide-y divide-slate-100">{digital.map((delivery) => <div key={delivery.order_id} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-mono text-sm text-slate-800">Order {delivery.order_id.slice(0, 10)}</p><p className="mt-1 text-xs text-slate-400">Buyer {delivery.buyer_id.slice(0, 10)} · {delivery.delivery_type}</p></div><span className={`inline-flex w-fit items-center gap-1 px-2.5 py-1 text-xs font-semibold ${delivery.status === 'READY' ? 'bg-brand-50 text-brand-700' : delivery.status === 'REVOKED' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>{delivery.status === 'READY' ? <CheckCircle2 size={13} /> : <Clock3 size={13} />}{delivery.status}</span></div>)}</div>}{error && <p className="border-t border-red-100 bg-red-50 p-4 text-sm text-red-700">{error}</p>}</AdminTableCard></AdminShell>
}
