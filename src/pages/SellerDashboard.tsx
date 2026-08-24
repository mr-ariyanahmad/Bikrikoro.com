import { useCallback, useEffect, useMemo, useState } from 'react'
import { Activity, ArrowUpRight, BarChart3, Bell, CheckCircle2, ChevronRight, Clock3, CreditCard, Download, Eye, HelpCircle, LayoutDashboard, MessageCircle, Package, Plus, RefreshCw, Settings, ShieldCheck, ShoppingCart, Star, TrendingUp, UserRound, WalletCards, Zap, type LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { supabase } from '@/lib/supabase'
import { auth } from '@/lib/firebase'
import { useAuth } from '@/context/AuthContext'
import { Layout } from '@/components/Layout'
import { useIsSeller } from '@/hooks/useIsSeller'
import { formatDate, formatDateTime, formatTaka } from '@/lib/format'
import { loadNotifications, loadUnreadNotificationCount } from '@/lib/marketplace'
import { ShopProfileEditor } from '@/components/ShopProfileEditor'
import type { Profile, Product } from '@/types/product'
import type { OrderStatus } from '@/types/order'
import type { WalletBalance, WalletWithdrawalSummary } from '@/types/wallet'

interface SellerOrder {
  id: string
  buyer_id: string
  seller_id: string
  product_id: string
  product_title: string
  product_image: string | null
  price: number
  status: OrderStatus
  created_at: string
}

interface SellerNotification {
  id: string
  title: string
  body: string
  link: string | null
  is_read: boolean
  created_at: string
}

interface DashboardData {
  products: Product[]
  orders: SellerOrder[]
  profile: Profile | null
  wallet: WalletBalance | null
  withdrawalSummary: WalletWithdrawalSummary | null
  walletWarning: string | null
  notifications: SellerNotification[]
  unreadNotificationCount: number
}

const STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING_PAYMENT: 'পেমেন্ট বাকি',
  ESCROW_HELD: 'এসক্রোতে',
  PREPARING: 'প্রস্তুত করা হচ্ছে',
  SHIPPED: 'পাঠানো হয়েছে',
  DELIVERED: 'পৌঁছে দেওয়া হয়েছে',
  DIGITAL_DELIVERED: 'ডিজিটাল ডেলিভারি প্রস্তুত',
  COMPLETED: 'সম্পন্ন',
  CANCELLED: 'বাতিল',
  DISPUTED: 'অভিযোগ পর্যালোচনাধীন',
  REFUNDED: 'অর্থ ফেরত সম্পন্ন',
}

const STATUS_CLASS: Record<OrderStatus, string> = {
  PENDING_PAYMENT: 'bg-amber-50 text-amber-800',
  ESCROW_HELD: 'bg-sky-50 text-sky-800',
  PREPARING: 'bg-slate-100 text-slate-700',
  SHIPPED: 'bg-slate-100 text-slate-700',
  DELIVERED: 'bg-slate-100 text-slate-700',
  DIGITAL_DELIVERED: 'bg-violet-50 text-violet-800',
  COMPLETED: 'bg-brand-50 text-brand-800',
  CANCELLED: 'bg-red-50 text-red-800',
  DISPUTED: 'bg-orange-50 text-orange-800',
  REFUNDED: 'bg-slate-100 text-slate-700',
}

const sellerNav: Array<{ to: string; label: string; icon: LucideIcon }> = [
  { to: '/seller/dashboard', label: 'ড্যাশবোর্ড', icon: LayoutDashboard },
  { to: '/my-listings', label: 'আমার লিস্টিং', icon: Package },
  { to: '/orders', label: 'অর্ডার', icon: ShoppingCart },
  { to: '/chat', label: 'মেসেজ', icon: MessageCircle },
  { to: '/wallet', label: 'ওয়ালেট', icon: WalletCards },
  { to: '/notifications', label: 'নোটিফিকেশন', icon: Bell },
]

export default function SellerDashboard() {
  const { user } = useAuth()
  const uid = user?.uid ?? ''
  const { isSeller, loading: sellerAccessLoading } = useIsSeller()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [profileEditorOpen, setProfileEditorOpen] = useState(false)

  const loadDashboard = useCallback(async (background = false) => {
    if (!uid || !isSeller) return
    if (background) setRefreshing(true)
    else setLoading(true)
    setLoadError(null)
    try {
      const idToken = await auth.currentUser?.getIdToken()
      if (!idToken) throw new Error('আপনার Firebase session পাওয়া যায়নি। আবার login করুন।')
      const [productsRes, profileRes, orderListRes, walletRes, notificationRes, unreadCountRes] = await Promise.all([
        supabase.rpc('seller_list_products', { p_seller_id: uid }),
        loadSellerProfile(uid),
        fetch('/api/order-read', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` }, body: JSON.stringify({ action: 'list' }) }),
        fetch('/api/order-read', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` }, body: JSON.stringify({ action: 'wallet' }) }),
        loadNotifications(uid),
        loadUnreadNotificationCount(uid),
      ])
      if (productsRes.error) throw productsRes.error
      if (profileRes.error) throw profileRes.error
      const orderPayload = await orderListRes.json().catch(() => ({})) as { error?: string; orders?: SellerOrder[] }
      if (!orderListRes.ok) throw new Error(orderPayload.error || 'সেলার অর্ডার লোড করা যায়নি।')
      const walletPayload = await walletRes.json().catch(() => ({})) as { error?: string; balance?: WalletBalance; withdrawalSummary?: WalletWithdrawalSummary | null; warning?: string | null }
      if (!walletRes.ok) throw new Error(walletPayload.error || 'ওয়ালেট ডেটা লোড করা যায়নি।')
      setData({
        products: (productsRes.data ?? []) as Product[],
        orders: (orderPayload.orders ?? []).filter((order) => order.seller_id === uid),
        profile: profileRes.data as Profile | null,
        wallet: walletPayload.balance ?? null,
        withdrawalSummary: walletPayload.withdrawalSummary ?? null,
        walletWarning: walletPayload.warning ?? null,
        notifications: (notificationRes as SellerNotification[]).slice(0, 5),
        unreadNotificationCount: unreadCountRes,
      })
    } catch (error) {
      console.error('Seller dashboard load failed:', error)
      setLoadError(getErrorMessage(error))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [isSeller, uid])

  useEffect(() => {
    if (sellerAccessLoading || !isSeller || !uid) {
      if (!sellerAccessLoading && !isSeller) setLoading(false)
      return
    }
    void loadDashboard()
  }, [isSeller, sellerAccessLoading, uid, loadDashboard])

  useEffect(() => {
    if (!uid || !isSeller) return
    const channel = supabase.channel(`seller-dashboard-${uid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `seller_id=eq.${uid}` }, () => void loadDashboard(true))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${uid}` }, () => void loadDashboard(true))
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [isSeller, uid, loadDashboard])

  if (sellerAccessLoading) return <Layout wide><DashboardSkeleton /></Layout>

  if (!isSeller) {
    return <Layout wide><div className="mx-auto max-w-xl border border-outline bg-surface p-8 text-center shadow-sm"><ShieldCheck size={34} className="mx-auto text-brand-600" /><h1 className="mt-4 text-xl font-semibold text-ink-900">সেলার অ্যাকাউন্ট অনুমোদিত নয়</h1><p className="mt-2 text-base leading-6 text-ink-600">সেলার ড্যাশবোর্ড ব্যবহার করতে বিক্রেতার যাচাই সম্পন্ন ও অনুমোদিত হতে হবে।</p><Link to="/become-seller" className="mt-5 inline-flex border border-brand-500 bg-brand-500 px-4 py-2.5 text-base font-semibold text-white transition hover:bg-brand-600">সেলার হওয়ার আবেদন করুন</Link></div></Layout>
  }

  const stats = data ? buildStats(data.products, data.orders) : null
  const profile = data?.profile ?? null

  return (
    <Layout wide>
      <Helmet><title>সেলার ড্যাশবোর্ড | BikriKoro.Com</title></Helmet>
      <div className="grid w-full min-w-0 max-w-full gap-5 overflow-x-hidden lg:grid-cols-[14rem_minmax(0,1fr)]">
        <SellerSidebar unreadCount={data?.unreadNotificationCount ?? 0} />
        <main className="w-full min-w-0 max-w-full">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-outline pb-5">
            <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-700">বিক্রেতার কর্মক্ষেত্র</p><h1 className="mt-1 text-2xl font-bold tracking-tight text-ink-900">স্বাগতম, {profile?.shop_name || profile?.name || 'সেলার'}</h1><p className="mt-1 text-base text-ink-600">আপনার ডিজিটাল পণ্য, অর্ডার ও ওয়ালেট এক জায়গা থেকে পরিচালনা করুন।</p></div>
            <div className="flex flex-wrap gap-2"><button type="button" onClick={() => void loadDashboard(true)} className="inline-flex items-center gap-2 border border-outline bg-surface px-3 py-2.5 text-base font-medium text-ink-700 transition hover:border-brand-500 hover:text-brand-700"><RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />রিফ্রেশ</button><Link to="/sell" className="inline-flex items-center gap-2 border border-brand-500 bg-brand-500 px-3 py-2.5 text-base font-semibold text-white transition hover:bg-brand-600"><Plus size={17} />নতুন ডিজিটাল পণ্য</Link></div>
          </div>

          {notice && <p className="mt-4 border border-brand-200 bg-brand-50 p-3 text-base text-brand-800">{notice}</p>}
          {loadError && <p className="mt-4 border border-error/20 bg-error/5 p-3 text-base text-error">ড্যাশবোর্ড লোড করা যায়নি: {loadError}</p>}
          {data?.walletWarning && <p className="mt-4 border border-amber-200 bg-amber-50 p-3 text-base text-amber-800">{data.walletWarning}</p>}

          {loading || !data || !stats ? <DashboardSkeleton /> : (
            <>
              <ProfileHero profile={profile} productCount={stats.activeProducts} onEdit={() => setProfileEditorOpen((value) => !value)} />
              {profileEditorOpen && profile && <div className="mt-4 border border-outline bg-surface p-4 shadow-sm sm:p-5"><ShopProfileEditor profile={profile} onSaved={(nextProfile) => { setData((current) => current ? { ...current, profile: nextProfile } : current); setProfileEditorOpen(false); setNotice('শপের তথ্য আপডেট হয়েছে।') }} /></div>}

              <section className="mt-5 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard icon={ShoppingCart} label="আজকের বিক্রি" value={formatTaka(stats.todaySales)} tone="green" note="সম্পন্ন ডিজিটাল অর্ডার" />
                <MetricCard icon={BarChart3} label="এই মাসের বিক্রি" value={formatTaka(stats.monthSales)} tone="purple" note="চলতি মাস" />
                <MetricCard icon={CreditCard} label="মোট বিক্রি" value={formatTaka(stats.totalSales)} tone="orange" note={`${stats.completedOrders}টি সম্পন্ন অর্ডার`} />
                <MetricCard icon={WalletCards} label="ওয়ালেটের ব্যালেন্স" value={formatTaka(data.wallet?.available_balance ?? 0)} tone="blue" note="সুরক্ষিত ওয়ালেট তথ্য" />
                <MetricCard icon={Clock3} label="অপেক্ষমাণ অর্ডার" value={String(stats.pendingOrders)} tone="amber" note="পেমেন্ট বা ডেলিভারির কাজ বাকি" />
                <MetricCard icon={CheckCircle2} label="সম্পন্ন অর্ডার" value={String(stats.completedOrders)} tone="green" note="সফল ডিজিটাল ডেলিভারি" />
                <MetricCard icon={Package} label="মোট পণ্য" value={String(stats.activeProducts)} tone="purple" note={`${stats.pendingProducts}টি অনুমোদনের অপেক্ষায়`} />
                <MetricCard icon={Eye} label="মোট দেখার সংখ্যা" value={String(stats.totalViews)} tone="blue" note={stats.totalViews > 0 ? `দেখা থেকে বিক্রয় ${stats.conversionRate.toFixed(2)}%` : 'তথ্য জমা হলে হার দেখা যাবে'} />
              </section>

              <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.75fr)]">
                <SalesOverview orders={data.orders} />
                <WalletSummary balance={data.wallet} withdrawalSummary={data.withdrawalSummary} />
              </section>

              <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]">
                <RecentOrders orders={data.orders} />
                <NotificationPanel notifications={data.notifications} />
              </section>

              <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(18rem,0.9fr)]">
                <BestSellingProducts orders={data.orders} />
                <PerformancePanel stats={stats} profile={profile} />
              </section>

              <QuickActions />
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border border-dashed border-outline bg-bg p-4"><div><p className="font-semibold text-ink-900">রিপোর্ট দরকার?</p><p className="mt-1 text-sm text-ink-600">বর্তমান বিক্রয় তথ্যের প্রতিবেদন তৈরি করুন।</p></div><button type="button" onClick={() => { downloadCsv(stats); setNotice('বিক্রয় প্রতিবেদন ডাউনলোড হয়েছে।') }} className="inline-flex items-center gap-2 border border-outline bg-surface px-3 py-2.5 text-base font-medium text-ink-700 transition hover:border-brand-500 hover:text-brand-700"><Download size={16} />রিপোর্ট ডাউনলোড</button></div>
            </>
          )}
        </main>
      </div>
    </Layout>
  )
}

function SellerSidebar({ unreadCount }: { unreadCount: number }) {
  return <aside className="lg:sticky lg:top-24 lg:self-start"><div className="overflow-hidden border border-outline bg-surface shadow-sm"><div className="border-b border-outline bg-brand-50 p-4"><p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-700">BikriKoro</p><p className="mt-1 text-lg font-bold text-ink-900">বিক্রেতা কেন্দ্র</p></div><nav className="grid grid-cols-2 gap-1 p-2 sm:flex sm:overflow-x-auto lg:block">{sellerNav.map(({ to, label, icon: Icon }) => <Link key={to} to={to} className={`relative flex min-w-0 items-center gap-2 px-3 py-2.5 text-sm font-semibold transition ${to === '/seller/dashboard' ? 'bg-brand-500 text-white' : 'text-ink-600 hover:bg-brand-50 hover:text-brand-700'}`}><Icon size={17} />{label}{to === '/notifications' && unreadCount > 0 && <span className="ml-auto min-w-5 bg-white px-1.5 py-0.5 text-center text-[11px] font-bold text-brand-700">{unreadCount}</span>}</Link>)}</nav><div className="border-t border-outline p-3"><Link to="/seller-education" className="flex items-start gap-2 bg-bg p-3 text-sm text-ink-600 transition hover:bg-brand-50"><HelpCircle size={16} className="mt-0.5 shrink-0 text-brand-600" /><span><strong className="block text-ink-900">বিক্রেতা শিক্ষা</strong>ডেলিভারি ও অর্ডারের ধাপ শিখুন</span></Link><Link to="/settings" className="mt-2 flex items-center gap-2 px-3 py-2 text-sm text-ink-500 hover:text-brand-700"><Settings size={15} />সেটিংস ও সহায়তা</Link></div></div></aside>
}

function ProfileHero({ profile, productCount, onEdit }: { profile: Profile | null; productCount: number; onEdit: () => void }) {
  const name = profile?.shop_name?.trim() || profile?.name || 'Seller'
  return <section className="mt-5 border border-brand-100 bg-gradient-to-r from-brand-50 via-surface to-surface p-4 shadow-sm sm:p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-center"><div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden border border-brand-200 bg-brand-100 text-2xl font-bold text-brand-700">{profile?.photo_url ? <img src={profile.photo_url} alt="" className="h-full w-full object-cover" /> : name.charAt(0)}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-bold text-ink-900">{name}</h2>{profile?.is_verified && <span className="inline-flex items-center gap-1 bg-brand-500 px-2 py-1 text-xs font-bold text-white"><ShieldCheck size={13} />যাচাইকৃত</span>}</div><p className="mt-1 line-clamp-2 text-sm text-ink-600">{profile?.shop_description || 'আপনার ডিজিটাল শপের তথ্য সম্পূর্ণ করুন এবং ক্রেতার আস্থা তৈরি করুন।'}</p><div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-500"><span>{profile?.review_count ? `★ ${profile.rating.toFixed(1)} · ${profile.review_count}টি রিভিউ` : 'এখনো কোনো রিভিউ নেই'}</span><span>{productCount}টি সক্রিয় পণ্য</span>{profile?.created_at && <span>{formatDate(profile.created_at)} থেকে</span>}</div></div><button type="button" onClick={onEdit} className="inline-flex items-center justify-center gap-2 border border-brand-500 px-3 py-2.5 text-base font-semibold text-brand-700 transition hover:bg-brand-50"><UserRound size={16} />প্রোফাইল এডিট</button></div></section>
}

function MetricCard({ icon: Icon, label, value, tone, note }: { icon: LucideIcon; label: string; value: string; tone: 'green' | 'purple' | 'orange' | 'blue' | 'amber'; note: string }) {
  const colors = { green: 'bg-brand-50 text-brand-700', purple: 'bg-violet-50 text-violet-700', orange: 'bg-orange-50 text-orange-700', blue: 'bg-sky-50 text-sky-700', amber: 'bg-amber-50 text-amber-700' }[tone]
  return <article className="min-w-0 border border-outline bg-surface p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md"><div className="flex items-start justify-between gap-2"><p className="text-sm font-semibold text-ink-600">{label}</p><span className={`flex h-9 w-9 shrink-0 items-center justify-center ${colors}`}><Icon size={18} /></span></div><p className="tabular-amount mt-4 text-xl font-bold tracking-tight text-ink-900 sm:text-2xl">{value}</p><p className="mt-1 line-clamp-1 text-xs text-ink-400">{note}</p></article>
}

function SalesOverview({ orders }: { orders: SellerOrder[] }) {
  const points = buildDailySales(orders)
  const max = Math.max(...points.map((point) => point.amount), 1)
  const hasSales = points.some((point) => point.amount > 0)
  return <section className="border border-outline bg-surface p-4 shadow-sm sm:p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-700">বিক্রয় সংক্ষেপ</p><h2 className="mt-1 text-lg font-bold text-ink-900">গত ৭ দিনের সম্পন্ন বিক্রয়</h2></div><BarChart3 size={20} className="text-brand-600" /></div>{hasSales ? <div className="mt-6"><div className="flex h-44 items-end gap-2 border-b border-l border-outline px-2 pb-0 sm:gap-4">{points.map((point) => <div key={point.key} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-2"><span className="text-[10px] text-ink-400">{point.amount > 0 ? formatCompactTaka(point.amount) : ''}</span><div className="w-full max-w-10 bg-brand-500 transition hover:bg-brand-600" style={{ height: `${Math.max((point.amount / max) * 118, point.amount > 0 ? 10 : 3)}px` }} title={`${point.label}: ${formatTaka(point.amount)}`} /><span className="text-[10px] text-ink-400">{point.label}</span></div>)}</div><p className="mt-3 text-xs text-ink-400">শুধু live completed order-এর total দেখানো হয়েছে।</p></div> : <EmptyPanel icon={BarChart3} title="এখনো বিক্রয়ের ইতিহাস নেই" body="ডিজিটাল অর্ডার সম্পন্ন হলে এখানে বাস্তব বিক্রয়ের তথ্য দেখা যাবে।" />}</section>
}

function WalletSummary({ balance, withdrawalSummary }: { balance: WalletBalance | null; withdrawalSummary: WalletWithdrawalSummary | null }) {
  const available = Number(balance?.available_balance ?? 0)
  const reserved = Number(withdrawalSummary?.reserved_amount ?? 0)
  const withdrawable = Number(withdrawalSummary?.spendable_balance ?? Math.max(available - reserved, 0))
  return <section className="border border-brand-100 bg-brand-700 p-4 text-white shadow-sm sm:p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-100">ওয়ালেট সংক্ষেপ</p><h2 className="mt-1 text-lg font-bold">ওয়ালেট</h2></div><WalletCards size={22} className="text-brand-100" /></div><p className="tabular-amount mt-6 text-3xl font-bold">{formatTaka(available)}</p><p className="mt-1 text-sm text-brand-100">উপলব্ধ ব্যালেন্স</p><div className="mt-6 grid grid-cols-2 gap-3"><div className="border border-white/20 bg-white/10 p-3"><p className="text-xs text-brand-100">আটকে রাখা</p><p className="tabular-amount mt-1 text-lg font-bold">{formatTaka(reserved)}</p></div><div className="border border-white/20 bg-white/10 p-3"><p className="text-xs text-brand-100">উত্তোলনযোগ্য</p><p className="tabular-amount mt-1 text-lg font-bold">{formatTaka(withdrawable)}</p></div></div><Link to="/wallet" className="mt-5 inline-flex items-center gap-1 text-sm font-bold text-white hover:text-brand-100">লেনদেন ও অর্থ উত্তোলন দেখুন <ArrowUpRight size={15} /></Link></section>
}

function RecentOrders({ orders }: { orders: SellerOrder[] }) {
  const recent = orders.slice(0, 5)
  return <section className="border border-outline bg-surface p-4 shadow-sm sm:p-5"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-700">সাম্প্রতিক অর্ডার</p><h2 className="mt-1 text-lg font-bold text-ink-900">সাম্প্রতিক অর্ডার</h2></div><Link to="/orders" className="text-sm font-semibold text-brand-700 hover:text-brand-800">সব দেখুন <ChevronRight size={15} className="inline" /></Link></div>{recent.length === 0 ? <EmptyPanel icon={ShoppingCart} title="এখনো কোনো বিক্রয় অর্ডার নেই" body="ক্রেতা আপনার অনুমোদিত ডিজিটাল পণ্য কিনলে এখানে অর্ডার দেখা যাবে।" /> : <div className="mt-4 space-y-3">{recent.map((order) => <Link key={order.id} to={`/orders/${order.id}`} className="flex items-center gap-3 border border-outline p-3 transition hover:border-brand-300 hover:bg-brand-50/40"><div className="h-11 w-11 shrink-0 overflow-hidden bg-bg">{order.product_image && <img src={order.product_image} alt="" className="h-full w-full object-cover" />}</div><div className="min-w-0 flex-1"><p className="line-clamp-1 text-sm font-semibold text-ink-900">{order.product_title}</p><p className="mt-0.5 text-xs text-ink-400">{formatDateTime(order.created_at)}</p></div><div className="text-right"><p className="tabular-amount text-sm font-bold text-ink-900">{formatTaka(order.price)}</p><span className={`mt-1 inline-flex px-2 py-1 text-[11px] font-bold ${STATUS_CLASS[order.status]}`}>{STATUS_LABEL[order.status]}</span></div></Link>)}</div>}</section>
}

function NotificationPanel({ notifications }: { notifications: SellerNotification[] }) {
  return <section className="border border-outline bg-surface p-4 shadow-sm sm:p-5"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-700">নোটিফিকেশন</p><h2 className="mt-1 text-lg font-bold text-ink-900">আপডেট</h2></div><Link to="/notifications" className="text-sm font-semibold text-brand-700">সব দেখুন</Link></div>{notifications.length === 0 ? <EmptyPanel icon={Bell} title="নতুন নোটিফিকেশন নেই" body="অর্ডার, পেমেন্ট, মেসেজ ও ওয়ালেটের আপডেট এখানে আসবে।" /> : <div className="mt-4 space-y-2">{notifications.slice(0, 4).map((item) => <Link key={item.id} to={item.link || '/notifications'} className={`block border-l-2 p-3 transition hover:bg-brand-50 ${item.is_read ? 'border-outline bg-bg' : 'border-brand-500 bg-brand-50/60'}`}><div className="flex items-start gap-2"><Bell size={15} className="mt-0.5 shrink-0 text-brand-600" /><div className="min-w-0"><p className="line-clamp-1 text-sm font-semibold text-ink-900">{item.title}</p><p className="mt-1 line-clamp-2 text-xs leading-5 text-ink-600">{item.body}</p><p className="mt-1 text-[11px] text-ink-400">{formatDateTime(item.created_at)}</p></div></div></Link>)}</div>}</section>
}

function BestSellingProducts({ orders }: { orders: SellerOrder[] }) {
  const products = useMemo(() => {
    const map = new Map<string, { title: string; image: string | null; count: number; amount: number }>()
    orders.filter((order) => order.status === 'COMPLETED').forEach((order) => { const current = map.get(order.product_id) ?? { title: order.product_title, image: order.product_image, count: 0, amount: 0 }; current.count += 1; current.amount += Number(order.price); map.set(order.product_id, current) })
    return [...map.values()].sort((a, b) => b.count - a.count || b.amount - a.amount).slice(0, 4)
  }, [orders])
  return <section className="border border-outline bg-surface p-4 shadow-sm sm:p-5"><div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-700">পণ্যের কার্যক্ষমতা</p><h2 className="mt-1 text-lg font-bold text-ink-900">সেরা বিক্রিত পণ্য</h2></div><TrendingUp size={20} className="text-brand-600" /></div>{products.length === 0 ? <EmptyPanel icon={TrendingUp} title="এখনো সম্পন্ন বিক্রয় নেই" body="বাস্তব বিক্রয় হলে পণ্যের কার্যক্ষমতার তথ্য এখানে দেখা যাবে।" /> : <div className="mt-4 space-y-3">{products.map((product, index) => <div key={product.title} className="flex items-center gap-3 border-b border-outline pb-3 last:border-0 last:pb-0"><span className="flex h-7 w-7 items-center justify-center bg-brand-50 text-sm font-bold text-brand-700">{index + 1}</span><div className="h-10 w-10 shrink-0 overflow-hidden bg-bg">{product.image && <img src={product.image} alt="" className="h-full w-full object-cover" />}</div><div className="min-w-0 flex-1"><p className="line-clamp-1 text-sm font-semibold text-ink-900">{product.title}</p><p className="mt-1 text-xs text-ink-500">{product.count}টি সম্পন্ন বিক্রয়</p></div><p className="tabular-amount text-sm font-bold text-brand-700">{formatTaka(product.amount)}</p></div>)}</div>}</section>
}

function PerformancePanel({ stats, profile }: { stats: ReturnType<typeof buildStats>; profile: Profile | null }) {
  const metrics = [{ label: 'বিক্রেতার রেটিং', value: profile?.review_count ? `${profile.rating.toFixed(1)} / 5` : 'ডেটা নেই', icon: Star }, { label: 'দেখা থেকে বিক্রয়', value: stats.totalViews > 0 ? `${stats.conversionRate.toFixed(2)}%` : 'ডেটা নেই', icon: Activity }, { label: 'সক্রিয় পণ্য', value: String(stats.activeProducts), icon: Package }, { label: 'অনুমোদনের সারি', value: String(stats.pendingProducts), icon: Clock3 }]
  return <section className="border border-outline bg-surface p-4 shadow-sm sm:p-5"><div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-700">বিক্রেতার কার্যক্ষমতা</p><h2 className="mt-1 text-lg font-bold text-ink-900">আপনার বর্তমান অবস্থান</h2></div><Zap size={20} className="text-brand-600" /></div><div className="mt-4 grid grid-cols-2 gap-3">{metrics.map(({ label, value, icon: Icon }) => <div key={label} className="border border-outline bg-bg p-3"><Icon size={17} className="text-brand-600" /><p className="mt-3 text-xs text-ink-500">{label}</p><p className="mt-1 text-base font-bold text-ink-900">{value}</p></div>)}</div></section>
}

function QuickActions() {
  const actions = [{ to: '/sell', label: 'নতুন ডিজিটাল পণ্য', icon: Plus }, { to: '/account', label: 'শপের তথ্য', icon: UserRound }, { to: '/seller-education', label: 'বিক্রেতার গাইড', icon: HelpCircle }]
  return <section className="mt-5"><div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-700">দ্রুত কাজ</p><h2 className="mt-1 text-lg font-bold text-ink-900">দ্রুত কাজ</h2></div></div><div className="mt-3 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-3">{actions.map(({ to, label, icon: Icon }) => <Link key={to} to={to} className="group min-w-0 border border-outline bg-surface p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-300 hover:bg-brand-50"><Icon size={20} className="text-brand-600" /><p className="mt-3 text-sm font-semibold text-ink-800 group-hover:text-brand-800">{label}</p><ChevronRight size={15} className="mt-2 text-ink-300 transition group-hover:translate-x-1 group-hover:text-brand-600" /></Link>)}</div></section>
}

function EmptyPanel({ icon: Icon, title, body }: { icon: LucideIcon; title: string; body: string }) {
  return <div className="mt-5 border border-dashed border-outline bg-bg p-6 text-center"><Icon size={25} className="mx-auto text-brand-500" /><p className="mt-3 text-sm font-semibold text-ink-800">{title}</p><p className="mt-1 text-xs leading-5 text-ink-500">{body}</p></div>
}

function DashboardSkeleton() {
  return <div className="mt-5 space-y-4" aria-label="ড্যাশবোর্ড লোড হচ্ছে"><div className="h-32 animate-pulse bg-outline/40" /><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{Array.from({ length: 8 }).map((_, index) => <div key={index} className="h-28 animate-pulse bg-outline/40" />)}</div><div className="grid gap-4 xl:grid-cols-2"><div className="h-64 animate-pulse bg-outline/40" /><div className="h-64 animate-pulse bg-outline/40" /></div></div>
}

function buildStats(products: Product[], orders: SellerOrder[]) {
  const now = new Date()
  const todayKey = dateKey(now)
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const completed = orders.filter((order) => order.status === 'COMPLETED')
  const totalViews = products.reduce((sum, product) => sum + Number(product.view_count ?? 0), 0)
  return { activeProducts: products.filter((product) => !product.is_hidden && product.approval_status === 'APPROVED').length, pendingProducts: products.filter((product) => !product.is_hidden && product.approval_status === 'PENDING').length, totalViews, completedOrders: completed.length, totalSales: sumPrices(completed), todaySales: sumPrices(completed.filter((order) => dateKey(new Date(order.created_at)) === todayKey)), monthSales: sumPrices(completed.filter((order) => dateKey(new Date(order.created_at)).startsWith(monthKey))), pendingOrders: orders.filter((order) => !['COMPLETED', 'CANCELLED', 'REFUNDED'].includes(order.status)).length, cancelledOrders: orders.filter((order) => ['CANCELLED', 'REFUNDED'].includes(order.status)).length, conversionRate: totalViews > 0 ? (completed.length / totalViews) * 100 : 0 }
}

function sumPrices(orders: SellerOrder[]) { return orders.reduce((sum, order) => sum + Number(order.price ?? 0), 0) }

function buildDailySales(orders: SellerOrder[]) {
  const now = new Date()
  return Array.from({ length: 7 }, (_, index) => { const day = new Date(now); day.setHours(0, 0, 0, 0); day.setDate(now.getDate() - (6 - index)); const key = dateKey(day); return { key, label: day.toLocaleDateString('bn-BD', { day: 'numeric', month: 'short' }), amount: sumPrices(orders.filter((order) => order.status === 'COMPLETED' && dateKey(new Date(order.created_at)) === key)) } })
}

function dateKey(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` }
function formatCompactTaka(amount: number) { return amount >= 1000 ? `৳${(amount / 1000).toFixed(amount >= 10000 ? 0 : 1)}k` : `৳${Math.round(amount)}` }
function downloadCsv(stats: ReturnType<typeof buildStats>) { const rows = [['মেট্রিক', 'মান'], ['আজকের বিক্রি', stats.todaySales], ['এই মাসের বিক্রি', stats.monthSales], ['মোট বিক্রি', stats.totalSales], ['সম্পন্ন অর্ডার', stats.completedOrders], ['অপেক্ষমাণ অর্ডার', stats.pendingOrders], ['বাতিল/অর্থ ফেরত অর্ডার', stats.cancelledOrders], ['সক্রিয় পণ্য', stats.activeProducts], ['তালিকা দেখার সংখ্যা', stats.totalViews], ['দেখা থেকে বিক্রয় (%)', stats.conversionRate.toFixed(2)]]; const csv = rows.map((row) => row.join(',')).join('\n'); const url = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' })); const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'bikrikoro-seller-dashboard.csv'; anchor.click(); URL.revokeObjectURL(url) }

async function loadSellerProfile(uid: string) { const profile = await supabase.from('profiles').select('id, name, phone, email, photo_url, shop_name, shop_description, shop_username, shop_cover_url, is_verified, rating, review_count, created_at').eq('id', uid).maybeSingle(); if (!profile.error || !isMissingShopProfileColumns(profile.error)) return profile; const legacyProfile = await supabase.from('profiles').select('id, name, phone, email, photo_url, is_verified, rating, review_count, created_at').eq('id', uid).maybeSingle(); if (legacyProfile.error) throw legacyProfile.error; return { data: legacyProfile.data ? { ...legacyProfile.data, shop_name: null, shop_description: null, shop_username: null, shop_cover_url: null } : null, error: null } }
function isMissingShopProfileColumns(error: unknown) { const text = getErrorMessage(error).toLowerCase(); return (text.includes('shop_name') || text.includes('shop_description') || text.includes('shop_username') || text.includes('shop_cover_url')) && (text.includes('column') || text.includes('schema cache') || text.includes('does not exist')) }
function getErrorMessage(error: unknown) { if (error instanceof Error && error.message) return error.message; if (error && typeof error === 'object') { const value = error as { message?: unknown; details?: unknown; hint?: unknown }; const parts = [value.message, value.details, value.hint].filter((part): part is string => typeof part === 'string' && part.trim().length > 0); if (parts.length > 0) return parts.join(' ') } return 'সেলার ড্যাশবোর্ড লোড করা যায়নি।' }
