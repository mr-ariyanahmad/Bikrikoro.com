import { useCallback, useEffect, useState } from 'react'
import { BarChart3, Clock3, Eye, Heart, RefreshCw, Share2, ShoppingBag } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { formatTaka } from '@/lib/format'
import { adminRpc } from '@/lib/adminRpc'
import { formatAdminRpcError } from '@/lib/adminRpcError'
import { BrandedDialog, DialogButton } from '@/components/BrandedDialog'
import { AdminPageHeader, AdminShell, AdminStatCard, AdminTableCard } from '@/components/admin/AdminShell'

type AnalyticsRow = { id: string; title: string; price: number; original_price: number | null; image_url: string | null; views: number; favorites: number; shares: number; completed_orders: number; revenue: number; conversion_rate: number }
type PricePoint = { id: string; price: number; original_price: number | null; changed_at: string; reason: string | null }

export default function AdminProductAnalytics() {
  const { user } = useAuth()
  const [rows, setRows] = useState<AnalyticsRow[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<string | null>(null)
  const [historyProduct, setHistoryProduct] = useState<AnalyticsRow | null>(null)
  const [history, setHistory] = useState<PricePoint[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await adminRpc<{ products?: AnalyticsRow[] }>('admin_get_product_analytics', { p_admin_id: user?.uid, p_limit: 200 })
    if (error) setMessage(formatAdminRpcError(error, 'Product analytics', '116 product analytics price history migration'))
    else setRows(data?.products ?? [])
    setLoading(false)
  }, [user?.uid])
  useEffect(() => { void load() }, [load])

  const openHistory = async (row: AnalyticsRow) => {
    setHistoryProduct(row)
    setHistory([])
    setHistoryLoading(true)
    const { data, error } = await adminRpc<PricePoint[]>('admin_get_product_price_history', { p_admin_id: user?.uid, p_product_id: row.id })
    if (error) setMessage(formatAdminRpcError(error, 'Price history', '116 product analytics price history migration'))
    else setHistory(data ?? [])
    setHistoryLoading(false)
  }

  const totalViews = rows.reduce((sum, row) => sum + Number(row.views), 0)
  const totalOrders = rows.reduce((sum, row) => sum + Number(row.completed_orders), 0)
  const totalRevenue = rows.reduce((sum, row) => sum + Number(row.revenue), 0)
  const totalShares = rows.reduce((sum, row) => sum + Number(row.shares), 0)

  return <AdminShell><AdminPageHeader title="Product Performance Analytics" description="Views, favorites, shares, completed orders, revenue ও conversion rate এক জায়গা থেকে দেখুন।" actions={<button type="button" onClick={() => void load()} className="inline-flex items-center gap-2 rounded-xl border border-outline bg-white px-4 py-2.5 text-sm font-bold text-ink-600 hover:border-brand-400 hover:text-brand-700"><RefreshCw size={16} />রিফ্রেশ</button>} />
    {message && <p className="mb-4 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">{message}</p>}
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><AdminStatCard label="মোট views" value={totalViews.toLocaleString('bn-BD')} helper="সব active product" tone="blue" /><AdminStatCard label="Completed orders" value={totalOrders.toLocaleString('bn-BD')} helper="বাস্তব conversion" tone="green" /><AdminStatCard label="Product revenue" value={formatTaka(totalRevenue)} helper="completed orders" tone="green" /><AdminStatCard label="মোট shares" value={totalShares.toLocaleString('bn-BD')} helper="share tracking events" tone="amber" /></div>
    <AdminTableCard className="mt-6"><div className="flex items-center gap-2 border-b border-slate-200 px-5 py-4"><BarChart3 size={18} className="text-brand-700" /><div><h2 className="font-semibold text-slate-900">Product performance</h2><p className="mt-0.5 text-xs text-slate-500">Conversion অনুযায়ী product performance সাজানো হয়েছে।</p></div></div>
      {loading ? <p className="p-10 text-center text-sm text-slate-500">Analytics লোড হচ্ছে...</p> : rows.length === 0 ? <p className="p-10 text-center text-sm text-slate-500">এখনো কোনো product analytics নেই।</p> : <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">{rows.map((row) => <div key={row.id} className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-200 hover:bg-white hover:shadow-md"><div className="flex min-w-0 items-center gap-3"><div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-slate-100">{row.image_url && <img src={row.image_url} alt="" className="h-full w-full object-cover" />}</div><div className="min-w-0"><p className="truncate font-bold text-slate-800">{row.title}</p><p className="mt-1 text-xs text-slate-500">বর্তমান দাম: {formatTaka(row.price)}</p></div></div><Metric icon={Eye} label="Views" value={row.views} /><Metric icon={Heart} label="Favorites" value={row.favorites} /><Metric icon={Share2} label="Shares" value={row.shares} /><Metric icon={ShoppingBag} label="Orders" value={row.completed_orders} /><div><p className="text-[11px] text-slate-400">Conversion</p><p className={`mt-1 text-sm font-extrabold ${row.conversion_rate >= 3 ? 'text-brand-700' : row.conversion_rate > 0 ? 'text-amber-700' : 'text-slate-500'}`}>{Number(row.conversion_rate).toFixed(2)}%</p></div><button type="button" onClick={() => void openHistory(row)} className="inline-flex items-center justify-center gap-1 rounded-lg border border-brand-200 px-3 py-2 text-xs font-bold text-brand-700 hover:bg-brand-50"><Clock3 size={14} />Price history</button></div>)}</div>}
    </AdminTableCard>
    <BrandedDialog open={Boolean(historyProduct)} title="Price history" onClose={() => setHistoryProduct(null)} actions={<DialogButton onClick={() => setHistoryProduct(null)}>বন্ধ করুন</DialogButton>}><p className="mb-3 font-semibold text-ink-900">{historyProduct?.title}</p>{historyLoading ? <p>History লোড হচ্ছে...</p> : history.length === 0 ? <p>কোনো price history নেই।</p> : <div className="max-h-72 space-y-2 overflow-y-auto">{history.map((point) => <div key={point.id} className="flex items-center justify-between gap-3 rounded-xl border border-outline bg-bg p-3"><div><p className="font-bold text-ink-900">{formatTaka(point.price)}</p><p className="mt-1 text-xs text-ink-500">{point.reason === 'initial' || point.reason === 'backfill' ? 'প্রথম price' : 'Price update'}</p></div><span className="text-right text-xs text-ink-500">{new Date(point.changed_at).toLocaleString('bn-BD')}</span></div>)}</div>}</BrandedDialog>
  </AdminShell>
}

function Metric({ icon: Icon, label, value }: { icon: typeof Eye; label: string; value: number }) { return <div><p className="flex items-center gap-1 text-[11px] text-slate-400"><Icon size={12} />{label}</p><p className="mt-1 text-sm font-bold text-slate-800">{Number(value).toLocaleString('bn-BD')}</p></div> }
