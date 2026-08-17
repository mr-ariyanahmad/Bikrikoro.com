import { CircleHelp, FileText, Headphones, Info, LockKeyhole, MessagesSquare, RefreshCcw, School, Settings2, ShieldCheck, Store } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { Layout } from '@/components/Layout'

const groups = [
  { title: 'সহায়তা', items: [['/help', 'Help Center', 'কেনাকাটা, payment, delivery ও account সহায়তা', CircleHelp], ['/faq', 'সাধারণ প্রশ্ন', 'দ্রুত FAQ উত্তর দেখুন', MessagesSquare], ['/contact', 'যোগাযোগ ও সাপোর্ট', 'Order বা account সমস্যায় জানান', Headphones]] },
  { title: 'নিরাপত্তা ও নীতি', items: [['/privacy', 'Privacy Policy', 'তথ্য সংগ্রহ ও নিরাপত্তা', LockKeyhole], ['/return-policy', 'Return ও Refund', 'পণ্য না মিললে করণীয়', RefreshCcw], ['/terms', 'ব্যবহারের শর্ত', 'Marketplace ব্যবহারের নিয়ম', FileText]] },
  { title: 'শিখুন', items: [['/user-education', 'User Education Hub', 'নিরাপদে কেনাকাটার গাইড', School], ['/seller-education', 'Seller Education Hub', 'ভালো listing ও বিক্রির গাইড', Store], ['/about', 'আমাদের সম্পর্কে', 'BikriKoro-এর উদ্দেশ্য', Info]] },
]

export default function SettingsHub() {
  return <Layout wide><Helmet><title>Settings ও Help Center | BikriKoro.Com</title></Helmet><div className="mx-auto max-w-5xl"><div className="rounded-3xl bg-ink-900 p-6 text-white sm:p-8"><div className="flex items-start justify-between gap-4"><div><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-500"><Settings2 size={22} /></div><h1 className="mt-4 text-2xl font-bold">Settings ও Help Center</h1><p className="mt-2 max-w-xl text-sm leading-6 text-white/70">আপনার account, নিরাপত্তা, support, policy এবং marketplace education—সব এক জায়গায়।</p></div><ShieldCheck className="text-brand-300" size={28} /></div></div><div className="mt-6 space-y-7">{groups.map((group) => <section key={group.title}><h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-500">{group.title}</h2><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{group.items.map(([to, label, description, Icon]) => <Link key={to as string} to={to as string} className="group rounded-2xl border border-outline bg-surface p-4 transition hover:-translate-y-0.5 hover:border-brand-500 hover:shadow-sm"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><Icon size={19} /></span><span className="min-w-0 flex-1"><span className="block font-semibold text-ink-900">{label as string}</span><span className="mt-1 block text-xs leading-5 text-ink-500">{description as string}</span></span><span className="text-lg text-ink-300 transition group-hover:translate-x-0.5 group-hover:text-brand-600">›</span></div></Link>)}</div></section>)}</div></div></Layout>
}
