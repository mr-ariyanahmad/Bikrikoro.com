import { useEffect } from 'react'
import { ArrowRight, FileCheck2, ShieldCheck, Store } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Layout } from '@/components/Layout'
import { useIsSeller } from '@/hooks/useIsSeller'

export default function BecomeSeller() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { isSeller, loading: sellerStatusLoading } = useIsSeller()

  useEffect(() => {
    if (user && !sellerStatusLoading && isSeller) navigate('/seller/dashboard', { replace: true })
  }, [isSeller, navigate, sellerStatusLoading, user])

  if (!user) {
    return <Layout wide><div className="mx-auto max-w-3xl"><section className="bg-ink-900 p-6 text-white sm:p-10"><p className="text-sm font-semibold text-brand-300">BikriKoro digital seller</p><h1 className="mt-2 max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">বাংলাদেশে digital product বিক্রি শুরু করুন</h1><p className="mt-3 max-w-xl text-base leading-6 text-white/75">আগে লগইন করুন। তারপর seller type, identity/business documents এবং delivery capability review-এর জন্য জমা দিন।</p><Link to="/login" className="mt-6 inline-flex items-center gap-2 bg-white px-5 py-3 text-base font-bold text-brand-700">লগইন করে শুরু করুন <ArrowRight size={16} /></Link></section></div></Layout>
  }

  if (sellerStatusLoading || isSeller) return <Layout wide><div className="mx-auto max-w-3xl py-16 text-center"><div className="mx-auto h-10 w-10 animate-spin border-4 border-brand-100 border-t-brand-500" /><p className="mt-4 text-base font-medium text-ink-700">সেলার অ্যাকাউন্ট প্রস্তুত করা হচ্ছে…</p></div></Layout>

  return <Layout wide><div className="mx-auto max-w-4xl"><section className="border border-brand-200 bg-brand-50 p-6 sm:p-10"><div className="max-w-2xl"><p className="text-sm font-semibold text-brand-700">Digital seller setup</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-ink-900 sm:text-4xl">নিরাপদভাবে digital product বিক্রি করুন</h1><p className="mt-3 text-base leading-7 text-ink-700">BikriKoro-তে physical product listing বন্ধ। শুধু digital key, file, access, course, design এবং service-এর জন্য শক্ত verification ও manual admin approval প্রয়োজন।</p></div></section><section className="mt-6 border border-outline bg-surface p-6 sm:p-8"><div className="flex items-start gap-4"><span className="flex h-14 w-14 shrink-0 items-center justify-center bg-brand-500 text-white"><FileCheck2 size={27} /></span><div><h2 className="text-xl font-bold text-ink-900">Digital Seller Verification</h2><p className="mt-2 text-base leading-6 text-ink-700">আপনার seller type নির্বাচন করে প্রয়োজনীয় identity, address, ownership, business বা company documents জমা দিন। প্রতিটি sector-এর verification badge আলাদা করে admin review করবেন।</p><button type="button" onClick={() => navigate('/become-seller/verify?mode=DIGITAL')} className="mt-5 inline-flex items-center gap-2 bg-brand-500 px-4 py-3 text-base font-bold text-white">Verification শুরু করুন <ArrowRight size={16} /></button></div></div></section><section className="mt-6 grid gap-3 sm:grid-cols-3"><Info icon={ShieldCheck} title="শক্ত review" body="Firebase identity, documents এবং seller information নিরাপদ gateway দিয়ে review হবে।" /><Info icon={Store} title="Admin approval" body="Approval না হওয়া পর্যন্ত product public catalogue-এ যাবে না।" /><Info icon={FileCheck2} title="Automatic delivery" body="Approved seller key, file, access বা instructions escrow payment-এর পরে deliver করবেন।" /></section></div></Layout>
}

function Info({ icon: Icon, title, body }: { icon: typeof ShieldCheck; title: string; body: string }) { return <div className="border border-outline bg-surface p-4"><Icon size={19} className="text-brand-600" /><p className="mt-3 text-base font-bold text-ink-900">{title}</p><p className="mt-1 text-sm leading-5 text-ink-600">{body}</p></div> }
