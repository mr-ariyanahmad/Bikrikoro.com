import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ArrowUpRight, BadgeCheck, BarChart3, CalendarDays, ShoppingBag, TicketPercent } from 'lucide-react'
import { Link } from 'react-router-dom'
import { formatDateTime, formatTaka } from '@/lib/format'
import { AdminPageHeader, AdminShell, AdminStatCard, AdminTableCard } from '@/components/admin/AdminShell'
import { adminRpc } from '@/lib/adminRpc'

type RecentOrder = { id: string; product_title: string; price: number; status: string; created_at: string; buyer_name?: string | null; seller_name?: string | null }
type AnalyticsPoint = { day: string; orders: number; revenue: number }

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
  const [stats, setStats] = useState({ orders: 0, customers: 0, products: 0, pending: 0, disputes: 0, sellers: 0, revenue: 0, total_wallet_balance: 0, wallet_users: 0, unread_chats: 0, unread_notifications: 0, ledger_entries: 0 })
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([])
  const [error, setError] = useState<string | null>(null)
  const [overviewRange, setOverviewRange] = useState('TODAY')
  const [analyticsRange, setAnalyticsRange] = useState('30')
  const [analytics, setAnalytics] = useState<AnalyticsPoint[]>([])

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const { data, error: loadError } = await adminRpc('admin_get_dashboard_overview')
        if (loadError) throw loadError
        if (!active) return
        const overview = (data ?? {}) as { orders?: number; customers?: number; products?: number; pending?: number; disputes?: number; sellers?: number; revenue?: number; total_wallet_balance?: number; wallet_users?: number; unread_chats?: number; unread_notifications?: number; ledger_entries?: number; recent_orders?: RecentOrder[]; sales_analytics?: AnalyticsPoint[] }
        setStats({ orders: Number(overview.orders ?? 0), customers: Number(overview.customers ?? 0), products: Number(overview.products ?? 0), pending: Number(overview.pending ?? 0), disputes: Number(overview.disputes ?? 0), sellers: Number(overview.sellers ?? 0), revenue: Number(overview.revenue ?? 0), total_wallet_balance: Number(overview.total_wallet_balance ?? 0), wallet_users: Number(overview.wallet_users ?? 0), unread_chats: Number(overview.unread_chats ?? 0), unread_notifications: Number(overview.unread_notifications ?? 0), ledger_entries: Number(overview.ledger_entries ?? 0) })
        setRecentOrders(overview.recent_orders ?? [])
        setAnalytics(overview.sales_analytics ?? [])
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
      <AdminPageHeader title="আজকের Overview" description="BikriKoro-এর বিক্রি, কাস্টমার এবং অপারেশন এক নজরে দেখুন।" actions={<div className="flex flex-wrap gap-2"><label className="inline-flex items-center gap-2 rounded-xl border border-outline bg-white px-3 py-2 text-sm font-semibold text-ink-600"><CalendarDays size={15} /><select value={overviewRange} onChange={(event) => setOverviewRange(event.target.value)} className="bg-transparent outline-none"><option value="TODAY">আজ</option><option value="7D">শেষ ৭ দিন</option><option value="30D">শেষ ৩০ দিন</option><option value="ALL">সব সময়</option></select></label><Link to="/admin/products" className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-brand-600">প্রোডাক্ট ম্যানেজ করুন <ArrowUpRight size={16} /></Link></div>} />
      {error && <p className="mb-4 rounded-xl border border-red-100 bg-red-50 p-4 text-sm font-medium text-red-700">Dashboard লোড করা যায়নি: {error}</p>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard label="মোট অর্ডার" value={loading ? '—' : stats.orders.toLocaleString('bn-BD')} helper={`${stats.pending.toLocaleString('bn-BD')}টি চলমান`} tone="blue" />
        <AdminStatCard label="মোট রেভিনিউ" value={loading ? '—' : formatTaka(stats.revenue)} helper="পেমেন্টেড অর্ডার" tone="green" />
        <AdminStatCard label="কাস্টমার" value={loading ? '—' : stats.customers.toLocaleString('bn-BD')} helper="রেজিস্টার্ড প্রোফাইল" tone="amber" />
        <AdminStatCard label="প্রোডাক্ট" value={loading ? '—' : stats.products.toLocaleString('bn-BD')} helper="ক্যাটালগে প্রকাশিত" tone="green" />
        <AdminStatCard label="Total User Wallet Balance" value={loading ? '—' : formatTaka(stats.total_wallet_balance)} helper={`${stats.wallet_users.toLocaleString('bn-BD')}টি wallet`} tone="blue" />
        <AdminStatCard label="অপঠিত চ্যাট" value={loading ? '—' : stats.unread_chats.toLocaleString('bn-BD')} helper="সব thread মিলিয়ে" tone="amber" />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <QuickAction href="/admin/orders" title="অর্ডার অপারেশন" detail="সব অর্ডার ও ডেলিভারি দেখুন" icon={ShoppingBag} tone="green" />
        <QuickAction href="/admin/coupons" title="কুপন তৈরি করুন" detail="নতুন promotion code যোগ করুন" icon={TicketPercent} tone="blue" />
        <QuickAction href="/admin/disputes" title="ডিসপিউট রিভিউ" detail={`${stats.disputes.toLocaleString('bn-BD')}টি অপেক্ষায়`} icon={AlertTriangle} tone="red" />
        <QuickAction href="/admin/sellers" title="সেলার যাচাই" detail={`${stats.sellers.toLocaleString('bn-BD')}টি আবেদন`} icon={BadgeCheck} tone="amber" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <AdminTableCard><div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4"><div className="flex items-center gap-2"><BarChart3 size={18} className="text-brand-700" /><div><h2 className="font-semibold text-slate-900">Sales &amp; Revenue Overview</h2><p className="mt-0.5 text-xs text-slate-500">Orders এবং completed revenue-এর দৈনিক trend</p></div></div><select value={analyticsRange} onChange={(event) => setAnalyticsRange(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600"><option value="7">7 Days</option><option value="30">30 Days</option><option value="90">3 Months</option><option value="365">12 Months</option></select></div><AnalyticsChart points={analytics} days={Number(analyticsRange)} /></AdminTableCard>
        <AdminTableCard><div className="border-b border-slate-200 px-5 py-4"><h2 className="font-semibold text-slate-900">Pending Actions</h2><p className="mt-0.5 text-xs text-slate-500">Admin-এর এখনকার গুরুত্বপূর্ণ queue</p></div><div className="space-y-2 p-4"><HealthRow label="Seller Verification" value={stats.sellers} href="/admin/sellers" tone="blue" /><HealthRow label="Disputed Orders" value={stats.disputes} href="/admin/disputes" tone="red" /><HealthRow label="Pending Orders" value={stats.pending} href="/admin/orders" tone="amber" /><HealthRow label="Unread Notifications" value={stats.unread_notifications} href="/admin/notifications" tone="green" /></div></AdminTableCard>
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <AdminTableCard>
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4"><div><h2 className="font-semibold text-slate-900">সাম্প্রতিক অর্ডার</h2><p className="mt-0.5 text-xs text-slate-500">সর্বশেষ marketplace activity</p></div><Link to="/admin/orders" className="text-sm font-semibold text-brand-700 hover:underline">সব দেখুন</Link></div>
          {loading ? <div className="space-y-3 p-5">{[1, 2, 3, 4].map((item) => <div key={item} className="h-12 animate-pulse rounded-xl bg-slate-100" />)}</div> : recentOrders.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">এখনো কোনো অর্ডার নেই।</p> : <div className="divide-y divide-slate-100">{recentOrders.map((order) => <Link to={`/admin/orders/${order.id}`} key={order.id} className="flex items-center justify-between gap-3 px-5 py-4 hover:bg-slate-50"><div className="min-w-0"><p className="truncate text-sm font-medium text-slate-800">{order.product_title}</p><p className="mt-1 truncate text-xs text-slate-400">#{order.id.slice(0, 8)} · Buyer: {order.buyer_name || '—'} · Seller: {order.seller_name || '—'} · {formatDateTime(order.created_at)}</p></div><div className="shrink-0 text-right"><p className="text-sm font-semibold text-slate-900">{formatTaka(order.price)}</p><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">{statusLabel[order.status] ?? order.status}</span></div></Link>)}</div>}
        </AdminTableCard>

        <AdminTableCard>
          <div className="border-b border-slate-200 px-5 py-4"><h2 className="font-semibold text-slate-900">অপারেশন হেলথ</h2><p className="mt-0.5 text-xs text-slate-500">আজকের গুরুত্বপূর্ণ queue</p></div>
          <div className="space-y-3 p-5"><HealthRow label="অপেক্ষমাণ পেমেন্ট/অর্ডার" value={stats.pending} href="/admin/orders" tone="amber" /><HealthRow label="ডিসপিউট রিভিউ" value={stats.disputes} href="/admin/disputes" tone="red" /><HealthRow label="সেলার আবেদন" value={stats.sellers} href="/admin/sellers" tone="blue" /></div>
        </AdminTableCard>
      </div>
    </AdminShell>
  )
}

function AnalyticsChart({ points, days }: { points: AnalyticsPoint[]; days: number }) {
  const visible = useMemo(() => points.slice(-days), [days, points])
  const maxRevenue = Math.max(1, ...visible.map((point) => Number(point.revenue)))
  if (visible.length === 0) return <p className="p-8 text-center text-sm text-slate-500">এই সময়ের কোনো sales data নেই।</p>
  return <div className="p-5"><div className="flex h-44 items-end gap-1 overflow-x-auto border-b border-slate-200 pb-1">{visible.map((point) => <div key={point.day} className="group flex h-full min-w-2 flex-1 items-end"><div title={`${point.day}: ${formatTaka(Number(point.revenue))} · ${point.orders} orders`} className="w-full rounded-t bg-brand-400 transition hover:bg-brand-600" style={{ height: `${Math.max(5, Number(point.revenue) / maxRevenue * 100)}%` }} /></div>)}</div><div className="mt-3 flex items-center justify-between text-xs text-slate-500"><span>Revenue</span><span>Orders: {visible.reduce((total, point) => total + Number(point.orders), 0).toLocaleString('bn-BD')}</span></div></div>
}

function QuickAction({ href, title, detail, icon: Icon, tone }: { href: string; title: string; detail: string; icon: typeof ShoppingBag; tone: 'green' | 'blue' | 'amber' | 'red' }) {
  const tones = { green: 'bg-brand-50 text-brand-700', blue: 'bg-blue-50 text-blue-700', amber: 'bg-amber-50 text-amber-700', red: 'bg-red-50 text-red-700' }
  return <Link to={href} className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_6px_18px_rgba(15,23,42,0.035)] transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-[0_10px_22px_rgba(15,23,42,0.08)]"><span className="flex items-start justify-between"><span className={`flex h-10 w-10 items-center justify-center rounded-xl ${tones[tone]}`}><Icon size={19} strokeWidth={2} /></span><ArrowUpRight size={17} className="text-slate-300 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-brand-600" /></span><p className="mt-4 text-sm font-bold text-slate-800">{title}</p><p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p></Link>
}

function HealthRow({ label, value, href, tone }: { label: string; value: string | number; href: string; tone: 'green' | 'blue' | 'amber' | 'red' }) {
  const colors = { green: 'bg-brand-50 text-brand-700', blue: 'bg-blue-50 text-blue-700', amber: 'bg-amber-50 text-amber-700', red: 'bg-red-50 text-red-700' }
  return <Link to={href} className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-3 transition hover:border-brand-100 hover:bg-brand-50/40"><span className="text-sm font-medium text-slate-600">{label}</span><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${colors[tone]}`}>{typeof value === 'number' ? value.toLocaleString('bn-BD') : value}</span></Link>
}
