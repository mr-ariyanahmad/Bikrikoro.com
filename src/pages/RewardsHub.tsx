import { useCallback, useEffect, useState } from 'react'
import { BadgeCheck, Check, ChevronRight, Coins, Crown, Gift, ShieldCheck, ShoppingBag, Sparkles, Truck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { Layout } from '@/components/Layout'
import { useAuth } from '@/context/AuthContext'
import { supabase, supabaseConfigured } from '@/lib/supabase'

export default function RewardsHub() {
  const { user } = useAuth()
  const [coins, setCoins] = useState(0)
  const [streak, setStreak] = useState(0)
  const [checkedIn, setCheckedIn] = useState(false)
  const [loading, setLoading] = useState(true)
  const [claiming, setClaiming] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const loadRewards = useCallback(async () => {
    if (!user || !supabaseConfigured) {
      setLoading(false)
      return
    }
    const { data, error } = await supabase.from('reward_balances').select('coins, checkin_streak, last_checkin_date').eq('user_id', user.uid).maybeSingle()
    if (error) setMessage('Reward data এখন লোড করা যাচ্ছে না। কিছুক্ষণ পরে আবার চেষ্টা করুন।')
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka' }).format(new Date())
    setCoins(Number(data?.coins ?? 0))
    setStreak(Number(data?.checkin_streak ?? 0))
    setCheckedIn(data?.last_checkin_date === today)
    setLoading(false)
  }, [user])

  useEffect(() => {
    void loadRewards()
  }, [loadRewards])

  const claimDailyCheckin = async () => {
    if (!user) return
    setClaiming(true)
    setMessage(null)
    const { data, error } = await supabase.rpc('claim_daily_checkin', { p_user_id: user.uid })
    const result = Array.isArray(data) ? data[0] : data
    if (error || !result) {
      setMessage('Daily check-in চালু করা যাচ্ছে না। Supabase migration 020 ও 022 প্রয়োগ করা আছে কি না দেখুন।')
      setClaiming(false)
      return
    }
    setCoins(Number(result.total_coins ?? coins))
    setStreak(Number(result.streak ?? streak))
    setCheckedIn(true)
    setMessage(result.claimed ? `আজকের ${Number(result.awarded_coins ?? 10)} কয়েন যোগ হয়েছে।` : 'আজকের check-in ইতিমধ্যে নেওয়া হয়েছে।')
    setClaiming(false)
  }

  return <Layout wide>
    <Helmet><title>Rewards ও সুবিধা | BikriKoro.Com</title><meta name="description" content="BikriKoro daily check-in, reward coins, VIP status এবং delivery সুবিধা দেখুন।" /></Helmet>
    <div className="mx-auto max-w-5xl">
      <section className="rounded-3xl bg-gradient-to-br from-brand-600 via-brand-500 to-brand-700 p-6 text-white shadow-lg sm:p-8">
        <div className="flex items-start justify-between gap-5"><div><p className="text-sm font-semibold text-brand-50/80">BikriKoro Rewards</p><h1 className="mt-2 text-3xl font-bold sm:text-4xl">কেনাকাটায় আরও সুবিধা পান</h1><p className="mt-3 max-w-2xl text-sm leading-7 text-brand-50/85">দৈনিক check-in থেকে কয়েন নিন, আপনার reward status দেখুন এবং নির্বাচিত পণ্যে delivery সুবিধা ব্যবহার করুন।</p></div><span className="hidden h-14 w-14 items-center justify-center rounded-2xl bg-white/15 sm:flex"><Gift size={28} /></span></div>
      </section>

      {message && <div className="mt-4 flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-800"><Sparkles size={17} className="mt-0.5 shrink-0" />{message}</div>}

      <section className="mt-5 grid gap-4 sm:grid-cols-2">
        <div id="checkin" className="rounded-2xl border border-outline bg-surface p-5 shadow-sm"><div className="flex items-center justify-between"><div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-600"><Coins size={22} /></span><div><h2 className="font-bold text-ink-900">দৈনিক check-in</h2><p className="mt-0.5 text-xs text-ink-500">প্রতিদিন একবার কয়েন নিন</p></div></div><span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-bold text-brand-700">+১০ কয়েন</span></div><div className="mt-5 grid grid-cols-2 gap-3"><div className="rounded-xl bg-bg p-3"><p className="text-xs text-ink-500">মোট কয়েন</p><p className="mt-1 text-2xl font-bold text-ink-900">{loading ? '—' : coins.toLocaleString('bn-BD')}</p></div><div className="rounded-xl bg-bg p-3"><p className="text-xs text-ink-500">Streak</p><p className="mt-1 text-2xl font-bold text-ink-900">{loading ? '—' : `${streak} দিন`}</p></div></div><button type="button" onClick={claimDailyCheckin} disabled={claiming || checkedIn || loading} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50">{checkedIn ? <><Check size={17} />আজকের check-in সম্পন্ন</> : claiming ? 'চেক-ইন হচ্ছে...' : 'আজকের কয়েন নিন'}</button></div>

        <div id="vip" className="rounded-2xl border border-outline bg-surface p-5 shadow-sm"><div className="flex items-center justify-between"><div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-600"><Crown size={22} /></span><div><h2 className="font-bold text-ink-900">VIP status</h2><p className="mt-0.5 text-xs text-ink-500">আপনার membership level</p></div></div><BadgeCheck size={21} className="text-brand-500" /></div><div className="mt-5 rounded-2xl bg-brand-50 p-4"><p className="text-xs font-semibold text-brand-700">বর্তমান status</p><p className="mt-1 text-2xl font-bold text-ink-900">সাধারণ সদস্য</p><p className="mt-2 text-xs leading-5 text-ink-600">আরও কেনাকাটা ও reward activity-এর ভিত্তিতে ভবিষ্যতে VIP সুবিধা পাওয়া যাবে।</p></div><Link to="/products?sort=popular" className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-brand-200 px-4 py-3 text-sm font-bold text-brand-700 transition hover:border-brand-500 hover:bg-brand-50">জনপ্রিয় পণ্য দেখুন <ChevronRight size={17} /></Link></div>
      </section>

      <section className="mt-5 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-brand-100 bg-brand-50 p-5"><div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-brand-600"><Truck size={22} /></span><div><h2 className="font-bold text-brand-800">ফ্রি ডেলিভারি সুবিধা</h2><p className="mt-0.5 text-xs text-brand-700/75">নির্বাচিত physical পণ্যে প্রযোজ্য</p></div></div><p className="mt-4 text-sm leading-6 text-brand-800/80">যেসব product card-এ free delivery badge আছে, সেগুলো বেছে নিন। Checkout-এর আগে delivery eligibility দেখে নিতে পারবেন।</p><Link to="/products?delivery=free" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-brand-600">ফ্রি ডেলিভারি পণ্য দেখুন <ShoppingBag size={17} /></Link></div>
        <div className="rounded-2xl border border-outline bg-surface p-5 shadow-sm"><div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><ShieldCheck size={22} /></span><div><h2 className="font-bold text-ink-900">Reward ব্যবহারের নিয়ম</h2><p className="mt-0.5 text-xs text-ink-500">সহজ ও স্বচ্ছ সুবিধা</p></div></div><div className="mt-4 space-y-3 text-sm text-ink-600"><p className="flex items-start gap-2"><Check size={16} className="mt-0.5 shrink-0 text-brand-500" />Reward coin BDT wallet balance নয় এবং cash-out করা যায় না।</p><p className="flex items-start gap-2"><Check size={16} className="mt-0.5 shrink-0 text-brand-500" />একজন user প্রতিদিন একবার check-in করতে পারবেন।</p><p className="flex items-start gap-2"><Check size={16} className="mt-0.5 shrink-0 text-brand-500" />Free delivery শুধু eligible product ও campaign-এর ক্ষেত্রে প্রযোজ্য।</p></div></div>
      </section>
    </div>
  </Layout>
}
