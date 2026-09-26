import { ArrowRight, BadgeCheck, Check, LockKeyhole, ShieldCheck, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { BikrifyBadge } from '@/components/BikrifyBadge'

export function BikrifyStory({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <section className="relative isolate overflow-hidden bg-[#09261d] px-4 py-10 text-white sm:px-6 sm:py-14">
        <div className="pointer-events-none absolute -right-24 -top-32 -z-10 h-80 w-80 rounded-full bg-brand-500/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-36 left-[35%] -z-10 h-72 w-72 rounded-full bg-emerald-300/10 blur-3xl" />
        <div className="mx-auto grid max-w-6xl items-center gap-9 lg:grid-cols-[1.05fr_.95fr]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-brand-300/30 bg-white/10 px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em] text-brand-100"><ShieldCheck size={14} /> Meet Bikrify</div>
            <h2 className="mt-4 max-w-2xl text-3xl font-black leading-[1.12] tracking-tight sm:text-4xl">ভালো seller চেনার নতুন পরিচয়।</h2>
            <p className="mt-4 max-w-xl text-sm leading-7 text-white/70 sm:text-base">Bikrify হলো BikriKoro-এর authentication brand—NID বা business/company verification approve হলে approved seller-এর profile-এ এই trust signal দেখা যায়।</p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row"><Link to="/about" className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-500 px-5 py-3 text-sm font-black text-white shadow-lg shadow-black/10 transition hover:-translate-y-0.5 hover:bg-brand-400">Bikrify সম্পর্কে জানুন <ArrowRight size={16} /></Link><Link to="/blog/bikrify-verified-seller-system" className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 px-5 py-3 text-sm font-black text-white transition hover:bg-white/10">Verified seller guide</Link></div>
            <p className="mt-4 text-xs text-white/45">Badge একটি helpful signal—কেনার আগে product, review ও delivery information যাচাই করুন।</p>
          </div>
          <div className="relative mx-auto w-full max-w-md lg:ml-auto">
            <div className="absolute -inset-4 rounded-[2rem] border border-brand-300/10" />
            <div className="relative rounded-[1.75rem] border border-white/15 bg-white p-5 text-ink-900 shadow-[0_24px_70px_rgba(0,0,0,0.28)] sm:p-6">
              <div className="flex items-center justify-between border-b border-outline pb-4"><div><p className="text-[10px] font-black uppercase tracking-[0.16em] text-ink-400">Seller profile</p><p className="mt-1 text-lg font-black">Verified identity</p></div><span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-600 text-white shadow-lg shadow-brand-600/20"><ShieldCheck size={24} /></span></div>
              <div className="mt-5 flex items-center gap-3 rounded-2xl bg-brand-50 p-3"><span className="grid h-11 w-11 place-items-center rounded-full bg-brand-600 text-white"><BadgeCheck size={22} /></span><div className="min-w-0 flex-1"><p className="text-xs font-bold text-ink-500">Authentication status</p><div className="mt-1 flex items-center gap-2"><BikrifyBadge /><span className="text-[11px] font-bold text-brand-700">Approved seller</span></div></div></div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2"><MiniSignal icon={Check} title="Reviewed identity" /><MiniSignal icon={LockKeyhole} title="Private documents" /></div>
              <div className="mt-4 flex items-center gap-2 border-t border-outline pt-4 text-xs text-ink-500"><Users size={15} className="text-brand-600" /> Buyer-এর জন্য পরিষ্কার trust signal</div>
            </div>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section id="bikrify" className="border-y border-brand-100 bg-[#eaf5f1] px-4 py-16 sm:px-6 sm:py-20">
      <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[1.05fr_.95fr]">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.14em] text-brand-700">Meet Bikrify</p>
          <h2 className="mt-2 max-w-2xl text-3xl font-black leading-tight tracking-tight text-ink-900 sm:text-4xl">Bikrify কী? BikriKoro-এর authentication brand।</h2>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-ink-600 sm:text-base">Bikrify হলো আমাদের approved seller verification-এর দৃশ্যমান trust signal। এটি buyer-কে বলে যে seller BikriKoro-এর নির্দিষ্ট identity বা business verification process সম্পন্ন করেছেন—তবে badge কোনো product বা transaction-এর গ্যারান্টি নয়।</p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row"><Link to="/about" className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-sm font-black text-white transition hover:bg-brand-700">Bikrify সম্পর্কে জানুন <ArrowRight size={16} /></Link><Link to="/blog/bikrify-verified-seller-system" className="inline-flex items-center justify-center gap-2 rounded-xl border border-brand-200 bg-white px-5 py-3 text-sm font-black text-brand-700 transition hover:bg-brand-50">সম্পূর্ণ ব্লগ পড়ুন</Link></div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1"><StoryPoint icon={ShieldCheck} title="১. Verification" detail="NID pass অথবা business/company registration approve হলে eligibility তৈরি হয়।" /><StoryPoint icon={BadgeCheck} title="২. Bikrify badge" detail="Approved seller-এর public profile ও marketplace surfaces-এ badge দেখা যায়।" /><StoryPoint icon={Users} title="৩. Better decisions" detail="Buyer profile, review, product ও delivery তথ্য আরও সচেতনভাবে যাচাই করতে পারেন।" /></div>
      </div>
    </section>
  )
}

function MiniSignal({ icon: Icon, title }: { icon: typeof Check; title: string }) {
  return <div className="flex items-center gap-2 rounded-xl border border-outline px-3 py-2.5"><span className="grid h-7 w-7 place-items-center rounded-lg bg-brand-100 text-brand-700"><Icon size={14} /></span><span className="text-xs font-bold text-ink-700">{title}</span></div>
}

function StoryPoint({ icon: Icon, title, detail }: { icon: typeof ShieldCheck; title: string; detail: string }) {
  return <div className="flex gap-3 rounded-2xl border border-brand-100 bg-white p-4 shadow-[0_8px_24px_rgba(23,33,29,0.04)]"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-100 text-brand-700"><Icon size={19} /></span><div><p className="text-sm font-black text-ink-900">{title}</p><p className="mt-1 text-xs leading-5 text-ink-600">{detail}</p></div></div>
}
