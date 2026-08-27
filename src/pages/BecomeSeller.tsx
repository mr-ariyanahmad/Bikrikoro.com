import { useEffect } from 'react'
import { ArrowRight, CheckCircle2, FileCheck2, ShieldCheck, Store } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Layout } from '@/components/Layout'
import { useIsSeller } from '@/hooks/useIsSeller'
import { BrandLoader } from '@/components/BrandLoader'

const benefits = [
  { icon: ShieldCheck, title: 'কঠোর পর্যালোচনা', body: 'পরিচয়, কাগজপত্র ও বিক্রেতার তথ্য নিরাপদ প্রক্রিয়ায় যাচাই করা হয়।' },
  { icon: Store, title: 'বিশ্বাসযোগ্য শপ', body: 'তথ্য যাচাই শেষ হলে আপনার শপ ও পণ্য প্রকাশের সুযোগ পাবেন।' },
  { icon: FileCheck2, title: 'ডিজিটাল ডেলিভারি', body: 'পেমেন্টের পর কী, ফাইল বা নির্দেশনা ক্রেতার কাছে পৌঁছে দিন।' },
]

function SellerHero({ signedIn, onStart }: { signedIn: boolean; onStart?: () => void }) {
  return <section className="overflow-hidden rounded-3xl border border-brand-200 bg-surface shadow-sm"><div className="relative bg-gradient-to-br from-brand-50 via-surface to-emerald-100 px-6 py-7 sm:px-10 sm:py-10"><div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-brand-200/45 blur-2xl" /><div className="relative max-w-2xl"><p className="text-sm font-bold text-brand-700">BikriKoro ডিজিটাল বিক্রেতা</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-ink-900 sm:text-4xl">নিরাপদভাবে ডিজিটাল পণ্য বিক্রি করুন</h1><p className="mt-3 max-w-xl text-base leading-7 text-ink-700">BikriKoro-তে শুধু ডিজিটাল কী, ফাইল, প্রবেশাধিকার, কোর্স, ডিজাইন এবং সেবা বিক্রি করা যায়। বিক্রি শুরুর আগে আপনার তথ্য যাচাই করা হবে।</p>{signedIn ? <button type="button" onClick={onStart} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-brand-500 px-5 py-3 text-base font-bold text-white shadow-sm transition hover:bg-brand-600">যাচাই শুরু করুন <ArrowRight size={17} /></button> : <Link to="/login" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-brand-500 px-5 py-3 text-base font-bold text-white shadow-sm transition hover:bg-brand-600">লগইন করে শুরু করুন <ArrowRight size={17} /></Link>}</div></div></section>
}

export default function BecomeSeller() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { isSeller, loading: sellerStatusLoading } = useIsSeller()

  useEffect(() => { if (user && !sellerStatusLoading && isSeller) navigate('/seller/dashboard', { replace: true }) }, [isSeller, navigate, sellerStatusLoading, user])
  if (sellerStatusLoading || isSeller) return <Layout wide><div className="mx-auto max-w-3xl py-16"><BrandLoader message="সেলার অ্যাকাউন্ট প্রস্তুত করা হচ্ছে…" /></div></Layout>

  return <Layout wide><div className="mx-auto max-w-4xl pb-20"><SellerHero signedIn={Boolean(user)} onStart={() => navigate('/become-seller/verify?mode=DIGITAL')} />{user && <section className="mt-5 rounded-2xl border border-outline bg-surface p-5 shadow-sm sm:p-6"><div className="flex items-start gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><FileCheck2 size={22} /></span><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-700">যাচাইয়ের আগে</p><h2 className="mt-1 text-xl font-bold text-ink-900">ডিজিটাল বিক্রেতা যাচাই</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-ink-600">বিক্রেতার ধরন বেছে নিয়ে প্রয়োজনীয় পরিচয়, ঠিকানা, মালিকানা, ব্যবসা বা কোম্পানির কাগজপত্র জমা দিন। আপনার ধরনের জন্য প্রয়োজনীয় কাগজপত্রই দেখানো হবে।</p></div></div></section>}<section className="mt-5 grid gap-3 sm:grid-cols-3">{benefits.map(({ icon: Icon, title, body }) => <article key={title} className="rounded-2xl border border-outline bg-surface p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-300"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><Icon size={20} /></span><p className="mt-4 text-base font-bold text-ink-900">{title}</p><p className="mt-1 text-sm leading-6 text-ink-600">{body}</p><span className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-brand-700"><CheckCircle2 size={14} />নিরাপদ প্রক্রিয়া</span></article>)}</section></div></Layout>
}
