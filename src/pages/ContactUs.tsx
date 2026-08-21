import { useEffect, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import { Layout } from '@/components/Layout'
import { loadPublicSettings } from '@/lib/publicSettings'

type SupportContacts = { email: string; phone: string }

export default function ContactUs() {
  const [contacts, setContacts] = useState<SupportContacts>({ email: '', phone: '' })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    loadPublicSettings().then((settings) => {
      if (!active) return
      setContacts({
        email: typeof settings.public_support_email === 'string' ? settings.public_support_email.trim() : '',
        phone: typeof settings.public_support_phone === 'string' ? settings.public_support_phone.trim() : '',
      })
      setLoading(false)
    })
    return () => { active = false }
  }, [])

  return (
    <Layout>
      <Helmet>
        <title>যোগাযোগ — BikriKoro.Com</title>
        <meta name="description" content="BikriKoro.Com টিমের সাথে যোগাযোগ করুন।" />
      </Helmet>
      <h1 className="text-xl font-semibold text-ink-900">যোগাযোগ করুন</h1>
      <p className="mt-2 text-sm text-ink-600">
        কোনো প্রশ্ন, অভিযোগ বা সহায়তা প্রয়োজন হলে আগে সহায়তা কেন্দ্র বা সংশ্লিষ্ট অর্ডারের বিস্তারিত সহায়তার পথ ব্যবহার করুন।
      </p>
      {loading ? <div className="mt-5 h-24 animate-pulse rounded-2xl bg-outline/40" /> : contacts.email || contacts.phone ? <div className="mt-5 space-y-3 rounded-2xl border border-outline bg-surface p-5 text-sm">
        {contacts.email && <div className="flex justify-between gap-4"><span className="text-ink-600">ইমেইল</span><a href={`mailto:${contacts.email}`} className="break-all text-right font-medium text-brand-600 hover:underline">{contacts.email}</a></div>}
        {contacts.phone && <div className="flex justify-between gap-4"><span className="text-ink-600">ফোন</span><a href={`tel:${contacts.phone.replace(/\s+/g, '')}`} className="font-medium text-brand-600 hover:underline">{contacts.phone}</a></div>}
      </div> : <div className="mt-5 rounded-2xl border border-brand-100 bg-brand-50 p-5 text-sm leading-6 text-ink-700">অ্যাডমিন এখনো কোনো প্রকাশ্য সহায়তার যোগাযোগ প্রকাশ করেননি। অর্ডার-সংক্রান্ত সমস্যা হলে <Link to="/orders" className="font-semibold text-brand-700 hover:underline">আমার অর্ডার</Link> থেকে report বা dispute খুলুন; সাধারণ প্রশ্নে <Link to="/help" className="font-semibold text-brand-700 hover:underline">সহায়তা কেন্দ্র</Link> ব্যবহার করুন।</div>}
      <p className="mt-4 text-xs text-ink-400">সহায়তার বার্তায় সম্ভব হলে অ্যাকাউন্টের ইমেইল, অর্ডার নম্বর এবং সমস্যার সংক্ষিপ্ত বিবরণ দিন। OTP, পাসওয়ার্ড, পেমেন্ট PIN বা API key কখনো পাঠাবেন না।</p>
    </Layout>
  )
}
