import { useEffect, useState } from 'react'
import { BookOpen, ChevronRight, CircleHelp, FileText, Mail, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { supabase } from '@/lib/supabase'
import { SITE_URL } from '@/lib/site'
import { Layout } from '@/components/Layout'
import { AIAssistant } from '@/components/AIAssistant'
import { FaqAccordion } from '@/components/FaqAccordion'

type ContentType = 'ABOUT' | 'PRIVACY' | 'CONTACT' | 'HELP' | 'FAQ' | 'USER_EDU' | 'SELLER_EDU' | 'RETURN_POLICY' | 'TERMS'
type ContentRow = { id: string; title: string; slug: string; excerpt: string; body: string; cover_image_url: string | null; seo_title: string | null; seo_description: string | null; sort_order?: number; updated_at: string }
type PageMeta = { title: string; subtitle: string; icon: typeof BookOpen }

const COPY: Record<ContentType, PageMeta> = {
  ABOUT: { title: 'আমাদের সম্পর্কে', subtitle: 'BikriKoro.Com-এর উদ্দেশ্য ও নিরাপদ marketplace নীতি।', icon: ShieldCheck },
  PRIVACY: { title: 'প্রাইভেসি পলিসি', subtitle: 'আপনার তথ্য কীভাবে ব্যবহৃত ও সুরক্ষিত হয়।', icon: ShieldCheck },
  CONTACT: { title: 'যোগাযোগ ও সাপোর্ট', subtitle: 'অর্ডার, account বা seller সমস্যায় আমাদের জানান।', icon: Mail },
  HELP: { title: 'Help Center', subtitle: 'কেনাকাটা, বিক্রি, payment, delivery ও account নিয়ে দ্রুত উত্তর।', icon: CircleHelp },
  FAQ: { title: 'সাধারণ প্রশ্নের উত্তর', subtitle: 'BikriKoro ব্যবহারের গুরুত্বপূর্ণ প্রশ্নগুলো এক জায়গায়।', icon: CircleHelp },
  USER_EDU: { title: 'User Education Hub', subtitle: 'নিরাপদে কেনাকাটা ও account ব্যবহারের গাইড।', icon: BookOpen },
  SELLER_EDU: { title: 'Seller Education Hub', subtitle: 'ভালো listing, দ্রুত delivery ও বিশ্বস্ত seller profile তৈরির গাইড।', icon: BookOpen },
  RETURN_POLICY: { title: 'Return ও Refund Policy', subtitle: 'পণ্য না মিললে কীভাবে সহায়তা পাবেন।', icon: FileText },
  TERMS: { title: 'ব্যবহারের শর্ত', subtitle: 'BikriKoro ব্যবহার করার আগে গুরুত্বপূর্ণ নিয়মগুলো জানুন।', icon: FileText },
}

export default function PublicContentPage({ type }: { type: ContentType }) {
  const meta = COPY[type]
  const [rows, setRows] = useState<ContentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    setRows([])
    setError(null)
    const load = async () => {
      try {
        const { data, error: loadError } = await supabase.rpc('get_published_content', { p_content_type: type, p_slug: null })
        if (loadError) throw loadError
        if (!active) return
        setRows((data ?? []) as ContentRow[])
      } catch (loadError) {
        console.error('Public content load failed:', loadError)
        if (active) setError(loadError instanceof Error ? loadError.message : 'Content লোড করা যায়নি।')
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => { active = false }
  }, [type])

  const Icon = meta.icon
  const primaryRow = rows[0]
  const pageTitle = primaryRow?.seo_title || primaryRow?.title || meta.title
  const pageDescription = primaryRow?.seo_description || primaryRow?.excerpt || meta.subtitle
  const pagePathMap: Record<ContentType, string> = { ABOUT: 'about', PRIVACY: 'privacy', CONTACT: 'contact', HELP: 'help', FAQ: 'faq', USER_EDU: 'user-education', SELLER_EDU: 'seller-education', RETURN_POLICY: 'return-policy', TERMS: 'terms' }
  const pagePath = pagePathMap[type]

  return <Layout wide>
    <Helmet>
      <title>{pageTitle} — BikriKoro.Com</title>
      <meta name="description" content={pageDescription} />
      {primaryRow?.cover_image_url && <meta property="og:image" content={primaryRow.cover_image_url} />}
      <link rel="canonical" href={`${SITE_URL}/${pagePath}`} />
    </Helmet>
    <div className="mx-auto max-w-4xl">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-outline pb-5">
        <div>
          <div className="flex h-11 w-11 items-center justify-center bg-brand-500 text-white"><Icon size={22} /></div>
          <h1 className="mt-4 text-2xl font-bold text-ink-900">{primaryRow?.title || meta.title}</h1>
          <p className="mt-1 text-sm text-ink-600">{primaryRow?.excerpt || meta.subtitle}</p>
        </div>
        <Link to="/settings" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700">Settings-এ যান <ChevronRight size={16} /></Link>
      </div>
      <div className="mt-6 space-y-5">
        {error ? <article className="border border-error/20 bg-error/5 p-5 sm:p-7"><p className="text-sm leading-7 text-error">এই পেজের content লোড করা যায়নি: {error}</p></article> : loading ? <div className="h-48 animate-pulse bg-outline/40" /> : rows.length > 0 ? type === 'FAQ' ? <FaqAccordion items={rows} /> : rows.map((row) => <article key={row.id} className="border border-outline bg-surface p-5 sm:p-7">
          {row.cover_image_url && <img src={row.cover_image_url} alt="" className="mb-5 aspect-[16/7] w-full object-cover" />}
          <h2 className="text-lg font-bold text-ink-900">{row.title}</h2>
          {row.excerpt && <p className="mt-1 text-sm text-ink-500">{row.excerpt}</p>}
          <div className="mt-4 whitespace-pre-line text-sm leading-7 text-ink-700">{row.body}</div>
          <p className="mt-5 text-xs text-ink-300">সর্বশেষ আপডেট: {new Date(row.updated_at).toLocaleDateString('bn-BD')}</p>
        </article>) : <article className="border border-outline bg-surface p-5 sm:p-7"><p className="text-sm leading-7 text-ink-600">এই পেজের content এখনো admin panel-এ প্রকাশ করা হয়নি।</p></article>}
        {(type === 'HELP' || type === 'FAQ') && <AIAssistant />}
      </div>
    </div>
  </Layout>
}
