import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { formatDateTime, formatTaka } from '@/lib/format'
import { AdminPageHeader, AdminShell, AdminStatCard, AdminTableCard } from '@/components/admin/AdminShell'
import { adminRpc } from '@/lib/adminRpc'

type RecentOrder = { id: string; product_title: string; price: number; status: string; created_at: string }

const statusLabel: Record<string, string> = {
  PENDING_PAYMENT: 'পেমেন্ট বাকি',
  ESCROW_HELD: 'এসক্রোতে',
  PREPARING: 'প্রস্তুত করা হচ্ছে',
  SHIPPED: 'পাঠানো হয়েছে',
  DELIVERED: 'পৌঁছেছে',
  COMPLETED: 'সম্পন্ন',
  CANCELLED: 'বাতিল',
}

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ orders: 0, customers: 0, products: 0, pending: 0, disputes: 0, sellers: 0, revenue: 0 })
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const { data, error: loadError } = await adminRpc('admin_get_dashboard_overview')
        if (loadError) throw loadError
        if (!active) return
        const overview = (data ?? {}) as { orders?: number; customers?: number; products?: number; pending?: number; disputes?: number; sellers?: number; revenue?: number; recent_orders?: RecentOrder[] }
        setStats({ orders: Number(overview.orders ?? 0), customers: Number(overview.customers ?? 0), products: Number(overview.products ?? 0), pending: Number(overview.pending ?? 0), disputes: Number(overview.disputes ?? 0), sellers: Number(overview.sellers ?? 0), revenue: Number(overview.revenue ?? 0) })
        setRecentOrders(overview.recent_orders ?? [])
      } catch (loadError) {
        console.error('Admin dashboard load failed:', loadError)
        if (active) setError(loadError instanceof Error ? loadError.message : 'Dashboard data লোড করা যায়নি।')
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => { active = false }
  }, [])

  return (
    <AdminShell>
      <AdminPageHeader title="ড্যাশবোর্ড" description="BikriKoro-এর বিক্রি, কাস্টমার এবং অপারেশন এক নজরে দেখুন।" actions={<Link to="/admin/products" className="rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-600">+ প্রোডাক্ট ম্যানেজ করুন</Link>} />
      {error && <p className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">Dashboard লোড করা যায়নি: {error}</p>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard label="মোট অর্ডার" value={loading ? '—' : stats.orders.toLocaleString('bn-BD')} helper={`${stats.pending.toLocaleString('bn-BD')}টি চলমান`} tone="blue" />
        <AdminStatCard label="মোট রেভিনিউ" value={loading ? '—' : formatTaka(stats.revenue)} helper="পেমেন্টেড অর্ডার" tone="green" />
        <AdminStatCard label="কাস্টমার" value={loading ? '—' : stats.customers.toLocaleString('bn-BD')} helper="রেজিস্টার্ড প্রোফাইল" tone="amber" />
        <AdminStatCard label="প্রোডাক্ট" value={loading ? '—' : stats.products.toLocaleString('bn-BD')} helper="ক্যাটালগে প্রকাশিত" tone="green" />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link to="/admin/orders" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-300"><p className="text-sm font-semibold text-slate-800">অর্ডার অপারেশন</p><p className="mt-1 text-xs text-slate-500">সব অর্ডার ও ডেলিভারি দেখুন →</p></Link>
        <Link to="/admin/coupons" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-300"><p className="text-sm font-semibold text-slate-800">কুপন তৈরি করুন</p><p className="mt-1 text-xs text-slate-500">নতুন promotion code যোগ করুন →</p></Link>
        <Link to="/admin/disputes" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-300"><p className="text-sm font-semibold text-slate-800">ডিসপিউট রিভিউ</p><p className="mt-1 text-xs text-slate-500">{stats.disputes.toLocaleString('bn-BD')}টি অপেক্ষায় →</p></Link>
        <Link to="/admin/sellers" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-300"><p className="text-sm font-semibold text-slate-800">সেলার যাচাই</p><p className="mt-1 text-xs text-slate-500">{stats.sellers.toLocaleString('bn-BD')}টি আবেদন →</p></Link>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <AdminTableCard>
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4"><div><h2 className="font-semibold text-slate-900">সাম্প্রতিক অর্ডার</h2><p className="mt-0.5 text-xs text-slate-500">সর্বশেষ marketplace activity</p></div><Link to="/admin/orders" className="text-sm font-semibold text-brand-700 hover:underline">সব দেখুন</Link></div>
          {loading ? <div className="space-y-3 p-5">{[1, 2, 3, 4].map((item) => <div key={item} className="h-12 animate-pulse rounded-xl bg-slate-100" />)}</div> : recentOrders.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">এখনো কোনো অর্ডার নেই।</p> : <div className="divide-y divide-slate-100">{recentOrders.map((order) => <Link to={`/admin/orders/${order.id}`} key={order.id} className="flex items-center justify-between gap-3 px-5 py-4 hover:bg-slate-50"><div className="min-w-0"><p className="truncate text-sm font-medium text-slate-800">{order.product_title}</p><p className="mt-1 text-xs text-slate-400">#{order.id.slice(0, 8)} · {formatDateTime(order.created_at)}</p></div><div className="shrink-0 text-right"><p className="text-sm font-semibold text-slate-900">{formatTaka(order.price)}</p><span className="text-xs text-slate-500">{statusLabel[order.status] ?? order.status}</span></div></Link>)}</div>}
        </AdminTableCard>

        <AdminTableCard>
          <div className="border-b border-slate-200 px-5 py-4"><h2 className="font-semibold text-slate-900">অপারেশন হেলথ</h2><p className="mt-0.5 text-xs text-slate-500">আজকের গুরুত্বপূর্ণ queue</p></div>
          <div className="space-y-3 p-5"><HealthRow label="অপেক্ষমাণ পেমেন্ট/অর্ডার" value={stats.pending} href="/admin/orders" tone="amber" /><HealthRow label="ডিসপিউট রিভিউ" value={stats.disputes} href="/admin/disputes" tone="red" /><HealthRow label="সেলার আবেদন" value={stats.sellers} href="/admin/sellers" tone="blue" /><HealthRow label="সিস্টেম স্ট্যাটাস" value="OK" href="/admin/system-status" tone="green" /></div>
        </AdminTableCard>
      </div>
    </AdminShell>
  )
}

function HealthRow({ label, value, href, tone }: { label: string; value: string | number; href: string; tone: 'green' | 'blue' | 'amber' | 'red' }) {
  const colors = { green: 'bg-brand-50 text-brand-700', blue: 'bg-brand-50 text-brand-700', amber: 'bg-amber-50 text-amber-700', red: 'bg-red-50 text-red-700' }
  return <Link to={href} className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-3 hover:bg-slate-50"><span className="text-sm text-slate-600">{label}</span><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${colors[tone]}`}>{typeof value === 'number' ? value.toLocaleString('bn-BD') : value}</span></Link>
}
