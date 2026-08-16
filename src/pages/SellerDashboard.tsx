import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { Layout } from '@/components/Layout'
import { formatTaka } from '@/lib/format'

interface Stats {
  listingCount: number
  totalViews: number
  activeOrders: number
  completedSales: number
  totalEarnings: number
  isVerified: boolean
  rating: number
  reviewCount: number
}

export default function SellerDashboard() {
  const { user } = useAuth()
  const uid = user!.uid
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [productsRes, ordersRes, ledgerRes, profileRes] = await Promise.all([
        supabase.from('products').select('view_count').eq('seller_id', uid),
        supabase.from('orders').select('status').eq('seller_id', uid),
        supabase.from('wallet_ledger').select('amount').eq('user_id', uid).eq('type', 'SELLER_PAYOUT'),
        supabase.from('profiles').select('is_verified, rating, review_count').eq('id', uid).maybeSingle(),
      ])

      const products = productsRes.data ?? []
      const orders = ordersRes.data ?? []
      const ledger = ledgerRes.data ?? []

      setStats({
        listingCount: products.length,
        totalViews: products.reduce((sum, p) => sum + (p.view_count ?? 0), 0),
        activeOrders: orders.filter((o) => ['ESCROW_HELD', 'SHIPPED'].includes(o.status)).length,
        completedSales: orders.filter((o) => o.status === 'COMPLETED').length,
        totalEarnings: ledger.reduce((sum, l) => sum + Number(l.amount), 0),
        isVerified: profileRes.data?.is_verified ?? false,
        rating: profileRes.data?.rating ?? 0,
        reviewCount: profileRes.data?.review_count ?? 0,
      })
      setLoading(false)
    }
    load()
  }, [uid])

  return (
    <Layout wide>
      <Helmet>
        <title>সেলার ড্যাশবোর্ড | BikriKoro.Com</title>
      </Helmet>

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-ink-900">সেলার ড্যাশবোর্ড</h1>
        {stats && !stats.isVerified && (
          <Link
            to="/become-seller/verify"
            className="rounded-lg border border-brand-500 px-3 py-1.5 text-xs font-semibold text-brand-600 hover:bg-brand-50"
          >
            ভেরিফাই করুন
          </Link>
        )}
      </div>

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

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
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

          <div className="mt-6 flex flex-wrap gap-2">
            <Link to="/sell" className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600">
              + নতুন পণ্য পোস্ট করুন
            </Link>
            <Link to="/my-listings" className="rounded-lg border border-outline px-4 py-2 text-sm font-medium text-ink-600 hover:border-brand-500">
              আমার লিস্টিং
            </Link>
            <Link to="/orders" className="rounded-lg border border-outline px-4 py-2 text-sm font-medium text-ink-600 hover:border-brand-500">
              অর্ডার ম্যানেজ করুন
            </Link>
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
