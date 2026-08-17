import { Helmet } from 'react-helmet-async'
import { Layout } from '@/components/Layout'

export default function PrivacyPolicy() {
  return (
    <Layout>
      <Helmet>
        <title>প্রাইভেসি পলিসি — BikriKoro.Com</title>
        <meta name="description" content="BikriKoro.Com-এ আপনার তথ্য কীভাবে সংগ্রহ ও ব্যবহার করা হয়।" />
      </Helmet>
      <h1 className="text-xl font-semibold text-ink-900">প্রাইভেসি পলিসি</h1>
      <div className="mt-5 space-y-5 text-sm leading-relaxed text-ink-600">
        <p>
          এই পেজে আমরা ব্যাখ্যা করি BikriKoro.Com ব্যবহারের সময় কোন তথ্য সংগ্রহ করা হয়, কীভাবে সংরক্ষণ করা হয়, এবং কার সাথে
          শেয়ার করা হয়।
        </p>
        <section>
          <h2 className="font-semibold text-ink-900">আমরা যে তথ্য সংগ্রহ করি</h2>
          <ul className="mt-1.5 list-disc space-y-1 pl-4">
            <li>অ্যাকাউন্ট তথ্য — নাম, ফোন নম্বর বা ইমেইল, প্রোফাইল ছবি।</li>
            <li>পণ্য ও অর্ডার তথ্য — আপনার পোস্ট করা লিস্টিং, অর্ডার, ডেলিভারি ঠিকানা।</li>
            <li>বিক্রেতা ভেরিফিকেশনের জন্য NID/ট্রেড লাইসেন্স নম্বর ও ছবি (শুধু যাচাইয়ের জন্য, প্রকাশ করা হয় না)।</li>
            <li>চ্যাট মেসেজ ও রিভিউ, যা লেনদেন সংক্রান্ত বিরোধ সমাধানে ব্যবহৃত হতে পারে।</li>
          </ul>
        </section>
        <section>
          <h2 className="font-semibold text-ink-900">তথ্য কীভাবে ব্যবহার করা হয়</h2>
          <p className="mt-1.5">
            অর্ডার প্রসেস করা, এসক্রো পেমেন্ট সুরক্ষিত রাখা, বিক্রেতা যাচাই করা, প্রতারণা প্রতিরোধ করা এবং সেবা উন্নত করার
            জন্য এই তথ্য ব্যবহার করা হয়। পেমেন্ট প্রসেসিংয়ের জন্য UddoktaPay-এর সাথে প্রয়োজনীয় তথ্য শেয়ার করা হয়।
          </p>
        </section>
        <section>
          <h2 className="font-semibold text-ink-900">তথ্য সংরক্ষণ</h2>
          <p className="mt-1.5">
            আপনার তথ্য নিরাপদ সার্ভারে সংরক্ষণ করা হয় এবং শুধুমাত্র সেবা প্রদানের জন্য প্রয়োজনীয় সময় পর্যন্ত রাখা হয়। বিক্রেতা
            ভেরিফিকেশন ডকুমেন্ট প্রাইভেট স্টোরেজে রাখা হয়, পাবলিকলি দেখা যায় না।
          </p>
        </section>
        <section>
          <h2 className="font-semibold text-ink-900">আপনার অধিকার</h2>
          <p className="mt-1.5">
            আপনি যেকোনো সময় আপনার অ্যাকাউন্ট তথ্য দেখতে, আপডেট করতে বা মুছে ফেলার অনুরোধ করতে পারেন। যোগাযোগ করুন আমাদের{' '}
            <a href="/contact" className="text-brand-600 hover:underline">
              যোগাযোগ পেজ
            </a>{' '}
            থেকে।
          </p>
        </section>
        <p className="text-xs text-ink-300">সর্বশেষ হালনাগাদ: আগস্ট, ২০২৬</p>
      </div>
    </Layout>
  )
}
