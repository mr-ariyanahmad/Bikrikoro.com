# BikriKoro payment display ও modern search rollout report

## সারাংশ

BikriKoro-এর digital-only marketplace-এর জন্য নতুন করে Z2U-inspired search experience এবং বাংলাদেশের বাজারকেন্দ্রিক payment-method trust section যুক্ত করা হয়েছে। UI-এর ভাষা Bengali এবং মূল্য প্রদর্শন BDT-তেই রাখা হয়েছে। পরিবর্তনগুলো বিদ্যমান Firebase authentication, Supabase RLS, UddoktaPay checkout এবং একক Vercel gateway-এর উপর তৈরি হয়েছে; নতুন কোনো payment route বা serverless function যোগ করা হয়নি।

## কী কী পরিবর্তন হয়েছে

| এলাকা | বাস্তবায়ন | ফলাফল |
|---|---|---|
| Header search | Debounce 250ms অক্ষুণ্ণ রেখে digital-only approved product query, product image, price এবং Bengali category label যোগ করা হয়েছে | ফলাফল category অনুযায়ী group হয় এবং product detail-এ সরাসরি যাওয়া যায় |
| Search discovery | সাম্প্রতিক search, জনপ্রিয়/trending search এবং active digital category browse section যোগ করা হয়েছে | Search field focus করলেই দ্রুত discovery panel দেখা যায় |
| Search safety | Search suggestions-এ `is_digital = true`, `is_hidden = false` এবং `approval_status = APPROVED` filter রাখা হয়েছে | Physical, hidden বা unapproved listing search suggestion-এ আসে না |
| Footer payment strip | bKash, Nagad, Rocket, Upay, City Bank, Islami Bank, Agrani Bank, Pubali Bank এবং UCB-এর branded text badges যোগ করা হয়েছে | Desktop ও mobile-এ responsive payment trust section দেখা যায় |
| Checkout trust panel | BuyModal-এর মধ্যে একই payment badges এবং UddoktaPay hosted checkout-এর ব্যাখ্যা যোগ করা হয়েছে | Display brand ও actual payment route-এর পার্থক্য পরিষ্কার থাকে |
| Admin configurability | `public_payment_methods` JSON এবং `public_trending_searches` setting Admin Settings-এ যোগ করা হয়েছে | Admin payment brand, color, short label এবং trending term পরিবর্তন করতে পারবেন |
| Public settings | `get_public_settings('public_')`-এর জন্য shared loader ও module-level cache যোগ করা হয়েছে | একই public setting বারবার অপ্রয়োজনীয়ভাবে query হয় না |

## Live Supabase update

`053_public_discovery_settings.sql` migration live Supabase project `lrwvbwkkapmwehvxkqlt`-এ সফলভাবে প্রয়োগ করা হয়েছে। Migrationটি idempotent এবং `on conflict do nothing` ব্যবহার করে; ফলে Admin Settings থেকে পরবর্তী পরিবর্তন seed value দ্বারা overwrite হবে না। বর্তমানে live `admin_settings` table-এ `public_payment_methods` এবং `public_trending_searches` দুইটি key রয়েছে।

Payment badges-এর তথ্য display-only। Checkout এখনো `src/lib/payments.ts`-এর মাধ্যমে pending order তৈরি করে `uddoktapay-create-charge` hosted payment page-এ redirect করে। কোনো badge-এ click করলে আলাদা বা অনিরাপদ payment route খোলা হয় না।

## Default payment configuration

| প্রদর্শিত নাম | Badge color | Short label |
|---|---|---|
| bKash | `#E2136E` | bKash |
| Nagad | `#F4821F` | Nagad |
| Rocket | `#8B1FA9` | Rocket |
| Upay | `#00A651` | উপায় |
| City Bank | `#1B4F8A` | City |
| Islami Bank | `#006633` | IBBL |
| Agrani Bank | `#004B87` | Agrani |
| Pubali Bank | `#C41E3A` | Pubali |
| UCB | `#003087` | UCB |

## Verification

| Check | Result |
|---|---|
| `npm run build` | সফল; TypeScript এবং Vite production build সম্পন্ন হয়েছে |
| `npm run lint` | 0 errors; একটি pre-existing `AuthContext` Fast Refresh warning অপরিবর্তিত রয়েছে |
| `git diff --check` | কোনো whitespace error নেই |
| Browser homepage check | সফল; Bengali footer payment strip এবং seeded trending terms দেখা গেছে |
| Empty search check | সফল; Bengali no-results state এবং “সব ফলাফল দেখুন” action দেখা গেছে |
| Vercel function count | `api/[...route].ts` একটিই gateway হিসেবে আছে |
| Credential boundary check | Browser/gateway source-এ Firebase service account, Supabase service-role, VAPID private key বা Agent Router secret নাম পাওয়া যায়নি; server-only references server directory-তেই আছে |
| Checkout route check | Existing UddoktaPay flow অক্ষুণ্ণ আছে |

## Admin ব্যবহারের নিয়ম

Admin panel-এর Site Settings অংশে `পেমেন্ট পদ্ধতি (JSON)` field-এ প্রতিটি method-এর `name`, six-digit hex `color` এবং `short` property সহ JSON array রাখা যাবে। `জনপ্রিয় সার্চ (কমা দিয়ে আলাদা করুন)` field-এ Bengali বা English search term comma দিয়ে লিখলেই search discovery panel-এ দেখাবে। Invalid JSON, invalid color অথবা খালি list হলে নিরাপদ default configuration ব্যবহার হবে।

## পরিবর্তিত ফাইল

`src/components/SearchBar.tsx`, `src/components/Layout.tsx`, `src/components/BuyModal.tsx`, `src/pages/admin/AdminSettings.tsx`, `src/lib/publicSettings.ts` এবং `supabase/migrations/053_public_discovery_settings.sql` পরিবর্তিত বা নতুন হয়েছে। Browser verification notes `verification/payment-search-browser-check.md`-এ রাখা হয়েছে।
