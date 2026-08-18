import { useEffect, useState } from 'react'
import { Check, Coins, Crown, Loader2, Truck, WalletCards } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { supabase, supabaseConfigured } from '@/lib/supabase'
import { Layout } from '@/components/Layout'
import { ProductCard } from '@/components/ProductCard'
import { CategoryPills } from '@/components/CategoryPills'
import { RecommendedProducts } from '@/components/RecommendedProducts'
import { getRecentlyViewedIds } from '@/lib/recentlyViewed'
import { useAuth } from '@/context/AuthContext'
import { formatTaka } from '@/lib/format'
import type { Product, Category, PromoBanner } from '@/types/product'

export default function Home() {
  const { user } = useAuth()
  const [banners, setBanners] = useState<PromoBanner[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [balance, setBalance] = useState(0)
  const [rewardCoins, setRewardCoins] = useState(0)
  const [checkinStreak, setCheckinStreak] = useState(0)
  const [checkedIn, setCheckedIn] = useState(false)
  const [checkInMessage, setCheckInMessage] = useState<string | null>(null)
  const [checkInLoading, setCheckInLoading] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    let active = true
    async function load() {
      if (!supabaseConfigured) {
        setCheckInMessage('লাইভ পণ্য data দেখতে Supabase configuration প্রয়োজন।')
        setLoading(false)
        return
      }
      try {
        const [bannersRes, categoriesRes, productsRes] = await Promise.all([
          supabase.from('promo_banners').select('*').order('sort_order'),
          supabase.from('categories').select('*').order('sort_order'),
          supabase.from('products').select('*').order('created_at', { ascending: false }).limit(12),
        ])
        if (!active) return
        if (bannersRes.error || categoriesRes.error || productsRes.error) {
          throw bannersRes.error ?? categoriesRes.error ?? productsRes.error
        }
        setBanners(bannersRes.data ?? [])
        setCategories(categoriesRes.data ?? [])
        setProducts(productsRes.data ?? [])
      } catch (loadError) {
        console.error('Homepage data load failed:', loadError)
        if (active) setCheckInMessage('লাইভ পণ্য data এখন পাওয়া যাচ্ছে না। পরে আবার চেষ্টা করুন।')
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!user) { setBalance(0); setRewardCoins(0); setCheckinStreak(0); setCheckedIn(false); return }
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka' }).format(new Date())
    Promise.all([
      supabase.from('wallet_balances').select('available_balance').eq('user_id', user.uid).maybeSingle(),
      supabase.from('reward_balances').select('coins, checkin_streak, last_checkin_date').eq('user_id', user.uid).maybeSingle(),
    ]).then(([wallet, rewards]) => {
      if (wallet.error || rewards.error) setCheckInMessage('Wallet বা reward data এখন লোড করা যাচ্ছে না। কিছুক্ষণ পরে আবার চেষ্টা করুন।')
      setBalance(Number(wallet.data?.available_balance ?? 0))
      setRewardCoins(Number(rewards.data?.coins ?? 0))
      setCheckinStreak(Number(rewards.data?.checkin_streak ?? 0))
      setCheckedIn(rewards.data?.last_checkin_date === today)
    })
  }, [user])

  const checkIn = async () => {
    if (!user) { navigate('/login'); return }
    if (!supabaseConfigured) { setCheckInMessage('Daily check-in চালু করতে Supabase configuration প্রয়োজন।'); return }
    if (checkedIn || checkInLoading) return
    setCheckInLoading(true)
    setCheckInMessage(null)
    try {
      const { data, error } = await supabase.rpc('claim_daily_checkin', { p_user_id: user.uid })
      const result = Array.isArray(data) ? data[0] : data
      if (error || !result) {
        setCheckInMessage('Daily check-in চালু করা যাচ্ছে না। Supabase migration 020 ও 022 প্রয়োগ করা আছে কি না দেখুন।')
        return
      }
      setRewardCoins(Number(result.total_coins ?? rewardCoins))
      setCheckinStreak(Number(result.streak ?? checkinStreak))
      setCheckedIn(true)
      setCheckInMessage(result.claimed ? `+${Number(result.awarded_coins ?? 10)} কয়েন যোগ হয়েছে।` : 'আজকের check-in আগেই নেওয়া হয়েছে।')
    } catch (error) {
      console.error('Daily check-in failed:', error)
      setCheckInMessage('Check-in সম্পন্ন করা যায়নি। আবার চেষ্টা করুন।')
    } finally {
      setCheckInLoading(false)
    }
  }

  return <Layout wide>
    <Helmet><title>BikriKoro.Com — বাংলাদেশের নিরাপদ অনলাইন কেনাবেচার প্ল্যাটফর্ম</title><meta name="description" content="এসক্রো-সুরক্ষিত মার্কেটপ্লেস — নিরাপদে কিনুন, নিশ্চিন্তে বিক্রি করুন। নতুন-পুরাতন পণ্য বাংলাদেশজুড়ে।" /></Helmet>
    {banners.length > 0 && <div className="scrollbar-none -mx-5 mb-6 flex gap-3 overflow-x-auto px-5 pb-1">{banners.map((banner) => <Link key={banner.id} to={banner.target_category_id ? `/products?category=${banner.target_category_id}` : '/products'} className="h-36 w-64 shrink-0 overflow-hidden rounded-2xl bg-outline/30 sm:h-44 sm:w-96"><img src={banner.image_url} alt="" className="h-full w-full object-cover" /></Link>)}</div>}

    {checkInMessage && <p className="mb-4 rounded-xl bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">{checkInMessage}</p>}
    <section className="mb-5 grid gap-3 sm:grid-cols-4">
      <Link to="/wallet" className="rounded-2xl border border-outline bg-surface p-4 transition hover:border-brand-500"><div className="flex items-center justify-between"><span className="text-sm text-ink-500">আমার ব্যালেন্স</span><WalletCards size={19} className="text-brand-600" /></div><p className="mt-2 tabular-amount text-xl font-bold text-ink-900">{user ? formatTaka(balance) : 'লগইন করুন'}</p><p className="mt-1 text-xs text-ink-400">ওয়ালেট ও payout দেখুন</p></Link>
      <button type="button" onClick={() => void checkIn()} disabled={checkInLoading || checkedIn} aria-busy={checkInLoading} className="rounded-2xl border border-outline bg-surface p-4 text-left transition hover:border-brand-500 disabled:cursor-wait disabled:opacity-70"><div className="flex items-center justify-between"><span className="text-sm text-ink-500">দৈনিক check-in</span>{checkInLoading ? <Loader2 size={19} className="animate-spin text-brand-600" /> : <Coins size={19} className="text-amber-500" />}</div><p className="mt-2 text-lg font-bold text-ink-900">{checkInLoading ? 'চেক-ইন হচ্ছে...' : checkedIn ? `আজকের কয়েন পেয়েছেন · ${rewardCoins}`.replace('$', '') : '+১০ কয়েন নিন'}</p><p className="mt-1 flex items-center gap-1 text-xs text-ink-400">{checkedIn && <Check size={13} className="text-brand-600" />} মোট {rewardCoins} কয়েন · {checkinStreak} দিনের streak</p></button>
      <Link to="/rewards#vip" className="rounded-2xl border border-outline bg-surface p-4 transition hover:border-brand-500"><div className="flex items-center justify-between"><span className="text-sm text-ink-500">VIP status</span><Crown size={19} className="text-amber-500" /></div><p className="mt-2 text-lg font-bold text-ink-900">সাধারণ সদস্য</p><p className="mt-1 text-xs text-ink-400">VIP status ও সুবিধা দেখুন →</p></Link>
      <Link to="/products?delivery=free" className="rounded-2xl border border-brand-100 bg-brand-50 p-4 transition hover:border-brand-500"><div className="flex items-center justify-between"><span className="text-sm text-brand-700">ডেলিভারি সুবিধা</span><Truck size={19} className="text-brand-600" /></div><p className="mt-2 text-lg font-bold text-brand-800">ফ্রি ডেলিভারি</p><p className="mt-1 text-xs text-brand-700/70">নির্বাচিত পণ্য দেখুন →</p></Link>
    </section>

    <section className="mb-6 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 p-6 text-white sm:p-8"><p className="text-sm font-medium text-brand-50/80">নিরাপদ কেনাবেচার প্ল্যাটফর্ম</p><h1 className="mt-1 text-2xl font-semibold sm:text-3xl">বিশ্বাস করে কিনুন, নিশ্চিন্তে বিক্রি করুন</h1><p className="mt-2 max-w-md text-sm text-brand-50/90">এসক্রো সুরক্ষায় প্রতিটা লেনদেন — টাকা বিক্রেতার কাছে যায় শুধু আপনি পণ্য হাতে পাওয়ার পর।</p><Link to="/sell" className="mt-4 inline-block rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-brand-700 transition hover:bg-brand-50">পণ্য বিক্রি করুন</Link></section>
    <CategoryPills categories={categories} selectedId={null} onSelect={(id) => navigate(id ? `/products?category=${id}` : '/products')} />
    <div className="mt-6 flex items-center justify-between"><h2 className="text-base font-semibold text-ink-900">সাম্প্রতিক পণ্য</h2><Link to="/products" className="text-sm font-medium text-brand-600 hover:text-brand-700">সব দেখুন →</Link></div>
    <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">{loading ? Array.from({ length: 8 }).map((_, i) => <div key={i} className="aspect-[3/4] animate-pulse rounded-xl bg-outline/40" />) : products.map((product) => <ProductCard key={product.id} product={product} />)}</div>
    {!loading && products.length === 0 && <p className="mt-8 text-center text-ink-600">এখনো কোনো পণ্য যোগ হয়নি।</p>}
    <RecommendedProducts title="জনপ্রিয় পণ্য" mode={{ type: 'popular' }} />
    {getRecentlyViewedIds().length > 0 && <RecommendedProducts title="আপনি যা দেখেছেন" mode={{ type: 'ids', productIds: getRecentlyViewedIds() }} />}
  </Layout>
}
