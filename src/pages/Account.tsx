import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, BadgeCheck, BookOpen, BookmarkPlus, CheckCircle2, ChevronRight, CircleAlert, Heart, Mail, PencilLine, ShoppingBag, Store, UserRound, WalletCards } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { Layout } from '@/components/Layout'
import { useIsSeller } from '@/hooks/useIsSeller'
import { readCachedValue, userCacheKey, writeCachedValue } from '@/lib/clientCache'
import type { Profile } from '@/types/product'

const ACCOUNT_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000

function maskEmail(value: string | null | undefined) {
  if (!value) return 'যোগ করা হয়নি'
  const [name, domain] = value.split('@')
  if (!domain) return value
  return `${name.slice(0, 2)}${'•'.repeat(Math.max(3, name.length - 2))}@${domain}`
}

export default function Account() {
  const { user } = useAuth()
  const { isSeller, loading: sellerStatusLoading } = useIsSeller()
  const uid = user!.uid
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const cacheKey = userCacheKey(uid, 'account-profile')

  useEffect(() => {
    const cached = readCachedValue<Profile>(cacheKey, ACCOUNT_CACHE_MAX_AGE_MS)
    if (cached) {
      setProfile(cached.value)
      setLoading(false)
    } else {
      setLoading(true)
    }
    supabase.from('profiles').select('*').eq('id', uid).maybeSingle().then(({ data }) => {
      setProfile(data)
      if (data) writeCachedValue(cacheKey, data as Profile)
      setLoading(false)
    }, () => setLoading(false))
  }, [cacheKey, uid])

  const checklist = useMemo(() => {
    const items = [
      { label: 'প্রোফাইল ছবি', complete: Boolean(profile?.photo_url), help: 'একটি পরিষ্কার ছবি যোগ করুন' },
      { label: 'আপনার নাম', complete: Boolean(profile?.name?.trim() && profile.name.trim().length >= 2), help: 'আপনার সঠিক নাম লিখুন' },
      { label: 'ইমেইল', complete: Boolean(user?.email), help: 'একটি ইমেইল দিয়ে লগইন করুন' },
      { label: 'ইমেইল যাচাই', complete: Boolean(user?.emailVerified), help: 'ইমেইল ভেরিফাই করুন' },
      ...(isSeller ? [
        { label: 'শপের নাম', complete: Boolean(profile?.shop_name?.trim()), help: 'শপের নাম লিখুন' },
        { label: 'শপের পরিচিতি', complete: Boolean(profile?.shop_description?.trim()), help: 'শপ সম্পর্কে সংক্ষিপ্ত পরিচিতি দিন' },
      ] : []),
    ]
    return items
  }, [isSeller, profile?.name, profile?.photo_url, profile?.shop_description, profile?.shop_name, user?.email, user?.emailVerified])

  const completedCount = checklist.filter((item) => item.complete).length
  const completionPercent = checklist.length ? Math.round((completedCount / checklist.length) * 100) : 0
  const missingItems = checklist.filter((item) => !item.complete)
  const displayName = profile?.name?.trim() || user?.displayName?.trim() || 'BikriKoro সদস্য'

  if (loading) return <Layout wide><div className="h-72 animate-pulse rounded-2xl bg-outline/40" /></Layout>

  return (
    <Layout wide>
      <Helmet><title>আমার প্রোফাইল | BikriKoro.Com</title></Helmet>
      <div className="mx-auto w-full max-w-5xl pb-24">
        <section className="overflow-hidden rounded-2xl border border-brand-200 bg-surface shadow-sm">
          <div className="relative h-32 bg-gradient-to-r from-brand-700 via-brand-500 to-emerald-300 sm:h-40">
            <div className="absolute inset-0 opacity-25" style={{ backgroundImage: 'radial-gradient(circle at 16% 22%, white 0, transparent 24%), radial-gradient(circle at 84% 74%, white 0, transparent 28%)' }} />
            <p className="absolute left-5 top-5 text-xs font-bold uppercase tracking-[0.18em] text-white/80">BikriKoro সদস্য প্রোফাইল</p>
          </div>
          <div className="relative px-5 pb-5 sm:px-7">
            <div className="-mt-12 flex flex-col gap-4 sm:-mt-14 sm:flex-row sm:items-end">
              <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-brand-100 text-3xl font-bold text-brand-700 shadow-md sm:h-28 sm:w-28">
                {profile?.photo_url ? <img src={profile.photo_url} alt="" className="h-full w-full object-cover" /> : displayName.charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2"><h1 className="truncate text-2xl font-bold tracking-tight text-ink-900">{displayName}</h1>{profile?.is_verified && <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-bold text-brand-700"><BadgeCheck size={14} />যাচাইকৃত</span>}</div>
                <p className="mt-1 inline-flex max-w-full items-center gap-1 truncate text-sm text-ink-500"><Mail size={14} className="shrink-0" />{maskEmail(user?.email || profile?.email)}</p>
              </div>
              <Link to="/account/edit" className="inline-flex items-center justify-center gap-2 rounded-xl border border-brand-500 bg-brand-500 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-600"><PencilLine size={16} />প্রোফাইল সম্পাদনা</Link>
            </div>
          </div>
        </section>

        <section className={`mt-5 rounded-2xl border p-4 shadow-sm sm:p-5 ${completionPercent === 100 ? 'border-brand-200 bg-brand-50/60' : 'border-amber-200 bg-amber-50/70'}`}>
          <div className="flex flex-wrap items-start justify-between gap-3"><div className="flex min-w-0 gap-3"><span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${completionPercent === 100 ? 'bg-brand-100 text-brand-700' : 'bg-amber-100 text-amber-800'}`}>{completionPercent === 100 ? <CheckCircle2 size={21} /> : <CircleAlert size={21} />}</span><div><h2 className="font-bold text-ink-900">প্রোফাইল সম্পূর্ণতা</h2><p className="mt-0.5 text-sm text-ink-600">তথ্য সম্পূর্ণ রাখলে কেনা-বেচা ও বিশ্বাসযোগ্যতা আরও ভালো থাকে।</p></div></div><span className={`rounded-full px-3 py-1.5 text-sm font-bold ${completionPercent === 100 ? 'bg-brand-500 text-white' : 'bg-amber-400 text-amber-950'}`}>{completionPercent}% সম্পূর্ণ</span></div>
          <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/80"><div className={`h-full rounded-full transition-all duration-500 ${completionPercent === 100 ? 'bg-brand-500' : 'bg-amber-400'}`} style={{ width: `${completionPercent}%` }} /></div>
          {missingItems.length > 0 ? <div className="mt-4 flex flex-wrap gap-2">{missingItems.map((item) => <Link key={item.label} to="/account/edit" className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs font-semibold text-amber-900 hover:border-amber-400"><CircleAlert size={14} />{item.help}<ChevronRight size={14} /></Link>)}</div> : <p className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-brand-700"><CheckCircle2 size={16} />প্রয়োজনীয় সব প্রোফাইল তথ্য দেওয়া আছে।</p>}
        </section>

        <section className="mt-5 overflow-hidden rounded-2xl border border-outline bg-surface shadow-sm"><div className="bg-gradient-to-r from-brand-600 to-brand-500 px-5 py-3 text-white"><p className="text-xs font-medium text-white/80">দ্রুত অ্যাক্সেস</p><h2 className="mt-0.5 text-lg font-bold">আপনার BikriKoro</h2></div><div className="grid grid-cols-2 gap-px bg-outline sm:grid-cols-3 lg:grid-cols-6">{[["/orders", "অর্ডার", ShoppingBag], ["/favorites", "পছন্দের তালিকা", Heart], ["/saved-searches", "সেভড সার্চ", BookmarkPlus], ["/wallet", "ওয়ালেট", WalletCards], ["/library", "লাইব্রেরি", BookOpen]].map(([to, label, Icon]) => <Link key={to as string} to={to as string} className="group bg-surface p-4 transition hover:bg-brand-50"><span className="flex items-center justify-between"><Icon size={19} className="text-brand-600" /><ArrowRight size={15} className="text-ink-300 transition group-hover:translate-x-0.5 group-hover:text-brand-600" /></span><span className="mt-3 block text-sm font-semibold text-ink-700">{label as string}</span></Link>)}{!sellerStatusLoading && isSeller && <Link to="/seller/dashboard" className="group bg-brand-50 p-4 transition hover:bg-brand-100"><span className="flex items-center justify-between"><Store size={19} className="text-brand-600" /><ArrowRight size={15} className="text-brand-400 transition group-hover:translate-x-0.5 group-hover:text-brand-600" /></span><span className="mt-3 block text-sm font-semibold text-brand-800">সেলার অ্যাকাউন্ট</span></Link>}</div></section>

        <section className="mt-5 rounded-2xl border border-outline bg-surface p-5 shadow-sm"><div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><UserRound size={20} /></span><div><h2 className="font-bold text-ink-900">আপনার তথ্য নিরাপদে রাখুন</h2><p className="mt-1 text-sm leading-6 text-ink-600">আপনার ইমেইল, ফোন নম্বর ও লগইন তথ্য অন্য ক্রেতা বা বিক্রেতার কাছে প্রকাশ করা হয় না। নিরাপত্তা ও ইমেইল যাচাইয়ের সেটিংস প্রোফাইল সম্পাদনা থেকে নিয়ন্ত্রণ করুন।</p></div></div></section>
      </div>
    </Layout>
  )
}
