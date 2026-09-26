import { useEffect, useState } from 'react'
import { BookOpen, ChevronRight, CircleHelp, FileText, Headphones, LockKeyhole, Mail, MessageCircle, Package, ShieldCheck, Users, WalletCards } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { supabase } from '@/lib/supabase'
import { SITE_URL } from '@/lib/site'
import { Layout } from '@/components/Layout'
import { AIAssistant } from '@/components/AIAssistant'
import { EducationHub } from '@/components/EducationHub'
import { CommunityLinks } from '@/components/CommunityLinks'
import { BikrifyStory } from '@/components/BikrifyStory'
import { FaqAccordion } from '@/components/FaqAccordion'

type ContentType = 'ABOUT' | 'PRIVACY' | 'CONTACT' | 'HELP' | 'FAQ' | 'USER_EDU' | 'SELLER_EDU' | 'RETURN_POLICY' | 'SELLER_PRIVACY' | 'TERMS'
type ContentRow = { id: string; title: string; slug: string; excerpt: string; body: string; cover_image_url: string | null; seo_title: string | null; seo_description: string | null; sort_order?: number; updated_at: string }
type PageMeta = { title: string; subtitle: string; icon: typeof BookOpen }

const COPY: Record<ContentType, PageMeta> = {
  ABOUT: { title: 'আমাদের সম্পর্কে', subtitle: 'BikriKoro.Com-এর উদ্দেশ্য ও নিরাপদ digital marketplace-এর নীতি।', icon: ShieldCheck },
  PRIVACY: { title: 'প্রাইভেসি পলিসি', subtitle: 'আপনার তথ্য কীভাবে ব্যবহৃত ও সুরক্ষিত হয়।', icon: ShieldCheck },
  CONTACT: { title: 'যোগাযোগ ও সাপোর্ট', subtitle: 'অর্ডার, অ্যাকাউন্ট বা বিক্রেতা-সংক্রান্ত সমস্যায় আমাদের জানান।', icon: Mail },
  HELP: { title: 'সহায়তা কেন্দ্র', subtitle: 'কেনাকাটা, বিক্রি, payment, delivery ও account নিয়ে দ্রুত সহায়তা।', icon: CircleHelp },
  FAQ: { title: 'সাধারণ প্রশ্নের উত্তর', subtitle: 'BikriKoro ব্যবহারের গুরুত্বপূর্ণ প্রশ্নগুলো এক জায়গায়।', icon: CircleHelp },
  USER_EDU: { title: 'ক্রেতা শিক্ষা', subtitle: 'নিরাপদে কেনাকাটা ও account ব্যবহারের guide।', icon: BookOpen },
  SELLER_EDU: { title: 'বিক্রেতা শিক্ষা', subtitle: 'ভালো listing, দ্রুত delivery ও বিশ্বস্ত seller profile তৈরির guide।', icon: BookOpen },
  RETURN_POLICY: { title: 'ফেরত ও অর্থ ফেরত নীতি', subtitle: 'পণ্য না মিললে কীভাবে সহায়তা পাবেন।', icon: FileText },
  SELLER_PRIVACY: { title: 'Seller Privacy Policy', subtitle: 'Seller ও shop application-এর তথ্য কীভাবে সংগ্রহ, ব্যবহার ও সুরক্ষিত করা হয়।', icon: ShieldCheck },
  TERMS: { title: 'ব্যবহারের শর্ত', subtitle: 'BikriKoro ব্যবহার করার আগে গুরুত্বপূর্ণ নিয়মগুলো জানুন।', icon: FileText },
}

export default function PublicContentPage({ type }: { type: ContentType }) {
  const meta = COPY[type]
  const [rows, setRows] = useState<ContentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true); setRows([]); setError(null)
    const load = async () => {
      try {
        const { data, error: loadError } = await supabase.rpc('get_published_content', { p_content_type: type, p_slug: null })
        if (loadError) throw loadError
        if (active) setRows((data ?? []) as ContentRow[])
      } catch (loadError) {
        console.error('Public content load failed:', loadError)
        if (active) setError('এই পেজের live content এখন লোড করা যাচ্ছে না। নিচের built-in guide ব্যবহার করুন।')
      } finally { if (active) setLoading(false) }
    }
    void load()
    return () => { active = false }
  }, [type])

  const Icon = meta.icon
  const primaryRow = rows[0]
  const pageTitle = primaryRow?.seo_title || primaryRow?.title || meta.title
  const pageDescription = primaryRow?.seo_description || primaryRow?.excerpt || meta.subtitle
  const pagePathMap: Record<ContentType, string> = { ABOUT: 'about', PRIVACY: 'privacy', CONTACT: 'contact', HELP: 'help', FAQ: 'faq', USER_EDU: 'user-education', SELLER_EDU: 'seller-education', RETURN_POLICY: 'return-policy', SELLER_PRIVACY: 'seller-privacy-policy', TERMS: 'terms' }
  const pagePath = pagePathMap[type]
  const isEducation = type === 'USER_EDU' || type === 'SELLER_EDU'
  const useFallback = !loading && rows.length === 0 && (type === 'ABOUT' || type === 'HELP')

  return <Layout wide>
    <Helmet>
      <title>{pageTitle} — BikriKoro.Com</title><meta name="description" content={pageDescription} /><meta property="og:type" content="article" /><meta property="og:site_name" content="BikriKoro" /><meta property="og:title" content={`${pageTitle} — BikriKoro`} /><meta property="og:description" content={pageDescription} /><meta property="og:url" content={`${SITE_URL}/${pagePath}`} /><meta name="twitter:card" content="summary" /><meta name="twitter:title" content={`${pageTitle} — BikriKoro`} /><meta name="twitter:description" content={pageDescription} /><link rel="canonical" href={`${SITE_URL}/${pagePath}`} />
      {useFallback && <script type="application/ld+json">{JSON.stringify({ '@context': 'https://schema.org', '@type': type === 'HELP' ? 'FAQPage' : 'AboutPage', name: pageTitle, url: `${SITE_URL}/${pagePath}`, description: pageDescription })}</script>}
    </Helmet>
    <div className="mx-auto max-w-6xl">
      {!isEducation && <section className="relative isolate overflow-hidden rounded-[2rem] border border-brand-100 bg-gradient-to-br from-[#effaf4] via-white to-[#eaf5f1] px-5 py-7 shadow-[0_18px_50px_rgba(0,84,55,0.07)] sm:px-9 sm:py-10"><div className="pointer-events-none absolute -right-20 -top-24 -z-10 h-64 w-64 rounded-full bg-brand-200/40 blur-3xl" /><div className="pointer-events-none absolute -bottom-24 left-1/3 -z-10 h-48 w-48 rounded-full bg-amber-100/60 blur-3xl" /><div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between"><div className="min-w-0"><div className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white/80 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.16em] text-brand-700"><Icon size={14} /> BikriKoro knowledge center</div><h1 className="mt-4 max-w-3xl break-words text-3xl font-black leading-[1.18] tracking-tight text-ink-900 sm:text-5xl">{primaryRow?.title || meta.title}</h1><p className="mt-3 max-w-2xl break-words text-sm leading-7 text-ink-600 sm:text-base">{primaryRow?.excerpt || meta.subtitle}</p><div className="mt-5 flex flex-wrap items-center gap-3 text-xs font-semibold text-ink-500"><span className="rounded-full bg-brand-100 px-3 py-1.5 text-brand-700">{type === 'FAQ' ? `${rows.length || 'একাধিক'}টি প্রশ্ন` : 'Official information'}</span>{primaryRow?.updated_at && <span>সর্বশেষ আপডেট: {new Date(primaryRow.updated_at).toLocaleDateString('bn-BD')}</span>}</div></div><Link to="/app" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-3 text-sm font-black text-white shadow-lg shadow-brand-600/15 transition hover:-translate-y-0.5 hover:bg-brand-700">Marketplace খুলুন <ChevronRight size={16} /></Link></div></section>}
      <div className={`mt-7 grid gap-7 ${isEducation ? '' : 'lg:grid-cols-[minmax(0,1fr)_18rem]'}`}>
        <main className="min-w-0">
          {type === 'SELLER_EDU' && <div className="mb-6"><CommunityLinks placement="SELLER_EDU" /></div>}
          {error && !useFallback && <p className="mb-5 rounded-2xl border border-warning/30 bg-warning/10 p-4 text-sm leading-6 text-warning">{error}</p>}
          {loading ? <div className="h-64 animate-pulse rounded-[1.5rem] bg-outline/40" /> : useFallback ? (type === 'ABOUT' ? <AboutFallback /> : <HelpFallback />) : rows.length > 0 ? type === 'FAQ' ? <FaqAccordion items={rows} /> : isEducation ? <EducationHub type={type} rows={rows} /> : <div className="space-y-5">{rows.map((row) => <ContentArticle key={row.id} row={row} />)}</div> : <article className="rounded-[1.5rem] border border-outline bg-white p-6 shadow-sm sm:p-8"><p className="text-sm leading-7 text-ink-600">এই পেজে এখনো কোনো তথ্য প্রকাশ করা হয়নি।</p></article>}
          {(type === 'HELP' || type === 'FAQ') && <AIAssistant />}
        </main>
        {!isEducation && <aside className="hidden lg:block"><div className="sticky top-24 space-y-4"><nav className="rounded-[1.5rem] border border-outline bg-white p-4 shadow-sm" aria-label="তথ্য পেজ নেভিগেশন"><p className="px-2 pb-3 text-xs font-black uppercase tracking-[0.14em] text-ink-400">দ্রুত নেভিগেশন</p><div className="grid gap-1"><QuickLink to="/about" label="আমাদের সম্পর্কে" active={type === 'ABOUT'} /><QuickLink to="/privacy" label="প্রাইভেসি পলিসি" active={type === 'PRIVACY'} /><QuickLink to="/faq" label="সাধারণ প্রশ্ন" active={type === 'FAQ'} /><QuickLink to="/help" label="সহায়তা কেন্দ্র" active={type === 'HELP'} /><QuickLink to="/contact" label="যোগাযোগ" active={type === 'CONTACT'} /><QuickLink to="/terms" label="ব্যবহারের শর্ত" active={type === 'TERMS'} /></div></nav><div className="rounded-[1.5rem] border border-brand-100 bg-brand-50 p-5"><ShieldCheck size={21} className="text-brand-700" /><h2 className="mt-3 text-base font-black text-ink-900">বিশ্বাসের সাথে ব্যবহার করুন</h2><p className="mt-1 text-sm leading-6 text-ink-600">কোনো প্রশ্ন থাকলে Help Center বা support team-এর সাথে যোগাযোগ করুন।</p><Link to="/contact" className="mt-4 inline-flex items-center gap-1 text-sm font-black text-brand-700 hover:underline">যোগাযোগ করুন <ChevronRight size={15} /></Link></div></div></aside>}
      </div>
    </div>
  </Layout>
}

function ContentArticle({ row }: { row: ContentRow }) {
  return <article className="overflow-hidden rounded-[1.5rem] border border-outline bg-white shadow-[0_10px_30px_rgba(15,23,42,0.04)]">{row.cover_image_url && <img src={row.cover_image_url} alt={`${row.title} — BikriKoro`} className="aspect-[16/6] w-full object-cover" />}<div className="p-6 sm:p-9"><div className="mb-5 h-1 w-12 rounded-full bg-brand-500" /><h2 className="break-words text-2xl font-black tracking-tight text-ink-900 sm:text-3xl">{row.title}</h2>{row.excerpt && <p className="mt-2 break-words text-sm font-medium leading-7 text-brand-700">{row.excerpt}</p>}<div className="mt-6 whitespace-pre-line break-words text-[15px] leading-8 text-ink-700">{row.body}</div><div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-outline pt-4 text-xs text-ink-400"><span>প্রকাশিত তথ্য</span><span>আপডেট: {new Date(row.updated_at).toLocaleDateString('bn-BD')}</span></div></div></article>
}

function QuickLink({ to, label, active }: { to: string; label: string; active: boolean }) {
  return <Link to={to} className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-bold transition ${active ? 'bg-brand-50 text-brand-700' : 'text-ink-600 hover:bg-bg hover:text-brand-700'}`}><span>{label}</span><ChevronRight size={15} className={active ? 'text-brand-600' : 'text-ink-300'} /></Link>
}

function AboutFallback() {
  return <div className="space-y-5">
    <section className="relative overflow-hidden rounded-3xl bg-[#10281f] p-6 text-white shadow-lg sm:p-9"><div className="absolute -right-20 -top-20 h-52 w-52 rounded-full bg-brand-500/20 blur-3xl" /><p className="relative text-sm font-bold text-brand-100">Built for better digital commerce</p><h2 className="relative mt-2 max-w-2xl text-3xl font-black leading-tight sm:text-4xl">কেনা-বেচা হোক স্বচ্ছ, নিরাপদ এবং মানুষের জন্য সহজ।</h2><p className="relative mt-4 max-w-2xl text-sm leading-7 text-white/75">BikriKoro.Com বাংলাদেশের digital marketplace যেখানে buyer ও seller পরিষ্কার তথ্য, secure delivery এবং প্রয়োজনে human support-এর মাধ্যমে একসাথে কাজ করতে পারেন।</p></section>
    <BikrifyStory compact />
    <div className="grid gap-4 md:grid-cols-3"><InfoCard icon={ShieldCheck} title="বিশ্বাসকে অগ্রাধিকার" detail="Seller profile, product details, rating এবং order status—প্রয়োজনীয় তথ্য decision নেওয়ার আগে দেখতে পারবেন।" /><InfoCard icon={LockKeyhole} title="Digital delivery নিরাপদ" detail="Automatic delivery-র sensitive information encrypted অবস্থায় থাকে। Delivery দরকার হলে system তা নির্দিষ্ট buyer-এর কাছে দেয়।" /><InfoCard icon={Users} title="দুই পক্ষের marketplace" detail="আমরা শুধু buyer-এর জন্য নয়—seller-এর listing, draft, delivery এবং earnings flow-ও সহজ করার জন্য তৈরি।" /></div>
    <section className="rounded-2xl border border-outline bg-white p-5 sm:p-7"><h2 className="text-xl font-black text-ink-900">আমাদের কাজের নীতি</h2><div className="mt-5 grid gap-4 sm:grid-cols-2"><Principle title="স্বচ্ছতা" detail="Price, seller identity, delivery mode ও order status যতটা সম্ভব পরিষ্কার রাখা।" /><Principle title="নিরাপত্তা" detail="Account, payment এবং digital delivery তথ্যকে দায়িত্বশীলভাবে সুরক্ষিত রাখা।" /><Principle title="সহায়তা" detail="সমস্যা হলে buyer ও seller—দুই পক্ষের কথা শোনার ব্যবস্থা রাখা।" /><Principle title="দায়িত্বশীল growth" detail="Marketplace বড় করার পাশাপাশি quality, trust ও user experience-কে গুরুত্ব দেওয়া।" /></div></section>
    <section className="flex flex-col gap-4 rounded-2xl border border-brand-100 bg-brand-50 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-7"><div><h2 className="font-black text-ink-900">BikriKoro marketplace দেখুন</h2><p className="mt-1 text-sm text-ink-600">আপনার পরের digital product খুঁজে নিন অথবা seller হিসেবে শুরু করুন।</p></div><Link to="/app" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-3 text-sm font-extrabold text-white hover:bg-brand-700">Marketplace খুলুন <ChevronRight size={16} /></Link></section>
  </div>
}

function HelpFallback() {
  const topics = [{ icon: Package, title: 'অর্ডার ও delivery', detail: 'Order status, automatic delivery, manual delivery বা product না পাওয়া নিয়ে সাহায্য।' }, { icon: WalletCards, title: 'Payment ও refund', detail: 'Payment pending, confirmation, refund বা wallet সংক্রান্ত প্রশ্ন।' }, { icon: LockKeyhole, title: 'Account ও security', detail: 'Login, profile, seller verification ও account নিরাপত্তা।' }, { icon: CircleHelp, title: 'Report ও complaint', detail: 'কোনো listing, seller বা order নিয়ে সমস্যা হলে কী করবেন।' }]
  return <div className="space-y-5"><section className="rounded-3xl bg-brand-600 p-6 text-white shadow-lg sm:p-9"><div className="flex items-start gap-4"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/15"><Headphones size={24} /></span><div><p className="text-sm font-bold text-brand-100">BikriKoro Help Center</p><h2 className="mt-1 text-3xl font-black leading-tight sm:text-4xl">যে কোনো সমস্যায় আমরা পাশে আছি।</h2><p className="mt-3 max-w-2xl text-sm leading-7 text-white/80">প্রথমে নিচের guide দেখুন। উত্তর না পেলে account থেকে সরাসরি Support Case খুলে আমাদের team-এর সাথে কথা বলুন।</p></div></div></section><div className="grid gap-3 sm:grid-cols-2">{topics.map(({ icon: Icon, title, detail }) => <div key={title} className="flex gap-3 rounded-2xl border border-outline bg-white p-4"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600"><Icon size={20} /></span><div><h2 className="font-extrabold text-ink-900">{title}</h2><p className="mt-1 text-sm leading-6 text-ink-600">{detail}</p></div></div>)}</div><section className="rounded-2xl border border-outline bg-white p-5 sm:p-7"><h2 className="text-xl font-black text-ink-900">দ্রুত সমাধানের guide</h2><div className="mt-5 space-y-4"><GuideStep number="01" title="Order page দেখুন" detail="My Orders থেকে order status, payment status এবং delivery information যাচাই করুন।" /><GuideStep number="02" title="Evidence রাখুন" detail="Problem হলে screenshot, order number ও relevant conversation সংরক্ষণ করুন।" /><GuideStep number="03" title="Support Case খুলুন" detail="Account-এর Chat → Support থেকে বিষয় বেছে case তৈরি করে message ও attachment পাঠান।" /></div></section><div className="flex flex-col gap-3 rounded-2xl border border-brand-100 bg-brand-50 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-7"><div><h2 className="font-black text-ink-900">সরাসরি Support Case খুলবেন?</h2><p className="mt-1 text-sm text-ink-600">Login করে আপনার order বা সমস্যার context-সহ support team-কে জানান।</p></div><Link to="/chat/support" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-3 text-sm font-extrabold text-white hover:bg-brand-700">Support Chat খুলুন <MessageCircle size={16} /></Link></div></div>
}

function InfoCard({ icon: Icon, title, detail }: { icon: typeof ShieldCheck; title: string; detail: string }) { return <article className="rounded-2xl border border-outline bg-white p-5 shadow-sm"><span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-100 text-brand-700"><Icon size={20} /></span><h2 className="mt-4 font-black text-ink-900">{title}</h2><p className="mt-2 text-sm leading-7 text-ink-600">{detail}</p></article> }
function Principle({ title, detail }: { title: string; detail: string }) { return <div className="border-l-2 border-brand-300 pl-4"><h3 className="font-extrabold text-ink-900">{title}</h3><p className="mt-1 text-sm leading-6 text-ink-600">{detail}</p></div> }
function GuideStep({ number, title, detail }: { number: string; title: string; detail: string }) { return <div className="flex gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-100 text-xs font-black text-brand-700">{number}</span><div><h3 className="font-extrabold text-ink-900">{title}</h3><p className="mt-1 text-sm leading-6 text-ink-600">{detail}</p></div></div> }
