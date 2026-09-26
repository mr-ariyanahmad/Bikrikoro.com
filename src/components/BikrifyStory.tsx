import { ArrowRight, BadgeCheck, LockKeyhole, ShieldCheck, Users } from 'lucide-react'
import { Link } from 'react-router-dom'

export function BikrifyStory({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <section className="relative overflow-hidden rounded-3xl border border-brand-100 bg-[#eaf5f1] p-6 sm:p-8">
        <div className="absolute -right-20 -top-20 h-48 w-48 rounded-full bg-brand-500/15 blur-3xl" />
        <div className="relative grid gap-6 lg:grid-cols-[1.1fr_.9fr] lg:items-center">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.14em] text-brand-700">Bikrify authentication brand</p>
            <h2 className="mt-2 text-2xl font-black leading-tight text-ink-900 sm:text-3xl">Bikrify শুধু একটি badge নয়—এটি বিশ্বাস যাচাইয়ের ভাষা।</h2>
            <p className="mt-3 text-sm leading-7 text-ink-600">NID বা business/company verification approve হলে seller profile-এ Bikrify দেখা যায়। সাধারণ user listing করতে পারেন, কিন্তু approval ছাড়া এই authentication identity ব্যবহার করতে পারেন না।</p>
            <Link to="/blog/bikrify-authentication-brand" className="mt-5 inline-flex items-center gap-2 text-sm font-black text-brand-700 hover:underline">Bikrify সম্পর্কে বিস্তারিত পড়ুন <ArrowRight size={16} /></Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            <StoryPoint icon={ShieldCheck} title="Approved identity" detail="NID, business বা company verification-এর পর।" />
            <StoryPoint icon={BadgeCheck} title="Visible trust signal" detail="Buyer seller profile-এ সহজে বুঝতে পারেন।" />
            <StoryPoint icon={LockKeyhole} title="Private documents" detail="Sensitive documents public profile-এ আসে না।" />
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
          <div className="mt-7 flex flex-col gap-3 sm:flex-row"><Link to="/about" className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-sm font-black text-white transition hover:bg-brand-700">Bikrify সম্পর্কে জানুন <ArrowRight size={16} /></Link><Link to="/blog/bikrify-authentication-brand" className="inline-flex items-center justify-center gap-2 rounded-xl border border-brand-200 bg-white px-5 py-3 text-sm font-black text-brand-700 transition hover:bg-brand-50">সম্পূর্ণ ব্লগ পড়ুন</Link></div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
          <StoryPoint icon={ShieldCheck} title="১. Verification" detail="NID pass অথবা business/company registration approve হলে eligibility তৈরি হয়।" />
          <StoryPoint icon={BadgeCheck} title="২. Bikrify badge" detail="Approved seller-এর public profile ও marketplace surfaces-এ badge দেখা যায়।" />
          <StoryPoint icon={Users} title="৩. Better decisions" detail="Buyer profile, review, product ও delivery তথ্য আরও সচেতনভাবে যাচাই করতে পারেন।" />
        </div>
      </div>
    </section>
  )
}

function StoryPoint({ icon: Icon, title, detail }: { icon: typeof ShieldCheck; title: string; detail: string }) {
  return <div className="flex gap-3 rounded-2xl border border-brand-100 bg-white p-4 shadow-[0_8px_24px_rgba(23,33,29,0.04)]"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-100 text-brand-700"><Icon size={19} /></span><div><p className="text-sm font-black text-ink-900">{title}</p><p className="mt-1 text-xs leading-5 text-ink-600">{detail}</p></div></div>
}
