import { useEffect, useState } from 'react'
import { Bell, Download, TrendingUp } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { Layout } from '@/components/Layout'
import { useIsSeller } from '@/hooks/useIsSeller'
import { formatTaka } from '@/lib/format'
import { loadUnreadNotificationCount } from '@/lib/marketplace'

interface SellerProductMetrics { view_count: number | null; price: number | null; is_hidden?: boolean }

interface Stats {
  listingCount: number
  totalViews: number
  activeOrders: number
  completedSales: number
  totalEarnings: number
  isVerified: boolean
  rating: number
  reviewCount: number
  conversionRate: number
  averageSale: number
}

export default function SellerDashboard() {
  const { user } = useAuth()
  const uid = user?.uid ?? ''
  const { isSeller, loading: sellerAccessLoading } = useIsSeller()
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [unreadNotifications, setUnreadNotifications] = useState(0)

  useEffect(() => {
    if (!uid || sellerAccessLoading || !isSeller) {
      if (!sellerAccessLoading && !isSeller) setLoading(false)
      return
    }
    let active = true
    setLoading(true)
    setLoadError(null)
    async function load() {
      try {
        const [productsRes, ordersRes, ledgerRes, profileRes] = await Promise.all([
          supabase.rpc('seller_list_products', { p_seller_id: uid }),
          supabase.from('orders').select('status, price').eq('seller_id', uid),
          supabase.from('wallet_ledger').select('amount').eq('user_id', uid).eq('type', 'SELLER_PAYOUT'),
          supabase.from('profiles').select('is_verified, rating, review_count').eq('id', uid).maybeSingle(),
        ])
        if (productsRes.error) throw productsRes.error
        if (ordersRes.error) throw ordersRes.error
        if (ledgerRes.error) throw ledgerRes.error
        if (profileRes.error) throw profileRes.error
        if (!active) return

        const products = (productsRes.data ?? []) as SellerProductMetrics[]
        const orders = ordersRes.data ?? []
        const ledger = ledgerRes.data ?? []
        const totalViews = products.reduce((sum, p) => sum + (p.view_count ?? 0), 0)
        const completedOrders = orders.filter((o) => o.status === 'COMPLETED')

        setStats({
          listingCount: products.filter((product) => product.is_hidden !== true).length,
          totalViews,
          activeOrders: orders.filter((o) => ['ESCROW_HELD', 'PREPARING', 'SHIPPED', 'DELIVERED'].includes(o.status)).length,
          completedSales: completedOrders.length,
          totalEarnings: ledger.reduce((sum, l) => sum + Number(l.amount), 0),
          isVerified: profileRes.data?.is_verified ?? false,
          rating: profileRes.data?.rating ?? 0,
          reviewCount: profileRes.data?.review_count ?? 0,
          conversionRate: totalViews > 0 ? (completedOrders.length / totalViews) * 100 : 0,
          averageSale: completedOrders.length > 0 ? completedOrders.reduce((sum, order) => sum + Number(order.price ?? 0), 0) / completedOrders.length : 0,
        })
      } catch (error) {
        console.error('Seller dashboard load failed:', error)
        if (active) setLoadError(error instanceof Error ? error.message : 'সেলার ড্যাশবোর্ড লোড করা যায়নি।')
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => { active = false }
  }, [isSeller, sellerAccessLoading, uid])

  useEffect(() => {
    if (!uid || !isSeller) return
    void loadUnreadNotificationCount(uid).then(setUnreadNotifications).catch(() => setUnreadNotifications(0))
  }, [isSeller, uid])

  const exportPerformance = () => {
    if (!stats) return
    const csv = [['মেট্রিক', 'মান'], ['সক্রিয় লিস্টিং', stats.listingCount], ['মোট ভিউ', stats.totalViews], ['চলমান অর্ডার', stats.activeOrders], ['সম্পন্ন বিক্রয়', stats.completedSales], ['Conversion rate (%)', stats.conversionRate.toFixed(2)], ['Average sale (BDT)', stats.averageSale.toFixed(2)], ['মোট আয় (BDT)', stats.totalEarnings]].map((row) => row.join(',')).join('\\n')
    const url = URL.createObjectURL(new Blob([`\\ufeff${csv}`], { type: 'text/csv;charset=utf-8' })); const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'bikrikoro-seller-performance.csv'; anchor.click(); URL.revokeObjectURL(url); setNotice('Seller report download হয়েছে।')
  }

  if (sellerAccessLoading) {
    return <Layout wide><div className="h-72 animate-pulse rounded-2xl bg-outline/40" /></Layout>
  }

  if (!isSeller) {
    return <Layout wide><div className="mx-auto max-w-xl rounded-3xl border border-outline bg-surface p-8 text-center"><h1 className="text-xl font-bold text-ink-900">সেলার অ্যাকাউন্ট অনুমোদিত নয়</h1><p className="mt-2 text-sm leading-6 text-ink-600">সেলার ড্যাশবোর্ড ব্যবহার করতে আগে seller verification সম্পন্ন ও অনুমোদিত হতে হবে।</p><Link to="/become-seller" className="mt-5 inline-flex rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-600">সেলার হওয়ার আবেদন করুন</Link></div></Layout>
  }

  return (
    <Layout wide>
      <Helmet>
        <title>সেলার ড্যাশবোর্ড | BikriKoro.Com</title>
      </Helmet>

      <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-xl font-semibold text-ink-900">সেলার ড্যাশবোর্ড</h1><div className="flex items-center gap-2">{stats && <button type="button" onClick={exportPerformance} className="inline-flex items-center gap-1.5 rounded-lg border border-outline px-3 py-2 text-xs font-semibold text-ink-600 hover:border-brand-500 hover:text-brand-600"><Download size={14} />রিপোর্ট</button>}{stats && !stats.isVerified && (
          <Link
            to="/become-seller/verify"
            className="rounded-lg border border-brand-500 px-3 py-1.5 text-xs font-semibold text-brand-600 hover:bg-brand-50"
          >
            ভেরিফাই করুন
          </Link>
        )}</div></div>
      {notice && <p className="mt-3 rounded-xl bg-brand-50 p-3 text-sm text-brand-700">{notice}</p>}
      {loadError && <p className="mt-3 border border-error/20 bg-error/5 p-3 text-sm text-error">ড্যাশবোর্ড লোড করা যায়নি: {loadError}</p>}

      {loading || !stats ? (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-outline/40" />
          ))}
        </div>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="সক্রিয় লিস্টিং" value={stats.listingCount.toString()} />
            <StatCard label="মোট ভিউ" value={stats.totalViews.toString()} />
            <StatCard label="চলমান অর্ডার" value={stats.activeOrders.toString()} />
            <StatCard label="সম্পন্ন বিক্রয়" value={stats.completedSales.toString()} />
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3"><div className="rounded-xl border border-outline bg-surface p-5"><div className="flex items-center justify-between"><p className="text-sm text-ink-600">Conversion rate</p><TrendingUp size={18} className="text-brand-600" /></div><p className="mt-1 text-2xl font-bold text-brand-600">{stats.conversionRate.toFixed(2)}%</p><p className="mt-1 text-xs text-ink-300">মোট ভিউ থেকে completed sale</p></div><div className="rounded-xl border border-outline bg-surface p-5"><p className="text-sm text-ink-600">Average sale</p><p className="tabular-amount mt-1 text-2xl font-bold text-ink-900">{formatTaka(stats.averageSale)}</p><p className="mt-1 text-xs text-ink-300">সম্পন্ন অর্ডারের গড়</p></div>
            <div className="rounded-xl border border-outline bg-surface p-5">
              <p className="text-sm text-ink-600">মোট আয় (ওয়ালেটে)</p>
              <p className="tabular-amount mt-1 text-2xl font-bold text-brand-600">
                {formatTaka(stats.totalEarnings)}
              </p>
              <Link to="/wallet" className="mt-2 inline-block text-xs font-medium text-brand-600">
                ওয়ালেট দেখুন →
              </Link>
            </div>
            <div className="rounded-xl border border-outline bg-surface p-5">
              <p className="text-sm text-ink-600">রেটিং</p>
              <p className="mt-1 text-2xl font-bold text-ink-900">
                {stats.reviewCount > 0 ? `★ ${stats.rating.toFixed(1)}` : '—'}
              </p>
              <p className="mt-1 text-xs text-ink-300">{stats.reviewCount}টি রিভিউ</p>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto]">
            <div className="rounded-xl border border-brand-100 bg-brand-50 p-4">
              <div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-brand-600"><Bell size={18} /></span><div><p className="font-semibold text-brand-900">নতুন নোটিফিকেশন</p><p className="mt-1 text-sm text-brand-800/80">Customer question, order ও payment update এখানে পাবেন।</p><p className="mt-2 text-2xl font-bold text-brand-700">{unreadNotifications}</p></div></div>
              <Link to="/notifications" className="mt-3 inline-flex text-sm font-semibold text-brand-700">সব নোটিফিকেশন দেখুন →</Link>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link to="/sell" className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600">+ নতুন পণ্য পোস্ট করুন</Link>
              <Link to="/my-listings" className="rounded-lg border border-outline px-4 py-2 text-sm font-medium text-ink-600 hover:border-brand-500">আমার লিস্টিং</Link>
              <Link to="/orders" className="rounded-lg border border-outline px-4 py-2 text-sm font-medium text-ink-600 hover:border-brand-500">অর্ডার ম্যানেজ করুন</Link>
            </div>
          </div>
        </>
      )}
    </Layout>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-outline bg-surface p-4">
      <p className="tabular-amount text-2xl font-bold text-ink-900">{value}</p>
      <p className="mt-1 text-xs text-ink-600">{label}</p>
    </div>
  )
}
