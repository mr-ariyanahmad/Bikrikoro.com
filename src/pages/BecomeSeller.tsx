import { useEffect, useState } from 'react'
import { CheckCircle2, ChevronRight, ClipboardCheck, ShieldCheck, Store, WalletCards } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Layout } from '@/components/Layout'

const STEPS = [
  { id: 'profile', title: 'প্রোফাইল সম্পূর্ণ করুন', body: 'নাম, ফোন ও প্রোফাইল ছবি যোগ করলে ক্রেতার আস্থা বাড়ে।', to: '/account', icon: Store },
  { id: 'listing', title: 'প্রথম পণ্য পোস্ট করুন', body: 'স্পষ্ট ছবি, সৎ বিবরণ ও সঠিক দাম দিন।', to: '/sell', icon: ClipboardCheck },
  { id: 'verification', title: 'ভেরিফাইড সেলার আবেদন', body: 'পরিচয় যাচাই করলে listing-এ অতিরিক্ত trust badge দেখা যাবে।', to: '/become-seller/verify', icon: ShieldCheck },
  { id: 'payout', title: 'Payout বুঝে নিন', body: 'অর্ডার সম্পন্ন হলে টাকা wallet-এ আসে এবং সেখান থেকে উত্তোলন করা যায়।', to: '/wallet', icon: WalletCards },
]

const ONBOARDING_KEY = 'bikrikoro:seller-onboarding'

export default function BecomeSeller() {
  const { user } = useAuth()
  const [done, setDone] = useState<string[]>([])
  useEffect(() => { if (!user) return; try { setDone(JSON.parse(localStorage.getItem(`${ONBOARDING_KEY}:${user.uid}`) ?? '[]')) } catch { setDone([]) } }, [user])
  const toggle = (id: string) => { if (!user) return; const next = done.includes(id) ? done.filter((item) => item !== id) : [...done, id]; setDone(next); localStorage.setItem(`${ONBOARDING_KEY}:${user.uid}`, JSON.stringify(next)) }
  const progress = Math.round((done.length / STEPS.length) * 100)

  return (
    <Layout>
      <section className="rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 p-6 text-white sm:p-8">
        <p className="text-sm font-medium text-brand-50/80">বিক্রেতা হোন</p>
        <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">BikriKoro-তে বিক্রি শুরু করুন</h1>
        <p className="mt-2 max-w-md text-sm text-brand-50/90">
          কোনো রেজিস্ট্রেশন ফি নেই — যেকোনো ব্যবহারকারী সরাসরি পণ্য পোস্ট করতে পারেন। এসক্রো সিস্টেম আপনার আর ক্রেতার
          দুজনকেই সুরক্ষা দেয়।
        </p>
        <Link
          to={user ? '/sell' : '/login'}
          className="mt-4 inline-block rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-brand-700 transition hover:bg-brand-50"
        >
          {user ? 'এখনই পণ্য পোস্ট করুন' : 'লগইন করে শুরু করুন'}
        </Link>
        {user && (
          <Link
            to="/become-seller/verify"
            className="mt-4 ml-3 inline-block rounded-xl border border-white/40 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            ভেরিফাইড সেলার হতে আবেদন করুন
          </Link>
        )}
      </section>

      {user && <section className="mt-6 rounded-2xl border border-outline bg-surface p-5"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm font-semibold text-ink-900">Seller onboarding checklist</p><p className="mt-1 text-sm text-ink-500">{done.length}/{STEPS.length} ধাপ সম্পন্ন — আজই দোকান প্রস্তুত করুন।</p></div><span className="text-2xl font-bold text-brand-600">{progress}%</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-outline/40"><div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${progress}%` }} /></div><div className="mt-5 space-y-2">{STEPS.map(({ id, title, body, to, icon: Icon }) => <div key={id} className="flex items-center gap-3 rounded-xl border border-outline p-3"><button onClick={() => toggle(id)} className="shrink-0 text-brand-600" aria-label={`${title} সম্পন্ন হিসেবে চিহ্নিত করুন`}>{done.includes(id) ? <CheckCircle2 size={23} /> : <span className="block h-5 w-5 rounded-full border-2 border-outline" />}</button><Icon size={18} className="shrink-0 text-ink-400" /><div className="min-w-0 flex-1"><p className={`text-sm font-semibold ${done.includes(id) ? 'text-ink-400 line-through' : 'text-ink-900'}`}>{title}</p><p className="mt-0.5 text-xs text-ink-500">{body}</p></div><Link to={to} className="text-brand-600" aria-label={title}><ChevronRight size={18} /></Link></div>)}</div></section>}

      <div className="mt-8 space-y-5">
        {STEPS.map((step, i) => (
          <div key={step.title} className="flex gap-4">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
              {i + 1}
            </div>
            <div>
              <p className="font-medium text-ink-900">{step.title}</p>
              <p className="mt-0.5 text-sm text-ink-600">{step.body}</p>
            </div>
          </div>
        ))}
      </div>
    </Layout>
  )
}
