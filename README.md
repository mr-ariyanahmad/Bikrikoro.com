# BikriKoro Web (bikrikoro.com)

React 19 + TypeScript + Vite + Tailwind v4 + Supabase JS + Firebase Auth. একই Supabase ব্যাকএন্ড ও Firebase প্রজেক্ট Android অ্যাপের সাথে শেয়ার করে। **স্কোপ: বাংলাদেশ শুধু, BDT একমাত্র কারেন্সি।**

## 🚀 Vercel-এ ডিপ্লয় (ধাপে ধাপে)

1. **এই কোড GitHub রিপোতে পুশ করুন** (Vercel সরাসরি GitHub/GitLab/Bitbucket থেকে ডিপ্লয় করে)
2. **[vercel.com](https://vercel.com)-এ লগইন করে "Add New Project"** → আপনার রিপো সিলেক্ট করুন
3. Vercel অটো-ডিটেক্ট করবে **Framework Preset: Vite** — কিছু বদলানো লাগবে না (Build Command: `npm run build`, Output Directory: `dist` — এগুলো `vercel.json`-এ আছে বলে অটো হবে)
4. **Environment Variables** যোগ করুন (Project Settings → Environment Variables), `.env.example`-এর প্রতিটা `VITE_...` ভ্যারিয়েবল একই নামে বসান:
   - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (already ভরা `.env.example`-এ, কপি করুন)
   - `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`
5. **Deploy** চাপুন — ২-৩ মিনিটে লাইভ হয়ে যাবে একটা `*.vercel.app` URL-এ
6. **কাস্টম ডোমেইন যোগ করুন**: Project → Settings → Domains → `bikrikoro.com` টাইপ করুন → Vercel যে DNS রেকর্ড (A/CNAME) দেখাবে সেটা আপনার ডোমেইন প্রোভাইডারে (যেখান থেকে bikrikoro.com কিনেছেন) বসান
7. **Firebase-এ Vercel ডোমেইন whitelist করুন**: Firebase Console → Authentication → Settings → Authorized domains → `bikrikoro.com` ও `*.vercel.app` (প্রিভিউ ডিপ্লয়ের জন্য) যোগ করুন — নাহলে লগইন কাজ করবে না নতুন ডোমেইনে

### Edge Functions (আলাদা করে ডিপ্লয় করতে হয়, Vercel এটা করে না)
পেমেন্ট Supabase-এ চলে, Vercel-এ না:
```bash
supabase functions deploy uddoktapay-create-charge
supabase functions deploy uddoktapay-webhook --no-verify-jwt
supabase secrets set UDDOKTAPAY_API_KEY=xxxxx UDDOKTAPAY_BASE_URL=https://sandbox.uddoktapay.com SITE_URL=https://bikrikoro.com
```

### Migration রান করুন
Supabase Dashboard → SQL Editor-এ `supabase/migrations/` ফোল্ডারের সব `.sql` ফাইল **নম্বর অনুযায়ী ক্রমানুসারে** রান করুন (001 থেকে 011 পর্যন্ত) — বিশেষ করে `011_admin.sql` (নিচে দেখুন)।

## 👤 অ্যাডমিন প্যানেল
`011_admin.sql` মাইগ্রেশন রান করলে **`mr.ariyanahmad@gmail.com`** অটোমেটিক অ্যাডমিন হয়ে যাবে। এই ইমেইল দিয়ে ওয়েবসাইটে লগইন করলে নেভবারে **"অ্যাডমিন"** লিংক দেখা যাবে (`/admin`), যেখান থেকে:
- **রিপোর্ট রিভিউ** (`/admin/disputes`) — বিক্রেতা/ক্রেতার ডিসপিউট দেখে রিফান্ড অনুমোদন/বাতিল করা যায়
- **সেলার ভেরিফিকেশন** (`/admin/sellers`) — NID/ট্রেড লাইসেন্স দেখে অনুমোদন/বাতিল করা যায়

নতুন অ্যাডমিন যোগ করতে Supabase SQL Editor-এ:
```sql
insert into admin_emails (email) values ('new-admin@example.com');
```

## 👥 অ্যাকাউন্ট ও সেলার পেজ
- `/account` — নাম ও প্রোফাইল ছবি এডিট (ফোন/ইমেইল লগইন পদ্ধতির সাথে যুক্ত বলে এখান থেকে বদলানো যায় না)
- `/sellers/:id` — পাবলিক সেলার প্রোফাইল (লগইন ছাড়াই দেখা যায়) — পণ্য গ্রিড, রেটিং, রিভিউ; `ProductDetail`-এর সেলার কার্ড থেকে লিংক করা
- `/seller/dashboard` — লিস্টিং সংখ্যা, মোট ভিউ, চলমান/সম্পন্ন অর্ডার, মোট আয় (wallet_ledger থেকে), রেটিং — `My Listings` পেজের হেডার থেকে লিংক করা

## 🛍️ ই-কমার্স ডিসকভারি ফিচার
- **সার্চ বার + অটোকমপ্লিট** — header-এ সবসময় দৃশ্যমান, টাইপ করলে ৬টা মিলে যাওয়া পণ্য সাজেস্ট করে (২৫০ms ডিবাউন্স), Enter/ক্লিকে `/products?q=...`-এ নিয়ে যায়
- **সম্পর্কিত পণ্য** (`ProductDetail`) — একই ক্যাটাগরির অন্য পণ্য দেখায়। **এখানে ইচ্ছাকৃতভাবে location-ভিত্তিক না, category-ভিত্তিক** — BikriKoro একটা virtual/digital-first মার্কেটপ্লেস, hyper-local pickup app না, তাই "কাছাকাছি" এর চেয়ে "একই ধরনের" বেশি প্রাসঙ্গিক সাজেশন সিগন্যাল
- **জনপ্রিয় পণ্য** (Home) — `view_count` অনুযায়ী সাজানো
- **সম্প্রতি দেখেছেন** (Home) — localStorage-ভিত্তিক, লগইন ছাড়াই কাজ করে
- **পছন্দের তালিকা / Wishlist** (`/favorites`) — বিদ্যমান `favorites` টেবিল ব্যবহার করে (আগে থেকেই স্কিমায় ছিল, UI ছিল না); প্রতিটা প্রোডাক্ট কার্ডে ♡ আইকন


- **Meta tags**: প্রতিটা পেজে title/description; `index.html`-এ সাইট-ওয়াইড OG/Twitter card/canonical; `ProductDetail`-এ প্রতিটা পণ্যের জন্য আলাদা dynamic title/description/OG/JSON-LD (react-helmet-async দিয়ে)
- **Structured data**: Organization + WebSite (সাইট-ওয়াইড), Product schema (প্রতিটা প্রোডাক্ট পেজে) — Google সার্চে rich snippet (দাম, স্টক) দেখানোর সুযোগ বাড়ায়
- **Sitemap**: `/sitemap.xml` — `api/sitemap.xml.ts` (Vercel serverless function) প্রতিটা লাইভ প্রোডাক্ট **রিয়েলটাইমে** লিস্ট করে, নতুন পণ্য পোস্ট হলেই সাইটম্যাপে যোগ হয়ে যায় (রিবিল্ড লাগে না)
- **robots.txt**: `/robots.txt` — লগইন-প্রয়োজনীয় পেজ (wallet, orders, chat ইত্যাদি) crawl থেকে বাদ
- **ব্র্যান্ডিং**: আপনার দেওয়া লোগো থেকে favicon (সব সাইজ), OG image, PWA manifest icon — সব জেনারেট করা হয়েছে; ব্র্যান্ড গ্রিন কালার (`#017C50`) সরাসরি লোগো থেকে sample করা

⚠️ **সততার সাথে একটা সীমাবদ্ধতা বলে রাখি:** এটা client-side rendered React SPA (Next.js-এর মতো server-rendered না)। Google আজকাল JS execute করে ইনডেক্স করে, তাই এই setup ভালো কাজ করবে — কিন্তু "১০০% SEO" এর সর্বোচ্চ স্তরে (instant crawl, সব crawler-এ guaranteed rendering) পৌঁছাতে হলে ভবিষ্যতে Next.js-এ migrate করা যেতে পারে। এখনকার সেটআপ একটা React SPA-র জন্য realistic best practice ceiling।

## ⚠️ নিরাপত্তা মডেল
`orders`, `order_disputes`, `wallet_*`, `payments`, `seller_registrations` — এসব টেবিলে RLS `using(true)` (Supabase Auth নেই বলে)। তাই **কোনো টাকা/অনুমোদন-সম্পর্কিত রাইট কখনো সরাসরি `.update()`/`.insert()` দিয়ে করা হয় না** — সব SECURITY DEFINER RPC অথবা Edge Function (service_role) দিয়ে যায়:
- `src/lib/orders.ts` — অর্ডার অ্যাকশন
- `src/lib/payments.ts` — UddoktaPay চেকআউট
- `src/lib/admin.ts` — অ্যাডমিন রিভিউ অ্যাকশন (caller-এর ইমেইল `admin_emails`-এ আছে কিনা RPC নিজেই যাচাই করে)

নতুন কোনো sensitive অ্যাকশন যোগ করলে এই প্যাটার্নই অনুসরণ করুন।

## Wallet ও পেমেন্ট কেন শুধু ওয়েবে
Android অ্যাপ পার্সোনাল Google Play Console থেকে পাবলিশ — ইন-অ্যাপ ওয়ালেট/পেমেন্ট গেটওয়ে থাকলে রিজেকশন রিস্ক। Android শুধু অর্ডার স্ট্যাটাস বদলায় (নিজস্ব `create_order_atomic` পাথ, গেটওয়ে ছাড়া); ওয়েবসাইট real payment (UddoktaPay) ও wallet balance/withdraw সামলায়।

## সেটআপ (লোকাল ডেভেলপমেন্ট)
```bash
npm install
cp .env.example .env   # Supabase URL+anon key আগে থেকেই ভরা, Firebase-এর ৬টা ভ্যালু বসান
npm run dev
npm run build
```
⚠️ `service_role` key বা `UDDOKTAPAY_API_KEY` কখনো `.env`/client কোডে রাখবেন না।

## স্ট্রাকচার
```
api/sitemap.xml.ts       # Vercel serverless function — dynamic sitemap
vercel.json               # SPA routing + sitemap rewrite
public/                   # favicon, OG image, manifest — সব লোগো থেকে জেনারেট করা
supabase/
  migrations/001-011      # 011_admin.sql = অ্যাডমিন অথরাইজেশন
  functions/uddoktapay-create-charge/, uddoktapay-webhook/
src/
  lib/orders.ts, payments.ts, admin.ts, chat.ts, verification.ts
  hooks/useIsAdmin.ts, useEnsureProfile.ts
  pages/
    ..., Orders.tsx, PaymentCallback.tsx, DisputeThread.tsx
    admin/AdminDashboard.tsx, AdminDisputes.tsx, AdminSellerVerifications.tsx
  components/AdminRoute.tsx, ProtectedRoute.tsx, ...
```

## এখনো যা নেই (Tier 2/3 — ভবিষ্যতের কাজ)
- সেলার ট্রাস্ট স্কোর, সিকিউরিটি ডিপোজিট, ওয়ারেন্টি ক্লেইম
- অ্যাডমিন প্যানেলে audit log / একাধিক admin role (এখন শুধু email allowlist)
- অ্যাফিলিয়েট, গেম টপ-আপ, বিল পে, ক্যাশব্যাক, ভাউচার (স্কোপ পর্যালোচনা বাকি)
