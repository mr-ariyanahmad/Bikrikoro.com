import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Layout } from '@/components/Layout'

const STEPS = [
  {
    title: 'পণ্যের ছবি ও বিবরণ দিন',
    body: 'স্পষ্ট ছবি আর সৎ বিবরণ থাকলে ক্রেতার আস্থা বাড়ে এবং দ্রুত বিক্রি হয়।',
  },
  {
    title: 'ক্রেতা অর্ডার করলে টাকা এসক্রোতে জমা হয়',
    body: 'ক্রেতার টাকা সাথে সাথে আপনাকে দেওয়া হয় না — BikriKoro নিরাপদে রাখে।',
  },
  {
    title: 'পণ্য পাঠান',
    body: 'অ্যাপ থেকে অর্ডার "শিপড" মার্ক করুন যাতে ক্রেতা জানতে পারে।',
  },
  {
    title: 'ক্রেতা নিশ্চিত করলে টাকা আপনার ওয়ালেটে যায়',
    body: 'ক্রেতা পণ্য ঠিকঠাক পেলে নিশ্চিত করার সাথে সাথে বিক্রির টাকা আপনার ওয়ালেটে যোগ হয়ে যায়, উত্তোলন করতে পারবেন এখান থেকেই।',
  },
]

export default function BecomeSeller() {
  const { user } = useAuth()

  return (
    <Layout>
      <section className="rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 p-6 text-white sm:p-8">
        <p className="text-sm font-medium text-brand-50/80">বিক্রেতা হোন</p>
        <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">BikriKoro-তে বিক্রি শুরু করুন</h1>
        <p className="mt-2 max-w-md text-sm text-brand-50/90">
          কোনো রেজিস্ট্রেশন ফি নেই — যেকোনো ব্যবহারকারী সরাসরি পণ্য পোস্ট করতে পারেন। এসক্রো সিস্টেম আপনার আর ক্রেতার
          দুজনকেই সুরক্ষা দেয়।
        </p>
        <Link
          to={user ? '/sell' : '/login'}
          className="mt-4 inline-block rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-brand-700 transition hover:bg-brand-50"
        >
          {user ? 'এখনই পণ্য পোস্ট করুন' : 'লগইন করে শুরু করুন'}
        </Link>
        {user && (
          <Link
            to="/become-seller/verify"
            className="mt-4 ml-3 inline-block rounded-xl border border-white/40 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            ভেরিফাইড সেলার হতে আবেদন করুন
          </Link>
        )}
      </section>

      <div className="mt-8 space-y-5">
        {STEPS.map((step, i) => (
          <div key={step.title} className="flex gap-4">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
              {i + 1}
            </div>
            <div>
              <p className="font-medium text-ink-900">{step.title}</p>
              <p className="mt-0.5 text-sm text-ink-600">{step.body}</p>
            </div>
          </div>
        ))}
      </div>
    </Layout>
  )
}
