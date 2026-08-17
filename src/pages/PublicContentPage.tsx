import { useEffect, useState } from 'react'
import { BookOpen, ChevronRight, CircleHelp, FileText, Mail, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { supabase } from '@/lib/supabase'
import { Layout } from '@/components/Layout'
import { AIAssistant } from '@/components/AIAssistant'

type ContentType = 'ABOUT' | 'PRIVACY' | 'CONTACT' | 'HELP' | 'FAQ' | 'USER_EDU' | 'SELLER_EDU' | 'RETURN_POLICY' | 'TERMS'
type ContentRow = { id: string; title: string; excerpt: string; body: string; updated_at: string }

const COPY: Record<ContentType, { title: string; subtitle: string; icon: typeof BookOpen; fallback: string }> = {
  ABOUT: { title: 'আমাদের সম্পর্কে', subtitle: 'BikriKoro.Com-এর উদ্দেশ্য ও নিরাপদ marketplace নীতি।', icon: ShieldCheck, fallback: 'BikriKoro.Com বাংলাদেশি ক্রেতা ও বিক্রেতার জন্য নিরাপদ, স্বচ্ছ এবং সহজ অনলাইন কেনাবেচার অভিজ্ঞতা তৈরি করতে কাজ করে।' },
  PRIVACY: { title: 'প্রাইভেসি পলিসি', subtitle: 'আপনার তথ্য কীভাবে ব্যবহৃত ও সুরক্ষিত হয়।', icon: ShieldCheck, fallback: 'অ্যাকাউন্ট, অর্ডার, চ্যাট এবং verification তথ্য শুধু marketplace সেবা, নিরাপত্তা ও support দেওয়ার প্রয়োজনে ব্যবহার করা হয়।' },
  CONTACT: { title: 'যোগাযোগ ও সাপোর্ট', subtitle: 'অর্ডার, account বা seller সমস্যায় আমাদের জানান।', icon: Mail, fallback: 'অর্ডার সংক্রান্ত সমস্যায় আগে Orders থেকে dispute/report পাঠান। সাধারণ সহায়তার জন্য support team-কে আপনার account email ও order ID-সহ যোগাযোগ করুন।' },
  HELP: { title: 'Help Center', subtitle: 'কেনাকাটা, বিক্রি, payment, delivery ও account নিয়ে দ্রুত উত্তর।', icon: CircleHelp, fallback: 'প্রশ্নের উত্তর খুঁজতে FAQ দেখুন। অর্ডার সমস্যা হলে Order Detail থেকে report বা dispute খুলুন। Seller হলে Seller Education Hub দেখুন।' },
  FAQ: { title: 'সাধারণ প্রশ্নের উত্তর', subtitle: 'BikriKoro ব্যবহারের গুরুত্বপূর্ণ প্রশ্নগুলো এক জায়গায়।', icon: CircleHelp, fallback: 'পেমেন্ট escrow-তে সুরক্ষিত থাকে, order status Orders পেজে দেখা যায়, এবং কোনো সমস্যা হলে order detail থেকে dispute খোলা যায়।' },
  USER_EDU: { title: 'User Education Hub', subtitle: 'নিরাপদে কেনাকাটা ও account ব্যবহারের গাইড।', icon: BookOpen, fallback: 'Seller profile, product badges, review এবং dispute status দেখে সিদ্ধান্ত নিন। OTP, password বা payment তথ্য কাউকে message-এ দেবেন না।' },
  SELLER_EDU: { title: 'Seller Education Hub', subtitle: 'ভালো listing, দ্রুত delivery ও বিশ্বস্ত seller profile তৈরির গাইড।', icon: BookOpen, fallback: 'সঠিক title, পরিষ্কার প্রথম ছবি, বাস্তব price, delivery option এবং বিস্তারিত description ব্যবহার করুন। Order শিপ করার আগে stock ও address যাচাই করুন।' },
  RETURN_POLICY: { title: 'Return ও Refund Policy', subtitle: 'পণ্য না মিললে কীভাবে সহায়তা পাবেন।', icon: FileText, fallback: 'পণ্য বিবরণের সঙ্গে না মিললে বা না পেলে Order Detail থেকে dispute/report খুলুন এবং ছবি বা প্রমাণ সংযুক্ত করুন। Support review শেষে resolution জানাবে।' },
  TERMS: { title: 'ব্যবহারের শর্ত', subtitle: 'BikriKoro ব্যবহার করার আগে গুরুত্বপূর্ণ নিয়মগুলো জানুন।', icon: FileText, fallback: 'ভুল তথ্য, নিষিদ্ধ পণ্য, প্রতারণা বা অন্যের account ব্যবহার করা যাবে না। Marketplace-এ লেনদেনের সময় সব তথ্য সঠিক রাখা বাধ্যতামূলক।' },
}

export default function PublicContentPage({ type }: { type: ContentType }) {
  const meta = COPY[type]
  const [rows, setRows] = useState<ContentRow[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => { supabase.rpc('get_published_content', { p_content_type: type, p_slug: null }).then(({ data }) => { setRows((data ?? []) as ContentRow[]); setLoading(false) }) }, [type])
  const Icon = meta.icon
  return <Layout wide><Helmet><title>{meta.title} — BikriKoro.Com</title><meta name="description" content={meta.subtitle} /></Helmet><div className="mx-auto max-w-4xl"><div className="flex flex-wrap items-start justify-between gap-4 rounded-3xl bg-brand-50 p-5 sm:p-7"><div><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-500 text-white"><Icon size={22} /></div><h1 className="mt-4 text-2xl font-bold text-ink-900">{meta.title}</h1><p className="mt-1 text-sm text-ink-600">{meta.subtitle}</p></div><Link to="/settings" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700">Settings-এ যান <ChevronRight size={16} /></Link></div><div className="mt-6 space-y-5">{loading ? <div className="h-48 animate-pulse rounded-2xl bg-outline/40" /> : rows.length > 0 ? rows.map((row) => <article key={row.id} className="rounded-2xl border border-outline bg-surface p-5 sm:p-7"><h2 className="text-lg font-bold text-ink-900">{row.title}</h2>{row.excerpt && <p className="mt-1 text-sm text-ink-500">{row.excerpt}</p>}<div className="mt-4 whitespace-pre-line text-sm leading-7 text-ink-700">{row.body}</div><p className="mt-5 text-xs text-ink-300">সর্বশেষ আপডেট: {new Date(row.updated_at).toLocaleDateString('bn-BD')}</p></article>) : <article className="rounded-2xl border border-outline bg-surface p-5 sm:p-7"><p className="whitespace-pre-line text-sm leading-7 text-ink-700">{meta.fallback}</p><p className="mt-5 text-xs text-ink-400">Admin panel-এর পাবলিক পেজ editor থেকে এই লেখা পরিবর্তন করা যাবে।</p></article>}{(type === 'HELP' || type === 'FAQ') && <AIAssistant />}</div></div></Layout>
}
