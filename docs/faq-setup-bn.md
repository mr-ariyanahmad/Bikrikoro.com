# BikriKoro FAQ Setup

## Public FAQ

BikriKoro-এর `/faq` page এখন Supabase থেকে published FAQ rows পড়ে। প্রতিটি প্রশ্ন একটি clean accordion row হিসেবে দেখা যায়। ডান পাশে `+` icon চাপলে উত্তর খুলবে এবং `−` icon চাপলে বন্ধ হবে। প্রশ্নের title, summary এবং answer frontend-এ hardcode করা নেই। FAQ page-এ search field আছে, তাই buyer বা seller প্রশ্নের শব্দ লিখে দ্রুত খুঁজতে পারবেন। Button semantics, `aria-expanded`, `aria-controls`, focusable controls এবং keyboard activation ব্যবহার করা হয়েছে।

## FAQ content

`036_faq_content.sql` migration-এ account, login, password recovery, Google login, product purchase, payment, escrow, order status, preparation, shipment, delivery, received confirmation, not received report, dispute, rating, cancellation, digital delivery, seller onboarding, digital verification, product approval, seller approval history, seller chat, notifications, wallet/rewards, delivery badges, YouTube product video, product report, privacy এবং support—এই বিষয়গুলোর উপর Bengali FAQ seed করা আছে।

## Admin control

Admin panel-এর **কনটেন্ট → FAQ প্রশ্ন** route হলো `/admin/faq`। Permission key হলো `content.faq`। এখান থেকে নতুন প্রশ্ন তৈরি, title/slug/summary/answer সম্পাদনা, display order পরিবর্তন, draft publish, published FAQ unpublish এবং archive করা যাবে। Display order ছোট হলে প্রশ্নটি আগে দেখাবে। প্রতিটি পরিবর্তন existing admin RPC ও permission guard-এর মাধ্যমে হবে।

## Production migration

আগের migrations-এর পরে Supabase SQL Editor-এ চালাতে হবে:

```text
036_faq_content.sql
```

এই migration `admin_content.sort_order` যোগ করে, FAQ-এর জন্য publication query order করে এবং FAQ-সহ নতুন `admin_upsert_content` RPC প্রকাশ করে। Migration না চালানো পর্যন্ত নতুন seeded questions বা display order live database-এ আসবে না।

## Test checklist

Migration চালানোর পরে `/faq` খুলে অন্তত তিনটি প্রশ্ন expand করে দেখবেন, একটি search keyword দিয়ে filter করবেন এবং keyboard দিয়ে question button খুলবেন। Admin panel থেকে একটি FAQ edit করে order বদলে publish করুন এবং public page refresh করে পরিবর্তনটি যাচাই করুন। একটি FAQ draft তৈরি করে publish/unpublish/archive path-ও পরীক্ষা করবেন।
