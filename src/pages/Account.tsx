import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, BadgeCheck, BookOpen, BookmarkPlus, Heart, Mail, PencilLine, ShoppingBag, Store, UserRound, WalletCards } from 'lucide-react'
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
  return domain ? `${name.slice(0, 2)}${'•'.repeat(Math.max(3, name.length - 2))}@${domain}` : value
}

function CompletionRing({ percent }: { percent: number }) {
  const accent = percent === 100 ? '#017C50' : '#D97706'
  return <div className="grid h-14 w-14 place-items-center rounded-full p-1 shadow-sm" style={{ background: `conic-gradient(${accent} ${percent}%, rgba(255,255,255,.46) 0)` }} role="img" aria-label={`প্রোফাইল ${percent}% সম্পূর্ণ`} title={`প্রোফাইল ${percent}% সম্পূর্ণ`}><span className="grid h-full w-full place-items-center rounded-full bg-surface text-sm font-extrabold" style={{ color: accent }}>{percent}<small className="-ml-0.5 text-[9px]">%</small></span></div>
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
    if (cached) { setProfile(cached.value); setLoading(false) } else setLoading(true)
    supabase.from('profiles').select('*').eq('id', uid).maybeSingle().then(({ data }) => { setProfile(data); if (data) writeCachedValue(cacheKey, data as Profile); setLoading(false) }, () => setLoading(false))
  }, [cacheKey, uid])

  const completionPercent = useMemo(() => {
    const items = [Boolean(profile?.photo_url), Boolean(profile?.name?.trim() && profile.name.trim().length >= 2), Boolean(user?.email), Boolean(user?.emailVerified), ...(isSeller ? [Boolean(profile?.shop_name?.trim()), Boolean(profile?.shop_description?.trim())] : [])]
    return Math.round((items.filter(Boolean).length / items.length) * 100)
  }, [isSeller, profile?.name, profile?.photo_url, profile?.shop_description, profile?.shop_name, user?.email, user?.emailVerified])

  if (loading) return <Layout wide><div className="h-72 animate-pulse rounded-2xl bg-outline/40" /></Layout>
  const displayName = profile?.name?.trim() || user?.displayName?.trim() || 'BikriKoro সদস্য'
  const shortcuts = [["/orders", "অর্ডার", ShoppingBag], ["/favorites", "পছন্দের তালিকা", Heart], ["/saved-searches", "সেভড সার্চ", BookmarkPlus], ["/wallet", "ওয়ালেট", WalletCards], ["/library", "লাইব্রেরি", BookOpen]]

  return <Layout wide><Helmet><title>আমার প্রোফাইল | BikriKoro.Com</title></Helmet><div className="mx-auto w-full max-w-5xl pb-24">
    <section className="overflow-hidden rounded-2xl border border-brand-200 bg-surface shadow-sm"><div className="relative h-28 bg-gradient-to-r from-brand-700 via-brand-500 to-emerald-300 sm:h-36"><div className="absolute inset-0 opacity-25" style={{ backgroundImage: 'radial-gradient(circle at 16% 22%, white 0, transparent 24%), radial-gradient(circle at 84% 74%, white 0, transparent 28%)' }} /><p className="absolute left-5 top-5 text-xs font-bold uppercase tracking-[0.18em] text-white/80">BikriKoro সদস্য প্রোফাইল</p><div className="absolute right-5 top-4"><CompletionRing percent={completionPercent} /></div></div><div className="relative px-5 pb-5 sm:px-7"><div className="-mt-12 flex flex-col gap-4 sm:-mt-14 sm:flex-row sm:items-end"><div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-brand-100 text-3xl font-bold text-brand-700 shadow-md sm:h-28 sm:w-28">{profile?.photo_url ? <img src={profile.photo_url} alt="" className="h-full w-full object-cover" /> : displayName.charAt(0)}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h1 className="truncate text-2xl font-bold tracking-tight text-ink-900">{displayName}</h1>{profile?.is_verified && <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-bold text-brand-700"><BadgeCheck size={14} />যাচাইকৃত</span>}</div><p className="mt-1 inline-flex max-w-full items-center gap-1 truncate text-sm text-ink-500"><Mail size={14} className="shrink-0" />{maskEmail(user?.email || profile?.email)}</p></div><Link to="/account/edit" className="inline-flex items-center justify-center gap-2 rounded-xl border border-brand-500 bg-brand-500 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-600"><PencilLine size={16} />প্রোফাইল সম্পাদনা</Link></div></div></section>
    <section className="mt-5 overflow-hidden rounded-2xl border border-outline bg-surface shadow-sm"><div className="bg-gradient-to-r from-brand-600 to-brand-500 px-5 py-3 text-white"><p className="text-xs font-medium text-white/80">দ্রুত অ্যাক্সেস</p><h2 className="mt-0.5 text-lg font-bold">আপনার BikriKoro</h2></div><div className="grid grid-cols-2 gap-px bg-outline sm:grid-cols-3 lg:grid-cols-6">{shortcuts.map(([to, label, Icon]) => <Link key={to as string} to={to as string} className="group bg-surface p-4 transition hover:bg-brand-50"><span className="flex items-center justify-between"><Icon size={19} className="text-brand-600" /><ArrowRight size={15} className="text-ink-300 transition group-hover:translate-x-0.5 group-hover:text-brand-600" /></span><span className="mt-3 block text-sm font-semibold text-ink-700">{label as string}</span></Link>)}{!sellerStatusLoading && isSeller && <Link to="/seller/dashboard" className="group bg-brand-50 p-4 transition hover:bg-brand-100"><span className="flex items-center justify-between"><Store size={19} className="text-brand-600" /><ArrowRight size={15} className="text-brand-400 transition group-hover:translate-x-0.5 group-hover:text-brand-600" /></span><span className="mt-3 block text-sm font-semibold text-brand-800">সেলার অ্যাকাউন্ট</span></Link>}</div></section>
    <section className="mt-5 rounded-2xl border border-outline bg-surface p-5 shadow-sm"><div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><UserRound size={20} /></span><div><h2 className="font-bold text-ink-900">আপনার তথ্য নিরাপদে রাখুন</h2><p className="mt-1 text-sm leading-6 text-ink-600">আপনার ইমেইল, ফোন নম্বর ও লগইন তথ্য অন্য ক্রেতা বা বিক্রেতার কাছে প্রকাশ করা হয় না। নিরাপত্তা ও ইমেইল যাচাইয়ের সেটিংস প্রোফাইল সম্পাদনা থেকে নিয়ন্ত্রণ করুন।</p></div></div></section>
  </div></Layout>
}
