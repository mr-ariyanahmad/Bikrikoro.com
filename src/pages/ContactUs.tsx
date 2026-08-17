import { Helmet } from 'react-helmet-async'
import { Layout } from '@/components/Layout'

// TODO: replace the placeholder email/phone below with BikriKoro's real
// support contact details before launch.
const SUPPORT_EMAIL = 'support@bikrikoro.com'
const SUPPORT_PHONE = '+880 1XXX-XXXXXX'

export default function ContactUs() {
  return (
    <Layout>
      <Helmet>
        <title>যোগাযোগ — BikriKoro.Com</title>
        <meta name="description" content="BikriKoro.Com টিমের সাথে যোগাযোগ করুন।" />
      </Helmet>
      <h1 className="text-xl font-semibold text-ink-900">যোগাযোগ করুন</h1>
      <p className="mt-2 text-sm text-ink-600">
        কোনো প্রশ্ন, অভিযোগ বা সহায়তা প্রয়োজন হলে নিচের মাধ্যমে যোগাযোগ করুন।
      </p>
      <div className="mt-5 space-y-3 rounded-2xl border border-outline bg-surface p-5 text-sm">
        <div className="flex justify-between">
          <span className="text-ink-600">ইমেইল</span>
          <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium text-brand-600 hover:underline">
            {SUPPORT_EMAIL}
          </a>
        </div>
        <div className="flex justify-between">
          <span className="text-ink-600">ফোন</span>
          <span className="font-medium text-ink-900">{SUPPORT_PHONE}</span>
        </div>
      </div>
      <p className="mt-4 text-xs text-ink-300">
        অর্ডার সংক্রান্ত কোনো সমস্যায় "আমার অর্ডার" পেজ থেকে সরাসরি অভিযোগ জানানো দ্রুততর।
      </p>
    </Layout>
  )
}
