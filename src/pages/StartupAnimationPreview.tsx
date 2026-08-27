import { ArrowLeft, CheckCircle2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { Layout } from '@/components/Layout'
import { ConnectedGearAnimation } from '@/components/ConnectedGearAnimation'

export default function StartupAnimationPreview() {
  return (
    <Layout wide>
      <Helmet><title>লোডিং অ্যানিমেশন প্রিভিউ | BikriKoro.Com</title></Helmet>
      <main className="mx-auto flex min-h-[70vh] w-full max-w-lg items-center justify-center py-10">
        <section className="w-full rounded-2xl border border-outline bg-surface p-7 text-center shadow-sm">
          <div className="mx-auto w-fit"><ConnectedGearAnimation label="সংযুক্ত সেটিংস গিয়ার অ্যানিমেশন" /></div>
          <p className="mt-5 text-xs font-bold uppercase tracking-[0.16em] text-brand-700">লোডিং অ্যানিমেশন প্রিভিউ</p>
          <h1 className="mt-2 text-2xl font-bold text-ink-900">সংযুক্ত ৩টি সেটিংস গিয়ার</h1>
          <p className="mt-3 text-sm leading-6 text-ink-600">কোনো পেজ সাময়িকভাবে প্রস্তুত হওয়ার সময় এই গিয়ার তিনটি একসাথে ঘুরবে। এটি warning icon নয় এবং কোনো error তৈরি করে না।</p>
          <div className="mt-6 rounded-xl bg-brand-50 px-4 py-3 text-left text-sm text-brand-800"><p className="flex items-center gap-2 font-semibold"><CheckCircle2 size={17} />এটি শুধু animation দেখতে নিরাপদ preview page।</p></div>
          <Link to="/" className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl border border-outline px-4 py-3 text-sm font-bold text-ink-700 hover:border-brand-500 hover:text-brand-700"><ArrowLeft size={16} />হোমে ফিরুন</Link>
        </section>
      </main>
    </Layout>
  )
}
