import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import { Layout } from '@/components/Layout'

export default function NotFound() {
  return <Layout wide>
    <Helmet>
      <title>পেজটি পাওয়া যায়নি — BikriKoro</title>
      <meta name="description" content="এই BikriKoro পেজটি পাওয়া যায়নি। হোমপেজ বা ডিজিটাল পণ্য ক্যাটালগে ফিরে যান।" />
      <meta name="robots" content="noindex,follow" />
    </Helmet>
    <main className="mx-auto flex min-h-[55vh] max-w-xl flex-col items-center justify-center px-5 py-16 text-center">
      <p className="text-sm font-bold uppercase tracking-[0.2em] text-brand-600">404</p>
      <h1 className="mt-3 text-3xl font-extrabold text-ink-900">পেজটি পাওয়া যায়নি</h1>
      <p className="mt-3 max-w-md text-sm leading-7 text-ink-600">লিংকটি হয়তো বদলে গেছে অথবা পেজটি আর প্রকাশিত নেই। BikriKoro-এর official marketplace থেকে আবার শুরু করুন।</p>
      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <Link to="/" className="rounded-xl bg-brand-600 px-5 py-3 text-sm font-bold text-white">হোমপেজে যান</Link>
        <Link to="/products" className="rounded-xl border border-brand-200 bg-brand-50 px-5 py-3 text-sm font-bold text-brand-700">পণ্য দেখুন</Link>
      </div>
    </main>
  </Layout>
}
