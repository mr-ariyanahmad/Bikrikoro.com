# BikriKoro.com পূর্ণতা ও কাজ না-করা ফিচার অডিট

**তারিখ:** ১২ সেপ্টেম্বর ২০২৬  
**অডিটের পরিধি:** User-facing features, security/payment/order state, Supabase migrations/functions, Vercel deployment, Firebase configuration, build and route wiring.

## Executive summary

প্রজেক্টের মূল marketplace, admin, seller verification, chat, notification, profile, onboarding এবং search feature-এর অধিকাংশ source code-এ আছে এবং local production build সফল হয়েছে। তবে production environment বর্তমানে repository-এর সর্বশেষ commit `476e325`-এর সঙ্গে মিলছে না; live asset hash এবং local build asset hash আলাদা। ফলে সর্বশেষ search analytics এবং পরবর্তী fixes live site-এ আছে কি না নিশ্চিত নয়।

সবচেয়ে গুরুত্বপূর্ণ functional/security ঝুঁকি হলো: digital order generic delivery action দিয়ে সরাসরি complete/payout হওয়ার সম্ভাবনা, payment amount এবং order binding যথেষ্ট কঠোরভাবে যাচাই না করা, এবং public payment-return fallback-এ provider invoice ও order-এর সম্পর্ক দুর্বল থাকা।

## অগ্রাধিকার তালিকা

| অগ্রাধিকার | সমস্যা | প্রভাব | প্রমাণ |
|---|---|---|---|
| P0 | Digital order-এর generic `confirm_delivery` path `ESCROW_HELD` order complete করতে পারে | Digital delivery ছাড়াই seller payout/complete হওয়ার ঝুঁকি | `server/api/order-action.ts:4,37-40`; `supabase/migrations/048_digital_only_marketplace.sql:560-625` |
| P0/P1 | Live Vercel build repository HEAD-এর সঙ্গে মিলছে না | নতুন feature/fix production-এ অনুপস্থিত থাকতে পারে | Local assets `index-CfGTuHHs.js`, live assets `index-DmF0eMGw.js` |
| P0/P1 | Payment amount বনাম order payable total যাচাই নেই | কম টাকা দিয়েও payment complete হওয়ার ঝুঁকি | `supabase/functions/uddoktapay-webhook/index.ts:100-134`; `server/api/payment-reconcile.ts:57-75` |
| P0/P1 | Payment return-এ provider metadata/order binding দুর্বল | Verified invoice ভুল order-এর সঙ্গে যুক্ত হওয়ার ঝুঁকি | `server/api/payment-return.ts:14-55` |
| P1 | UddoktaPay create-charge function caller/order-owner যাচাই স্পষ্ট নয় | অন্য user-এর pending order-এর জন্য charge শুরু করার authorization gap | `supabase/functions/uddoktapay-create-charge/index.ts:31-66`; `src/lib/payments.ts:67-75` |
| P1 | Payment row write error উপেক্ষা করা হয় এবং update row পরিবর্তিত হয়েছে কি না নিশ্চিত নয় | UI paid দেখাতে পারে, কিন্তু durable payment record/state নাও থাকতে পারে | `supabase/functions/uddoktapay-webhook/index.ts:83-138`; `server/api/payment-reconcile.ts:69-85` |
| P1 | Duplicate migration prefixes | Supabase migration push/validation ambiguous বা fail হতে পারে | `supabase/migrations`: 048–055 এবং 073-এর duplicate stems |
| P1 | Seller rejected status pending হিসেবে দেখায় | Seller ভুল status দেখে; re-submit/rejection recovery আটকে যায় | `src/pages/SellerVerification.tsx:200-203` |
| P1 | Desktop location selector visible কিন্তু কাজ করে না | Desktop user location পরিবর্তন করতে পারে না | `src/components/Layout.tsx:152-155`, mobile-only menu branch |
| P1 | `ChatList`-এ `user!.uid` unsafe assertion | Auth loading transition-এ runtime crash হতে পারে | `src/pages/ChatList.tsx:24` |
| P1 | `useEnsureProfile` app-এ কোথাও mounted নয় | New user profile creation lifecycle অসম্পূর্ণ হতে পারে | `src/hooks/useEnsureProfile.ts:7-35`, app-wide usage নেই |
| P1 | Policy content database-only, empty হলে usable fallback নেই | Policy page ফাঁকা/অপ্রস্তুত দেখাতে পারে | `src/pages/PublicContentPage.tsx:36-56,84-86` |
| P1/P2 | Firebase, Supabase service-role, UddoktaPay production env নিশ্চিত নয় | Auth/API/payment runtime failure | `.env.example`, `src/lib/firebase.ts`, `server/api/_server-auth.ts` |
| P2 | Payment expiry scheduled নয় | কোনো read/charge request না হলে expired order pending থাকতে পারে | `server/api/order-read.ts:21-23`; `vercel.json`-এ cron নেই |
| P2 | No CI workflow | Build/lint/server type/migration checks manual নির্ভর | `.github` workflow নেই; `gh run list` empty |
| P2 | Server API build-এর local type-check-এর বাইরে | `server/api` regression npm build-এ ধরা নাও পড়তে পারে | `tsconfig.app.json`, build script |
| P2 | `/api/health` নেই | Monitoring ভুল 404 বা SPA 200 পেতে পারে | `api/[...route].ts` handler map-এ health নেই |

## কোনগুলো কাজ করছে

### Marketplace ও search

Search route `/search` এবং product result route বিদ্যমান। Search input, product/shop suggestion, category navigation, recent search এবং real search analytics source code-এ আছে। Search popularity-এর জন্য `search_events` table এবং secure RPC যুক্ত হয়েছে। তবে live site-এ সর্বশেষ build deploy হয়েছে কি না আগে নিশ্চিত করতে হবে।

### Home feed

Home feed live product/category data ব্যবহার করে, popularity/view/date দিয়ে order করে, category interest ও recent activity অনুযায়ী ranking করে এবং pagination/load-more support করে। Hardcoded demo feed হিসেবে পাওয়া যায়নি।

### Profiles ও seller onboarding

Protected account edit, public seller profile, shop username uniqueness check, seller verification upload এবং admin review workflow আছে। কিন্তু rejected state-এর user-facing branch অসম্পূর্ণ।

### Admin

Admin route guard, permission-filtered shell, dashboard overview, seller review, orders, finance, support, notifications, content ও settings route আছে। তবে system health গভীরভাবে যাচাই করে না এবং কিছু validation/error-state এখনও audit item।

### Notifications ও chat

Notifications page, unread badges, mark-read/mark-all এবং Supabase INSERT subscription আছে। Chat gateway, thread load, polling, optimistic send ও unread support আছে। ChatList auth lifecycle hardening দরকার।

### Security baseline

Server endpoints Firebase token verify করে UID server-side derive করে। Wallet/order RPC এবং direct financial-table access অনেকাংশে harden করা হয়েছে; wallet withdrawal reservation/deduplication logic আছে; UddoktaPay webhook API-key check ও provider re-verification করে।

## যে কাজগুলো আগে করতে হবে

1. **Digital order lifecycle বন্ধ করা:** generic `confirm_delivery` route/RPC-এ digital order reject করতে হবে; শুধু `DIGITAL_DELIVERED` হলে buyer confirmation ও payout অনুমোদন করতে হবে।
2. **Payment invariant যোগ করা:** webhook, payment-return এবং reconcile—তিন জায়গায় provider amount-কে persisted `price + escrow_fee`-এর সঙ্গে exact comparison করতে হবে।
3. **Invoice/order binding শক্ত করা:** provider verification response-এর `metadata.order_id` অবশ্যই requested order-এর সঙ্গে match করতে হবে; metadata অনুপস্থিত হলে arbitrary `order_id` fallback ব্যবহার করা যাবে না।
4. **Payment transition atomic করা:** payment row upsert error handle করতে হবে এবং order update-এ `.select()`/row-count দেখে তবেই `ESCROW_HELD` response দিতে হবে।
5. **Create-charge ownership check:** authenticated buyer UID এবং order buyer ID match না হলে charge reject করতে হবে।
6. **Current HEAD deploy/verify:** Vercel deployment commit hash ও live asset hash confirm করতে হবে; search feature production-এ live কি না smoke test করতে হবে।
7. **Migration cleanup:** duplicate migration stems rename/normalize করে Supabase migration history-এর সঙ্গে মিলিয়ে নিতে হবে; production-এ blindly migration push করা যাবে না।
8. **User-facing fixes:** rejected seller flow, desktop city menu, ChatList auth gate, profile bootstrap mount, policy fallback।
9. **Operational completeness:** Firebase/UddoktaPay/Supabase/Resend env smoke test, cron-based expiry, server type-check, CI workflow এবং health endpoint।

## যাচাইয়ের ফল

- `npm run build`: সফল
- `npx tsc -p tsconfig.app.json --noEmit`: সফল
- `npm run lint`: ০ error, ৩ warning
- Git working tree: clean; local `main` এবং `origin/main` একই commit `476e325`
- Public Supabase product/category endpoints: reachable
- UddoktaPay Edge Function endpoints: deployed/reachable; GET-এ expected 405
- Live Vercel site: reachable, কিন্তু asset hash local HEAD-এর সঙ্গে মেলে না

## সীমাবদ্ধতা

এই audit source, migration, live route probe এবং connected Supabase metadata-এর ভিত্তিতে করা হয়েছে। User-এর real Firebase session দিয়ে end-to-end order/payment/chat/push test করা হয়নি। তাই environment-specific authentication, email, push এবং payment success-এর জন্য controlled production smoke test এখনও প্রয়োজন।
