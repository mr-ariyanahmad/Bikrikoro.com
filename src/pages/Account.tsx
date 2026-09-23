import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, BadgeCheck, Check, Eye, Mail, PencilLine, ShieldCheck, ShoppingBag, Star, Store, UserRound, WalletCards, X } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { Layout } from '@/components/Layout'
import { BrandedDialog, DialogButton } from '@/components/BrandedDialog'
import { useIsSeller } from '@/hooks/useIsSeller'
import { readCachedValue, userCacheKey, writeCachedValue } from '@/lib/clientCache'
import type { Profile } from '@/types/product'

const ACCOUNT_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000

function maskEmail(value: string | null | undefined) {
  if (!value) return 'যোগ করা হয়নি'
  const [name, domain] = value.split('@')
  return domain ? `${name.slice(0, 2)}${'•'.repeat(Math.max(3, name.length - 2))}@${domain}` : value
}

export default function Account() {
  const { user, deleteAccount } = useAuth()
  const navigate = useNavigate()
  const { isSeller } = useIsSeller()
  const uid = user!.uid
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const cacheKey = userCacheKey(uid, 'account-profile')

  useEffect(() => {
    const cached = readCachedValue<Profile>(cacheKey, ACCOUNT_CACHE_MAX_AGE_MS)
    if (cached) { setProfile(cached.value); setLoading(false) } else setLoading(true)
    supabase.from('profiles').select('*').eq('id', uid).maybeSingle().then(({ data }) => { setProfile(data); if (data) writeCachedValue(cacheKey, data as Profile); setLoading(false) }, () => setLoading(false))
  }, [cacheKey, uid])

  const completionPercent = useMemo(() => {
    const items = [Boolean(profile?.photo_url), Boolean(profile?.name?.trim()), Boolean(profile?.username?.trim()), Boolean(profile?.phone?.trim()), Boolean(user?.emailVerified), Boolean(profile?.bio?.trim()), Boolean(profile?.preferred_category_id)]
    return Math.round((items.filter(Boolean).length / items.length) * 100)
  }, [profile, user?.emailVerified])

  if (loading) return <Layout wide><div className="h-96 animate-pulse rounded-[1.5rem] bg-outline/40" /></Layout>
  const displayName = profile?.name?.trim() || user?.displayName?.trim() || 'BikriKoro সদস্য'
  const joinedDate = profile?.created_at ? new Intl.DateTimeFormat('bn-BD', { dateStyle: 'medium' }).format(new Date(profile.created_at)) : 'এখনো যোগদানের তথ্য নেই'
  const isVerified = Boolean(profile?.is_verified)
  const totalTrades = Number(profile?.review_count ?? 0)
  const rating = profile?.rating ? Number(profile.rating).toFixed(1) : '0.0'

  const confirmDeleteAccount = async () => {
    if (deleteConfirmation !== 'DELETE' || deleting) return
    setDeleting(true)
    setDeleteError(null)
    try {
      await deleteAccount()
      navigate('/login', { replace: true, state: { accountDeleted: true } })
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'অ্যাকাউন্ট ডিলিট করা যায়নি।')
    } finally {
      setDeleting(false)
    }
  }

  return <Layout wide>
    <Helmet><title>অ্যাকাউন্ট | BikriKoro.Com</title></Helmet>
    <div className="mx-auto w-full max-w-3xl pb-24">
      <div className="mb-5 flex items-center justify-between"><div><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-brand-600">BikriKoro member</p><h1 className="mt-1 text-3xl font-bold tracking-tight text-ink-900">অ্যাকাউন্ট</h1></div><Link to="/account/edit" aria-label="প্রোফাইল সম্পাদনা" className="grid h-11 w-11 place-items-center rounded-full bg-surface text-ink-600 shadow-sm ring-1 ring-outline hover:text-brand-700"><PencilLine size={19} /></Link></div>
      <section className="rounded-[1.6rem] border border-outline bg-surface p-5 shadow-[0_12px_30px_rgba(15,23,42,0.06)] sm:p-7"><div className="flex items-center gap-4"><div className="grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-full bg-brand-100 text-3xl font-bold text-brand-700 ring-4 ring-brand-50">{profile?.photo_url ? <img src={profile.photo_url} alt="" className="h-full w-full object-cover" /> : displayName.charAt(0)}</div><div className="min-w-0"><h2 className="truncate text-2xl font-bold tracking-tight text-ink-900">{displayName}</h2><span className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold ${isVerified ? 'bg-brand-50 text-brand-700' : 'bg-accent-100 text-accent-600'}`}><BadgeCheck size={16} />{isVerified ? 'যাচাইকৃত' : 'Unverified'}</span><div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium"><span className={user?.emailVerified ? 'text-brand-600' : 'text-error'}>{user?.emailVerified ? <Check size={14} className="mr-0.5 inline" /> : <X size={14} className="mr-0.5 inline" />}Email</span><span className={profile?.phone ? 'text-brand-600' : 'text-error'}>{profile?.phone ? <Check size={14} className="mr-0.5 inline" /> : <X size={14} className="mr-0.5 inline" />}Phone</span><span className="text-error"><X size={14} className="mr-0.5 inline" />KYC</span></div></div></div><p className="mt-4 text-sm text-ink-500">যোগদান: {joinedDate}</p><div className="mt-4 flex items-center gap-3 rounded-2xl bg-bg px-3 py-2.5 text-sm text-ink-600"><Mail size={16} className="text-brand-600" /><span className="truncate">{maskEmail(user?.email || profile?.email)}</span></div></section>
      <section className="mt-4 grid grid-cols-2 gap-3 rounded-[1.35rem] border border-outline bg-surface p-4 shadow-sm"><div className="text-center"><p className="text-2xl font-bold text-ink-900">{totalTrades}</p><p className="mt-1 text-sm text-ink-500">সম্পন্ন ট্রেড</p></div><div className="border-l border-outline text-center"><p className="flex items-center justify-center gap-1 text-2xl font-bold text-ink-900"><Star size={22} className="fill-accent-500 text-accent-500" />{rating}</p><p className="mt-1 text-sm text-ink-500">গড় রেটিং</p></div></section>
      <Link to={isSeller ? '/seller/dashboard' : '/become-seller'} className="mt-4 flex items-center gap-4 rounded-[1.35rem] border border-brand-100 bg-brand-50 p-5 shadow-sm hover:border-brand-300"><span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-brand-500 text-white"><Store size={25} /></span><span className="min-w-0 flex-1"><span className="block text-2xl font-bold text-ink-900">{isSeller ? 'সেলার ড্যাশবোর্ড' : 'সেলার হোন'}</span><span className="mt-1 block text-sm text-ink-600">{isSeller ? 'লিস্টিং ও বিক্রয়ের পারফরম্যান্স দেখুন' : 'আপনার ডিজিটাল পণ্য বিক্রি শুরু করুন'}</span></span><span className="text-2xl text-brand-700">›</span></Link>
      <Link to="/payment-accounts" className="mt-4 flex items-center gap-4 rounded-[1.35rem] border border-pink-200 bg-pink-50 p-5 shadow-sm hover:border-pink-300"><span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-[#e2136e] text-white"><WalletCards size={25} /></span><span className="min-w-0 flex-1"><span className="block text-xl font-bold text-ink-900">পেমেন্ট অ্যাকাউন্ট</span><span className="mt-1 block text-sm text-ink-600">সেলার পেমেন্ট ও buyer refund-এর account যোগ বা পরিবর্তন করুন</span></span><span className="text-2xl text-pink-700">›</span></Link>
      <section className="mt-4 grid grid-cols-3 gap-2"><StatCard icon={ShoppingBag} value="0" label="বিক্রয়" /><StatCard icon={WalletCards} value="0" label="ক্রয়" /><StatCard icon={Eye} value="0" label="চলমান" /></section>
      <section className="mt-4 rounded-[1.35rem] border border-outline bg-surface p-5 shadow-sm"><div className="flex items-center justify-between"><div><h2 className="text-lg font-bold text-ink-900">প্রোফাইল সম্পূর্ণতা</h2><p className="mt-1 text-sm text-ink-500">আপনার অ্যাকাউন্ট আরও বিশ্বাসযোগ্য করুন</p></div><span className="text-2xl font-bold text-brand-600">{completionPercent}%</span></div><div className="mt-4 h-2 overflow-hidden rounded-full bg-brand-50"><div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${completionPercent}%` }} /></div><Link to="/account/edit" className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-brand-700"><UserRound size={16} />তথ্য আপডেট করুন</Link></section>
      <section className="mt-4 flex items-start gap-3 rounded-[1.35rem] border border-brand-100 bg-brand-50 p-4"><ShieldCheck size={21} className="mt-0.5 shrink-0 text-brand-600" /><div><h2 className="font-bold text-ink-900">আপনার তথ্য নিরাপদ</h2><p className="mt-1 text-sm leading-6 text-ink-600">ইমেইল, ফোন ও লগইন তথ্য অন্য ক্রেতা বা বিক্রেতার কাছে প্রকাশ করা হয় না।</p></div></section>
      <section className="mt-5 rounded-[1.35rem] border border-red-200 bg-red-50/60 p-4 sm:p-5"><div className="flex items-start gap-3"><AlertTriangle size={20} className="mt-0.5 shrink-0 text-red-600" /><div className="min-w-0 flex-1"><h2 className="font-bold text-red-900">অ্যাকাউন্ট ডিলিট</h2><p className="mt-1 text-sm leading-6 text-red-800/80">অ্যাকাউন্ট ডিলিট করলে আপনার profile ও login স্থায়ীভাবে মুছে যাবে। এই কাজটি undo করা যাবে না।</p><button type="button" onClick={() => { setDeleteError(null); setDeleteConfirmation(''); setDeleteDialogOpen(true) }} className="mt-3 rounded-xl border border-red-300 bg-white px-3.5 py-2.5 text-sm font-bold text-red-700 transition hover:bg-red-100">অ্যাকাউন্ট ডিলিট করার অনুরোধ</button></div></div></section>
      <BrandedDialog open={deleteDialogOpen} title="অ্যাকাউন্ট স্থায়ীভাবে ডিলিট করবেন?" tone="danger" onClose={() => { if (!deleting) setDeleteDialogOpen(false) }} actions={<><DialogButton variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>বাতিল</DialogButton><DialogButton tone="danger" onClick={() => void confirmDeleteAccount()} disabled={deleting || deleteConfirmation !== 'DELETE'}>{deleting ? 'ডিলিট হচ্ছে…' : 'স্থায়ীভাবে ডিলিট করুন'}</DialogButton></>}><div className="space-y-3 text-sm leading-6 text-ink-700"><p>এই কাজের পর আপনার login, profile information এবং account access আর ফিরিয়ে আনা যাবে না।</p><ul className="list-disc space-y-1 pl-5"><li>চলমান order থাকলে account ডিলিট হবে না—আগে order সম্পন্ন করুন বা Support Center-এ যোগাযোগ করুন।</li><li>আইনি, নিরাপত্তা বা লেনদেনের প্রয়োজনীয় কিছু record নীতিমালা অনুযায়ী রাখা হতে পারে।</li><li>ডিলিট করার আগে প্রয়োজনীয় তথ্য বা order record সংরক্ষণ করে নিন।</li></ul>{deleteError && <p className="rounded-xl bg-red-50 p-3 font-semibold text-red-700">{deleteError}</p>}<label className="block"><span className="mb-1.5 block font-bold text-ink-900">নিশ্চিত করতে <code className="rounded bg-red-100 px-1.5 py-0.5 text-red-700">DELETE</code> লিখুন</span><input value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} autoComplete="off" autoCapitalize="characters" spellCheck={false} placeholder="DELETE" className="w-full rounded-xl border border-outline bg-surface px-3 py-3 font-mono text-sm uppercase outline-none focus:border-red-400 focus:ring-2 focus:ring-red-500/10" /></label></div></BrandedDialog>
    </div>
  </Layout>
}

function StatCard({ icon: Icon, value, label }: { icon: typeof ShoppingBag; value: string; label: string }) {
  return <div className="rounded-[1.25rem] border border-outline bg-surface p-4 text-center shadow-sm"><Icon size={18} className="mx-auto text-brand-500" /><p className="mt-2 text-xl font-bold text-ink-900">{value}</p><p className="mt-1 text-sm text-ink-500">{label}</p></div>
}
