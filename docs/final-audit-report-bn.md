# BikriKoro.Com — ৫০+ বাগ অডিট ও সমাধানের চূড়ান্ত রিপোর্ট

**রিপোর্টের তারিখ:** ১৮ আগস্ট ২০২৬  
**রিপোজিটরি:** [mrariyanahmad-eng/Bikrikoro.com](https://github.com/mrariyanahmad-eng/Bikrikoro.com)  
**সর্বশেষ pushed commit:** [`5dfeefe`](https://github.com/mrariyanahmad-eng/Bikrikoro.com/commit/5dfeefe)  
**অডিটের ভিত্তি:** সম্পূর্ণ source scan, route/RPC contract scan, security review, migration review, build/lint validation এবং ৭০টি tracked finding-সম্বলিত master inventory [`audit/bug-inventory-bn.md`](https://github.com/mrariyanahmad-eng/Bikrikoro.com/blob/main/audit/bug-inventory-bn.md)।

## ১. কাজের সারসংক্ষেপ

BikriKoro.Com-এর customer, seller, chat, order, wallet, notification, content এবং admin flow আলাদাভাবে পর্যালোচনা করে ৭০টি concrete finding inventory-তে রাখা হয়েছিল। একই ধরনের সমস্যা একাধিক page-এ থাকায় একটি shared helper, protected API বা database RPC দিয়ে একসঙ্গে সংশোধন করা হয়েছে। ফলে বাস্তবে ৫০টির বেশি পৃথক bug, security gap, stale-state issue, error-handling issue এবং UI reliability issue ঠিক হয়েছে।

এই batch-গুলোর মূল নীতি ছিল: **Firebase UID-কে identity source হিসেবে ব্যবহার করা, sensitive operation server-side যাচাই করা, seller ও product manual approval বজায় রাখা, order flow automatic রাখা, admin action audit করা এবং Supabase table-এ browser-এর সরাসরি high-risk access কমিয়ে permission-scoped RPC ব্যবহার করা।**

## ২. সম্পন্ন পরিবর্তনের তালিকা

| ক্ষেত্র | সম্পন্ন সংশোধন | ফলাফল |
|---|---|---|
| Auth ও route protection | Protected page থেকে login-এ গেলে `returnTo` সংরক্ষণ, login শেষে আগের page-এ ফেরত, phone OTP ব্যর্থ হলে reCAPTCHA reset, profile bootstrap-এ name/phone/photo backfill | Deep link login এবং OTP retry নির্ভরযোগ্য হয়েছে |
| Global navigation | Shared `BackButton` layout-এ রাখা, login/protected route-এর navigation intent রক্ষা, category navigation-এ full-page reload বাদ | Page পরিবর্তনের সময় browser state কম নষ্ট হয় |
| Product discovery | Home category navigation-এ React Router, Products loader-এ প্রকৃত Supabase error, filter/accessibility attributes, duplicate button type ঠিক করা | Silent failure এবং broken filtering কমেছে |
| Product card | Link-এর ভিতরে nested button সরানো, invalid HTML দূর করা, lazy image loading, brand badge consistency | Mobile click এবং accessibility আচরণ উন্নত হয়েছে |
| Product detail | Cancellable loader, stale product/seller state reset, `maybeSingle()`, loading error state, empty-state recovery link, favorite/alert/follow hydration | Shared product link ও rapid navigation-এ পুরনো data দেখানোর ঝুঁকি কমেছে |
| Product detail action | Alert toggle-এ প্রকৃত enabled state, follow toggle-এ actual next state, Q&A/chat/report error message, explicit button type | Customer-কে ভুল success message দেখায় না |
| Favorites | Wishlist/folder loader-এ error state, folder create/assign error visibility, stale data reset, explicit controls | Wishlist action ব্যর্থ হলে user বুঝতে পারেন |
| Compare | Invalid/stale local comparison ID বাদ, query error visibility, remove control hardening | পুরনো বা মুছে যাওয়া product compare ভাঙে না |
| Seller profile | Loader cancellation/error handling, public seller page-এ শুধু approved ও visible product | Pending/rejected/hidden listing customer-এর সামনে আসে না |
| File uploads | Bengali shared validator; image-এর ৫ MB এবং document-এর ১০ MB সীমা, MIME/type validation, storage layer-এ defense-in-depth validation | Seller verification, profile photo, chat/evidence upload নিরাপদ হয়েছে |
| Seller listing | Edit-এ owner-verified `seller_update_product`, delete-এর বদলে owner-verified archive RPC, object URL cleanup, image upload race-safe placeholder replacement | Seller অন্যের listing mutate করতে পারে না; upload race কমেছে |
| Seller listing submit | Product submit ও digital delivery persistence try/finally-তে আনা, ব্যর্থ হলে stuck submitting state বন্ধ | Network failure-এর পর form আটকে থাকে না |
| Seller eligibility | Seller access legacy `profiles.is_verified`-এর বদলে approved `seller_registrations` status-এর উপর নির্ভরশীল | Manual approval requirement বাস্তবে enforce হয় |
| Physical/digital eligibility | Migration [`044_seller_eligibility_hardening.sql`](../supabase/migrations/044_seller_eligibility_hardening.sql)-এ digital seller approval server-side check, listing edit-এ approval reset | Unverified seller digital product publish করতে পারে না; edited approved listing পুনরায় review-এ যায় |
| Seller verification privacy | Sensitive registration/document table direct browser read বন্ধ; owner-scoped status API, protected document URL API এবং protected admin verification API | NID/business document public anon client দিয়ে পড়া যায় না |
| Seller dashboard | Statistics RPC cancellable ও error-aware, archived listing metric আলাদা, seller notification card path রাখা | Query failure false zero হিসেবে দেখায় না |
| Seller notification | Product Q&A seller notification trigger migration 040-এর সঙ্গে seller dashboard/inbox path যুক্ত | Customer question seller-এর কাছে in-app event হিসেবে যায় |
| Chat security | Firebase-UID-scoped thread lookup, list, unread, message RPC; participant-scoped load/send/read | Client-supplied participant ID দিয়ে অন্য chat পড়া বা লেখা কঠিন হয়েছে |
| Order creation | Protected pending-order API, buyer UID server-side Firebase token থেকে নেওয়া, pending order cancel endpoint | Checkout-এ অন্য buyer-এর UID spoof করার সুযোগ কমেছে |
| Order actions | Buyer/seller lifecycle এবং dispute action-এর জন্য Firebase-authenticated `api/order-action.ts` | Order transition identity-bound হয়েছে |
| Order reads | `api/order-read.ts`-এ order list/detail, review flag, dispute, payment state এবং wallet read | Customer private data broad anon table read-এর উপর নির্ভর করে না |
| Payment callback | Payment status poll authenticated endpoint দিয়ে, arbitrary order ID status exposure বন্ধ, polling error feedback | Payment callback বেশি নিরাপদ ও ব্যাখ্যাযোগ্য হয়েছে |
| Buy modal | Saved address async loader, error visibility, coupon/submit controls explicit | Address বা coupon load failure গোপন থাকে না |
| Wallet | Balance/ledger authenticated read API, withdrawal-এর জন্য Firebase-authenticated endpoint, method-specific detail validation | Wallet read ও payout request UID-bound হয়েছে |
| Withdrawal safety | Migration 041-এর balance validation, lock/duplicate pending request safeguards, insufficient-balance friendly message | Concurrent payout ও negative balance ঝুঁকি কমেছে |
| Dispute thread | Authorized order-read endpoint, scoped realtime refresh, send/load error state | অন্য order-এর dispute access এবং silent message failure কমেছে |
| Notifications inbox | List, unread count, read এবং mark-all failure user-visible; refresh/filter/item controls explicit | Notification কাজ না করলে প্রকৃত error দেখা যায় |
| Push API | Campaign target whitelist, title/body length limit, সর্বোচ্চ ৫০০ UID, internal-only link validation, 400/403/500 আলাদা response | Admin campaign misuse ও open redirect ঝুঁকি কমেছে |
| Admin notification campaign | Campaign refresh ও push failure শেষে form unlock, in-app success বনাম push failure আলাদা message | Push ব্যর্থ হলেও in-app result পরিষ্কার থাকে |
| Blog/FAQ/content | Blog, BlogPost ও PublicContentPage-এ cancellable loader, reset-on-route-change, CMS error state, unpublished বনাম load failure আলাদা | Admin-managed content failure আর blank/false empty state হয় না |
| Admin RPC security | `api/admin-rpc.ts`-এ Firebase ID token verify, strict RPC allowlist, token UID দিয়ে `p_admin_id` overwrite | Browser-supplied admin UID spoofing-এর ঝুঁকি কমেছে |
| Admin client helper | `src/lib/adminRpc.ts` দিয়ে ১৬টি admin module-এর RPC call gateway-এ নেওয়া | Admin mutation/read একই authentication boundary ব্যবহার করে |
| Admin operational reads | Migration 046-এ dashboard overview, pending disputes, profile lookup, system status, categories, banners এবং digital deliveries-এর permission-scoped RPC | Admin page broad table read না করে scoped function ব্যবহার করে |
| Admin dashboard | Orders/profiles/products/disputes/revenue-এর broad browser query বাদ, dashboard overview RPC ও error banner | Dashboard metric permission scope-এর ভিতরে এসেছে |
| Admin disputes | Pending dispute direct table read বাদ, scoped RPC; resolution shared admin helper দিয়ে gateway-এ | Dispute list ও resolution একই security boundary ব্যবহার করে |
| Admin system status | Shallow direct table count বাদ, real admin health RPC, refresh type/error state | Admin status page প্রকৃত server response দেখায় |
| Admin Team | Direct profile lookup বাদ, permission-scoped `admin_find_user_profile`, Super Admin role dropdown বাদ দেওয়া | Admin assignment বেশি নিয়ন্ত্রিত হয়েছে |
| Admin controls | Admin shell ও module-এর button-এ explicit `type="button"` | Form-এর ভেতর accidental submit কমেছে |
| Regression | Build, lint, diff check, RPC reference scan, back-navigation scan, secret-prefix scan চালানো হয়েছে | Final source state যাচাই করা হয়েছে |

উপরের টেবিলের প্রতিটি সারিতে একাধিক file বা migration change আছে; তাই এগুলোকে আলাদা concrete bug হিসেবে track করলে ৫০টির বেশি সংশোধন সম্পন্ন হয়েছে। মূল ৭০টি finding-এর evidence ও status inventory file-এ সংরক্ষিত আছে।

## ৩. গুরুত্বপূর্ণ database migration

নতুন বা সংশোধিত migration-গুলো destructive schema replacement না করে idempotent function replacement এবং permission hardening ব্যবহার করেছে। Migration-গুলো SQL Editor-এ চালানোর সময় নিচের ক্রম অনুসরণ করতে হবে।

| Migration | উদ্দেশ্য | প্রয়োগের অবস্থা |
|---|---|---|
| `033_order_lifecycle_hardening.sql` | Buyer/seller UID text cast, lifecycle এবং wallet effect hardening | Corrected version সফলভাবে চালানো না হয়ে থাকলে পুনরায় চালান |
| `034_product_video.sql` | Product-এর optional YouTube/video field | চালাতে হবে |
| `035_content_seo_blog.sql` | Admin-editable Blog/SEO content | চালাতে হবে |
| `036_faq_content.sql` | Admin-editable FAQ | চালাতে হবে |
| `037_super_admin_priority.sql` | Super Admin resolution | ব্যবহারকারীর তথ্য অনুযায়ী ইতিমধ্যে চালানো হয়েছে |
| `038_order_lifecycle_type_cast_repair.sql` | পুরনো lifecycle cast repair | কেবল পুরনো migration error থাকলে চালান |
| `040_product_question_seller_notifications.sql` | Customer question থেকে seller notification | চালাতে হবে |
| `041_wallet_withdrawal_safety.sql` | Balance lock, duplicate payout ও settlement safeguards | চালাতে হবে |
| `042_seller_listing_mutations.sql` | Owner-verified seller update/archive/digital delivery RPC | চালাতে হবে |
| `043_secure_chat_operations.sql` | Firebase-UID-scoped chat RPC | চালাতে হবে |
| `044_seller_eligibility_hardening.sql` | Approved digital seller check, approval reset, verification privacy | চালাতে হবে |
| `045_order_read_and_checkout_hardening.sql` | Protected order read/action/checkout/wallet RPC | চালাতে হবে |
| `046_admin_read_scope_hardening.sql` | Scoped admin dashboard, dispute, profile, system and catalogue reads | চালাতে হবে |

**বিশেষ সতর্কতা:** Migration ০৪৪, ০৪৫ এবং ০৪৬ আগের permission/RPC migration-এর উপর নির্ভর করে। তাই ০২৪, ০২৬, ০২৮, ০৩১, ০৩৩, ০৩৫, ০৩৬, ০৪০–০৪৩ আগে সফলভাবে প্রয়োগ করা নিশ্চিত করুন। SQL Editor-এ “already exists” বা পুরনো function signature conflict দেখা দিলে error text-টি সংরক্ষণ করে আমাকে দিলে আমি idempotent repair migration তৈরি করতে পারব।

## ৪. Environment ও deployment checklist

| Variable | কোথায় | কেন দরকার |
|---|---|---|
| `VITE_FIREBASE_VAPID_KEY` | Vercel-এর client environment | Web push token তৈরি |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Vercel server-only environment | Firebase Admin token verification ও push delivery |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel server-only environment | Protected API এবং admin/service-side RPC |
| `AGENT_ROUTER_BASE_URL` | Server environment | `https://agentrouter.org` |
| `AGENT_ROUTER_API_KEY` | Server-only environment | Agent Router authentication; `VITE_` prefix ব্যবহার করবেন না |
| `AGENT_ROUTER_MODEL` | Server environment | আপনার নির্বাচিত model ID |
| `AGENT_ROUTER_CHAT_PATH` | Server environment | `/v1/chat/completions` |
| `VITE_SITE_URL` | Vercel client environment | Canonical URL, sitemap ও share metadata |
| `VITE_GOOGLE_SITE_VERIFICATION` | Vercel client environment | Google Search Console verification |

Firebase service account, Supabase service role key এবং Agent Router key কখনো `VITE_` variable, GitHub source, browser bundle, screenshot বা public `.env` file-এ রাখা যাবে না। Repository scan-এ এই sensitive variable-গুলোর **actual value** পাওয়া যায়নি; কেবল server-side code ও setup documentation-এ variable name রয়েছে।

## ৫. Validation ফলাফল

Final validation-এ `npm run build` সফল হয়েছে এবং Vite production bundle তৈরি হয়েছে। `npm run lint`-এ কোনো error নেই; কেবল আগের থেকে থাকা `AuthContext.tsx`-এর Fast Refresh warning রয়েছে, যা ইচ্ছাকৃতভাবে পরিবর্তন করা হয়নি। `git diff --check` clean। RPC scan-এ frontend/API-তে ব্যবহৃত RPC-গুলোর migration definition পাওয়া গেছে; নতুন migration ০৪৬-এর function-গুলো migration inventory-তে সংযুক্ত হয়েছে।

Production bundle-এ একটি chunk ৫০০ kB-এর বেশি হওয়ার Vite warning আছে। এটি deployment failure নয়, কিন্তু ভবিষ্যতে route-level lazy loading বা code splitting করলে initial load উন্নত হবে। Final regression evidence [`audit/final-regression-2026-08-18.txt`](../audit/final-regression-2026-08-18.txt)-এ রাখা হয়েছে।

## ৬. Pushed commit history

| Commit | বিষয় |
|---|---|
| [`2f0870b`](https://github.com/mrariyanahmad-eng/Bikrikoro.com/commit/2f0870b) | Seller chat upload, browsing, file validation এবং listing mutation hardening |
| [`a196cf6`](https://github.com/mrariyanahmad-eng/Bikrikoro.com/commit/a196cf6) | Auth retry, deep-link redirect এবং profile backfill |
| [`6b3f5a0`](https://github.com/mrariyanahmad-eng/Bikrikoro.com/commit/6b3f5a0) | Customer browsing, product detail, favorites, seller profile এবং compare hardening |
| [`0a3a309`](https://github.com/mrariyanahmad-eng/Bikrikoro.com/commit/0a3a309) | Seller eligibility, verification privacy, protected document এবং dashboard hardening |
| [`0ca32d4`](https://github.com/mrariyanahmad-eng/Bikrikoro.com/commit/0ca32d4) | Checkout, order action/read, payment callback, wallet ও dispute hardening |
| [`78d579d`](https://github.com/mrariyanahmad-eng/Bikrikoro.com/commit/78d579d) | Notification inbox/API, push campaign validation, Blog/FAQ/content loading |
| [`b6f1bbe`](https://github.com/mrariyanahmad-eng/Bikrikoro.com/commit/b6f1bbe) | Firebase-verified admin RPC gateway, scoped admin reads ও button hardening |
| [`5dfeefe`](https://github.com/mrariyanahmad-eng/Bikrikoro.com/commit/5dfeefe) | Final regression report এবং shared layout control hardening |

`origin/main` বর্তমানে [`5dfeefe`](https://github.com/mrariyanahmad-eng/Bikrikoro.com/commit/5dfeefe)-এ আছে এবং working tree clean। Vercel যদি GitHub `main` branch থেকে auto-deploy করে, তাহলে শেষ commit deploy queue-তে যাওয়ার কথা।

## ৭. এখন আপনার করণীয়

প্রথমে Supabase SQL Editor-এ উপরের pending migration-গুলো ক্রমানুসারে চালান এবং প্রতিটি migration-এর success result সংরক্ষণ করুন। এরপর Vercel-এ server-only variables বসিয়ে redeploy করুন। বিশেষভাবে `FIREBASE_SERVICE_ACCOUNT_JSON`, `SUPABASE_SERVICE_ROLE_KEY` এবং `VITE_FIREBASE_VAPID_KEY` না থাকলে protected admin operation, push notification এবং wallet/order server endpoint সম্পূর্ণভাবে কাজ করবে না।

এরপর একটি ছোট production smoke test করুন: Google login, Facebook login, phone OTP retry, protected product link, physical seller listing, unverified seller-এর digital restriction, verified digital seller listing, product approval, seller approval, customer Q&A, notification inbox, push permission, order payment callback, seller order transitions, wallet withdrawal এবং admin customer detail। প্রতিটি test-এ browser console এবং Supabase function log-এ error আছে কি না দেখুন।

সবশেষে Admin Team-এ role assignment পরীক্ষা করুন। Firebase UID থেকে admin gateway token নেবে; browser payload-এ অন্য `p_admin_id` পাঠালেও server token-এর UID-ই ব্যবহৃত হবে। এটাই এই audit-এর সবচেয়ে গুরুত্বপূর্ণ security hardening-এর একটি অংশ।

## উপসংহার

এই audit-এ কেবল cosmetic পরিবর্তন করা হয়নি; customer-facing failure state, seller eligibility, private verification document, order/wallet identity boundary, notification delivery, admin permission boundary এবং database RPC contract একসঙ্গে শক্ত করা হয়েছে। Product ও seller verification manual approval-এ রাখা হয়েছে, order flow automatic রাখা হয়েছে এবং admin history-তে Gmail/UID প্রদর্শনের existing design বজায় রাখা হয়েছে। Final code GitHub `main` branch-এ pushed এবং build/lint validation সফল।

### References

[1]: https://github.com/mrariyanahmad-eng/Bikrikoro.com/blob/main/audit/bug-inventory-bn.md "BikriKoro master bug inventory"
[2]: https://github.com/mrariyanahmad-eng/Bikrikoro.com/commits/main "BikriKoro main branch commit history"
[3]: https://github.com/mrariyanahmad-eng/Bikrikoro.com/blob/main/supabase/migrations/046_admin_read_scope_hardening.sql "Admin read scope hardening migration"
[4]: https://github.com/mrariyanahmad-eng/Bikrikoro.com/blob/main/audit/final-regression-2026-08-18.txt "Final regression evidence"
