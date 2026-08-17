# Seller Verification ও Admin Permission Handover

## Seller entry flow

নতুন seller `/sell` খুললে আগে দুইটি option দেখতে পায়: **ডিজিটাল** অথবা **ফিজিক্যাল**। ফিজিক্যাল নির্বাচন করলে আগের listing form চালু হয়। ডিজিটাল নির্বাচন করলে `/become-seller/verify?mode=DIGITAL`-এ নিয়ে যাওয়া হয়; verification application approve না হওয়া পর্যন্ত frontend এবং server-side product save guard digital listing publish করতে দেয় না। Existing listing edit route অক্ষুণ্ণ আছে।

## Verification identity

Seller প্রথমে listing mode, তারপর **পারসোনাল**, **ব্যবসায়িক**, অথবা **কোম্পানি** identity নির্বাচন করে। Sector হিসেবে Software/SaaS, Education/Course, Creative/Media, Retail/Reseller, Professional Services বা Other বেছে নিতে পারে। এই selection-এর উপর document checklist তৈরি হয়।

Personal digital seller-এর জন্য NID front/back, NID হাতে selfie এবং digital product ownership proof রাখা হয়েছে। Business seller-এর জন্য representative identity, Trade License, e-TIN এবং ownership proof রাখা হয়েছে। Company seller-এর জন্য representative NID, Trade License, e-TIN, BIN/VAT, incorporation/registration certificate, authorization letter এবং ownership proof রাখা হয়েছে। Checklist `seller_document_requirements` table-এ রাখা হয়েছে, তাই admin পরবর্তী সময়ে sector-specific requirement বাড়াতে পারবে।

Sensitive documents private `seller-verification-docs` bucket-এ থাকে। Browser-এ public URL রাখা হয় না; admin review-এর সময় short-lived signed URL ব্যবহার করা হয়। RPC required document missing থাকলে application গ্রহণ করে না।

## Admin review

Admin seller verification queue-তে applicant-এর mode, business type, sector এবং প্রতিটি document দেখা যায়। প্রতিটি document আলাদাভাবে Approve বা Reject করা যায় এবং note লেখা যায়। Final approval তখনই সম্ভব যখন সব required document approved। Final approval হলে `seller_verification_badges`-এ mode ও sector অনুযায়ী badge তৈরি হয়, যা Product Detail-এর seller card-এ customer দেখতে পায়।

Review actions `seller_verification_reviews` audit table-এ লেখা হয়। Reject করলে note-সহ application status রাখা হয়, যাতে seller পরিবর্তন করে পরে আবার submit করতে পারে।

## Admin role system

আগের flat `admin_emails` access ভাঙা হয়নি; legacy allowlist-এর admin-রা `SUPER_ADMIN` হিসেবে কাজ করবে। নতুন role system-এ `admin_roles` এবং `admin_members` table আছে। Seed করা roleগুলোর মধ্যে Operations Manager, Catalog Manager, Content Manager, Finance Manager, Support Agent এবং Verification Reviewer আছে।

Admin Team পেজে super admin email অথবা Firebase UID দিয়ে user নির্বাচন করে role দিতে পারে। Custom role-ও তৈরি করা যায়। Permissionগুলো module-ভিত্তিক—যেমন `sales.orders`, `catalog.products`, `content.sellers`, `settings.site`, অথবা `team.manage`। Sidebar কেবল role-এ থাকা option দেখায়, আর direct URL খুললেও `AdminRoute` permission না থাকলে `/admin`-এ ফেরত পাঠায়। অর্থাৎ শুধু menu লুকানো নয়, route guard-ও আছে।

## Migration order

আগের migration-এর পরে নিচেরগুলো ধারাবাহিকভাবে চালাবেন:

```text
023_seller_verification_v2.sql
024_admin_roles_permissions.sql
025_verification_review_workflow.sql
```

`023` seller mode, business type, sector, document requirements, document rows, review history এবং badges যোগ করে। `024` roles, members এবং permission RPC যোগ করে। `025` per-document review এবং final approval RPC যোগ করে। SQL Editor-এ চালানোর আগে Supabase backup ও migration history যাচাই করুন।

## Scaling safeguards

Seller document requirements, document rows, review history, badges এবং admin members-এর জন্য indexes রাখা হয়েছে। Public pages-এ private documents fetch করা হয় না। Product page শুধু indexed seller badge query করে। Admin verification queue প্রথম page-এর pending records নিয়ে কাজ করার জন্য সীমিত করা উচিত; production hardening-এর পর cursor pagination যোগ করা হবে। Admin role permission database RPC-তে যাচাই হয়, তাই client-side checkbox বা hidden link-এর উপর authorization নির্ভর করে না।

## Operational rules

Admin কখনো chat বা document URL public message-এ পাঠাবেন না। NID, passport, password, OTP বা payment secretকে product description, chat বা AI prompt-এ রাখা যাবে না। Verification badge কেবল required documents ও admin final approval-এর পরে তৈরি হবে। Business documents-এর validity বা legal sufficiency নিয়ে final decision authorised operations team নেবে; UI কেবল workflow ও evidence review পরিচালনা করে।
