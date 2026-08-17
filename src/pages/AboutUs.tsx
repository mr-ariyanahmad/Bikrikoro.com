import { Helmet } from 'react-helmet-async'
import { Layout } from '@/components/Layout'

export default function AboutUs() {
  return (
    <Layout>
      <Helmet>
        <title>আমাদের সম্পর্কে — BikriKoro.Com</title>
        <meta name="description" content="BikriKoro.Com একটি এসক্রো-সুরক্ষিত মার্কেটপ্লেস।" />
      </Helmet>
      <h1 className="text-xl font-semibold text-ink-900">আমাদের সম্পর্কে</h1>
      <div className="mt-5 space-y-4 text-sm leading-relaxed text-ink-600">
        <p>
          BikriKoro.Com একটি অনলাইন মার্কেটপ্লেস, যেখানে যে কেউ সহজে পণ্য কিনতে ও বিক্রি করতে পারেন। আমাদের লক্ষ্য হলো
          ক্রেতা ও বিক্রেতা উভয়ের জন্য একটি নিরাপদ, স্বচ্ছ কেনাকাটার অভিজ্ঞতা তৈরি করা।
        </p>
        <section>
          <h2 className="font-semibold text-ink-900">এসক্রো সুরক্ষা</h2>
          <p className="mt-1.5">
            প্রতিটি অর্ডারের টাকা এসক্রোতে সুরক্ষিত থাকে — ক্রেতা পণ্য হাতে পাওয়া নিশ্চিত না করা পর্যন্ত বিক্রেতাকে
            টাকা দেওয়া হয় না। এতে করে উভয় পক্ষই নিরাপদ থাকেন।
          </p>
        </section>
        <section>
          <h2 className="font-semibold text-ink-900">যাচাইকৃত বিক্রেতা</h2>
          <p className="mt-1.5">
            যেকোনো ব্যবহারকারী বিনামূল্যে পণ্য পোস্ট করতে পারেন। এছাড়াও ঐচ্ছিকভাবে NID বা ট্রেড লাইসেন্স দিয়ে যাচাইকৃত
            বিক্রেতা হওয়া যায়, যা ক্রেতাদের বাড়তি আস্থা দেয়।
          </p>
        </section>
      </div>
    </Layout>
  )
}
