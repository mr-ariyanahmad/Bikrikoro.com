import { useEffect, useState } from 'react'
import { ArrowRight, CheckCircle2, FileCheck2, Mail, ShieldCheck, Store } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Layout } from '@/components/Layout'
import { useIsSeller } from '@/hooks/useIsSeller'
import { BrandLoader } from '@/components/BrandLoader'

const benefits = [
  { icon: Store, title: 'সহজে শুরু করুন', body: 'নাম, email এবং basic shop information দিয়েই seller account শুরু করুন।' },
  { icon: ShieldCheck, title: 'ধাপে ধাপে verification', body: 'NID, selfie বা document এখনই নয়—প্রয়োজন হলে পরের ধাপে চাইব।' },
  { icon: FileCheck2, title: 'একবার verification', body: 'Identity verification সম্পন্ন হলে প্রতিটি product-এর জন্য একই document আবার লাগবে না।' },
]

export default function BecomeSeller() {
  const { user, sendVerificationEmail } = useAuth()
  const navigate = useNavigate()
  const { isSeller, loading: sellerStatusLoading } = useIsSeller()
  const [name, setName] = useState(user?.displayName || '')
  const [shopName, setShopName] = useState('')
  const [shopDescription, setShopDescription] = useState('')
  const [sending, setSending] = useState(false)
  const [starting, setStarting] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { if (user && !sellerStatusLoading && isSeller) navigate('/seller/dashboard', { replace: true }) }, [isSeller, navigate, sellerStatusLoading, user])
  useEffect(() => { if (user?.displayName && !name) setName(user.displayName) }, [name, user?.displayName])

  if (sellerStatusLoading) return <Layout wide><div className="mx-auto max-w-3xl py-16"><BrandLoader compact message="সেলার স্ট্যাটাস যাচাই হচ্ছে…" /></div></Layout>
  if (isSeller) return <Layout wide><div className="mx-auto max-w-3xl py-16"><BrandLoader compact message="সেলার ড্যাশবোর্ড খোলা হচ্ছে…" /></div></Layout>

  const sendVerification = async () => {
    setSending(true); setError(null); setNotice(null)
    try { await sendVerificationEmail(); setNotice('আপনার email-এ verification link পাঠানো হয়েছে। Link-এ চাপার পর এই পেজ refresh করে আবার শুরু করুন।') }
    catch { setError('Verification email পাঠানো যায়নি। কিছুক্ষণ পরে আবার চেষ্টা করুন।') }
    finally { setSending(false) }
  }

  const startBasicSeller = async () => {
    if (!user) { navigate('/login'); return }
    if (!user.emailVerified) { setError('Seller শুরু করার আগে আপনার email verify করুন।'); return }
    if (name.trim().length < 2) { setError('আপনার নাম দিন।'); return }
    setStarting(true); setError(null); setNotice(null)
    try {
      const token = await user.getIdToken(true)
      const response = await fetch('/api/seller-basic', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ name, shopName, shopDescription }) })
      const result = await response.json().catch(() => ({})) as { error?: string }
      if (!response.ok) throw new Error(result.error || 'Basic Seller setup করা যায়নি।')
      navigate('/seller/dashboard')
    } catch (startError) { setError(startError instanceof Error ? startError.message : 'Basic Seller setup করা যায়নি।') }
    finally { setStarting(false) }
  }

  return <Layout wide><div className="mx-auto max-w-4xl pb-20"><section className="overflow-hidden rounded-3xl border border-brand-200 bg-surface shadow-sm"><div className="relative bg-gradient-to-br from-brand-50 via-surface to-emerald-100 px-6 py-7 sm:px-10 sm:py-10"><div className="relative max-w-2xl"><p className="text-sm font-bold text-brand-700">BikriKoro Seller Center</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-ink-900 sm:text-4xl">সহজে selling শুরু করুন</h1><p className="mt-3 max-w-xl text-base leading-7 text-ink-700">Basic information সম্পন্ন করে product তৈরি করুন। Additional information বা identity verification কেবল প্রয়োজন হলে ধাপে ধাপে চাইব।</p>{!user && <Link to="/login" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-brand-500 px-5 py-3 text-base font-bold text-white shadow-sm transition hover:bg-brand-600">লগইন করে শুরু করুন <ArrowRight size={17} /></Link>}</div></div></section>

{user && <section className="mt-5 rounded-2xl border border-brand-200 bg-brand-50/60 p-5 sm:p-6"><div className="flex items-start gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-500 text-white"><Mail size={21} /></span><div className="min-w-0 flex-1"><p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-700">ধাপ ১ · Basic Seller</p><h2 className="mt-1 text-xl font-bold text-ink-900">{user.emailVerified ? 'আপনার email verified' : 'আগে email verify করুন'}</h2><p className="mt-2 text-sm leading-6 text-ink-700">{user.emailVerified ? 'এখন আপনার basic seller profile তৈরি করে product publish শুরু করতে পারবেন।' : 'Phone OTP বা NID এখনই লাগবে না। আপনার বর্তমান email verification link ব্যবহার করুন।'}</p>{!user.emailVerified && <button type="button" onClick={() => void sendVerification()} disabled={sending} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">{sending ? 'পাঠানো হচ্ছে…' : 'Verification email পাঠান'} <ArrowRight size={16} /></button>}</div><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${user.emailVerified ? 'bg-white text-brand-700' : 'bg-amber-100 text-amber-800'}`}>{user.emailVerified ? 'সম্পন্ন' : 'প্রয়োজন'}</span></div></section>}

{user?.emailVerified && <section className="mt-5 rounded-2xl border border-outline bg-surface p-5 shadow-sm sm:p-6"><p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-700">ধাপ ২ · Seller information</p><h2 className="mt-1 text-xl font-bold text-ink-900">আপনার basic seller profile তৈরি করুন</h2><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-sm font-medium text-ink-700">আপনার নাম<input value={name} onChange={(event) => setName(event.target.value)} className="mt-1.5 w-full rounded-xl border border-outline px-3 py-2.5 outline-none focus:border-brand-500" placeholder="আপনার নাম" /></label><label className="text-sm font-medium text-ink-700">শপের নাম <span className="font-normal text-ink-400">(optional)</span><input value={shopName} onChange={(event) => setShopName(event.target.value)} className="mt-1.5 w-full rounded-xl border border-outline px-3 py-2.5 outline-none focus:border-brand-500" placeholder="যেমন: Ariyan Digital" /></label><label className="text-sm font-medium text-ink-700 sm:col-span-2">শপ সম্পর্কে ছোট পরিচয় <span className="font-normal text-ink-400">(optional)</span><textarea value={shopDescription} onChange={(event) => setShopDescription(event.target.value)} rows={3} className="mt-1.5 w-full rounded-xl border border-outline px-3 py-2.5 outline-none focus:border-brand-500" placeholder="আপনি কী ধরনের digital product বিক্রি করেন?" /></label></div>{error && <p className="mt-4 rounded-xl bg-error/10 p-3 text-sm text-error">{error}</p>}{notice && <p className="mt-4 rounded-xl bg-brand-50 p-3 text-sm text-brand-800">{notice}</p>}<button type="button" onClick={() => void startBasicSeller()} disabled={starting} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-brand-500 px-5 py-3 text-sm font-bold text-white disabled:opacity-60">{starting ? 'তৈরি হচ্ছে…' : 'Basic Seller account শুরু করুন'} <ArrowRight size={17} /></button></section>}

{user && <section className="mt-5 rounded-2xl border border-outline bg-surface p-5"><div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><ShieldCheck size={20} /></span><div><p className="font-bold text-ink-900">পরে Verified Seller হতে চান?</p><p className="mt-1 text-sm leading-6 text-ink-600">আপনার account-এর transaction activity বাড়লে বা অতিরিক্ত সুবিধা unlock করতে চাইলে NID, selfie এবং প্রয়োজনীয় documents ধাপে ধাপে জমা দিতে পারবেন।</p><Link to="/become-seller/verify?mode=DIGITAL" className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-brand-700">Identity verification upgrade <ArrowRight size={15} /></Link></div></div></section>}

<section className="mt-5 grid gap-3 sm:grid-cols-3">{benefits.map(({ icon: Icon, title, body }) => <article key={title} className="rounded-2xl border border-outline bg-surface p-5 shadow-sm"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><Icon size={20} /></span><p className="mt-4 text-base font-bold text-ink-900">{title}</p><p className="mt-1 text-sm leading-6 text-ink-600">{body}</p><span className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-brand-700"><CheckCircle2 size={14} />trust-focused flow</span></article>)}</section></div></Layout>
}
