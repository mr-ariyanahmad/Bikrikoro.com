# BikriKoro DIGITAL-only Marketplace — চূড়ান্ত পরিবর্তন প্রতিবেদন

**প্রকল্প:** BikriKoro.com

**প্রধান পরিবর্তন:** physical product marketplace থেকে নিরাপদ, BDT-ভিত্তিক DIGITAL-only marketplace-এ রূপান্তর।

**চূড়ান্ত commit:** `f1d0269` — `Transform BikriKoro into digital-only marketplace`

**শাখা:** `main`

## ১. সারসংক্ষেপ

BikriKoro-এর নতুন contract এখন কেবল digital key, license, file, download link, access, course, design, instructions এবং অনুমোদিত digital service-এর জন্য। পুরনো physical product, physical order এবং shipping history মুছে ফেলা হয়নি; সেগুলো hidden/archive অবস্থায় রাখা হয়েছে যাতে audit, support এবং historical reporting বজায় থাকে। তবে নতুন catalogue, seller listing, checkout, delivery, order action এবং admin operational flow-এ physical product আর সক্রিয় নয়।

নতুন digital order lifecycle হলো:

> `PENDING_PAYMENT → ESCROW_HELD → DIGITAL_DELIVERED → COMPLETED`

যদি buyer সমস্যা জানান, branch হবে `DISPUTED`; admin-এর সিদ্ধান্ত অনুযায়ী order `REFUNDED` অথবা `COMPLETED` হতে পারে। Seller-এর wallet-এ credit কেবল idempotent settlement path-এর মাধ্যমে যাবে; একই order পুনরায় confirm, webhook retry বা duplicate action-এর কারণে double credit করার সুযোগ রাখা হয়নি।

## ২. Database migration 048

নতুন migration ফাইলটি হলো `supabase/migrations/048_digital_only_marketplace.sql`। এটি migration 047-এর পরে Supabase SQL Editor-এ একবার চালাতে হবে। Migrationটি reversible নীতিতে লেখা হয়েছে: physical rows delete না করে `is_hidden = true` করা হয় এবং public catalogue policy কেবল visible, approved, digital rows পড়তে পারে।

| অংশ | বাস্তবায়ন |
|---|---|
| Physical archive | সব `is_digital = false` listing hidden করা |
| Order states | `DIGITAL_DELIVERED`, `DISPUTED`, `REFUNDED` যোগ করা |
| Public catalogue | `is_digital = true`, `is_hidden = false`, `approval_status = 'APPROVED'` বাধ্যতামূলক |
| Seller creation/update | নতুন listing-এ digital-only enforcement; physical create/edit প্রত্যাখ্যান |
| Checkout | digital order-এর জন্য shipping address আর প্রয়োজন নেই |
| Automatic delivery | `ESCROW_HELD` transition-এ idempotent delivery record তৈরি |
| License inventory | একবার claim করা key পুনরায় ব্যবহার না হওয়ার row-lock ও unique guard |
| Buyer library | secret delivery content public RPC থেকে সরিয়ে participant-scoped server path |
| Wallet settlement | release/refund timestamps এবং idempotent ledger reference সংরক্ষণ |
| Admin controls | physical approve/restore/edit বন্ধ; admin dashboard digital states অনুযায়ী update |
| Performance | digital catalogue, order lifecycle, delivery queue এবং admin-review index যোগ |

Migration চালানোর আগে বর্তমান database backup/export রাখা উচিত। Migration চালানোর পরে অন্তত একটি test digital product দিয়ে checkout, payment confirmation, delivery, buyer confirmation, wallet ledger এবং dispute flow যাচাই করতে হবে।

## ৩. Secure server/API পরিবর্তন

বর্তমান Vercel Hobby limit বজায় রাখতে API surface একটিই catch-all function-এর মধ্যে রাখা হয়েছে: `api/[...route].ts`। Internal handler সংখ্যা একাধিক হলেও Vercel function হিসেবে deploy হয় একটি gateway function।

| Endpoint/handler | পরিবর্তন |
|---|---|
| `server/api/order-action.ts` | Firebase-verified `digital_deliver` এবং `buyer_confirm_digital` action যোগ; UID client body থেকে নেওয়া হয় না |
| `server/api/order-read.ts` | participant-scoped delivery status, order detail এবং protected digital library read যোগ |
| `server/api/pending-order.ts` | online ও wallet checkout রেখে shipping-address requirement বাদ; wallet ও coupon path অক্ষুণ্ণ |
| `server/api/seller-digital-content.ts` | seller ownership যাচাই করে secret key/file/link/instruction read ও mutation |
| `api/[...route].ts` | seller digital-content route register; single gateway architecture অক্ষুণ্ণ |

Firebase service-account JSON এবং Supabase service-role key browser bundle-এ রাখা হয়নি। এগুলো কেবল server-side environment variable হিসেবে ব্যবহার করতে হবে।

## ৪. Customer এবং seller UI

Customer catalogue এখন কেবল approved digital product query করে। Physical type, location, COD, free delivery, fast delivery, free return এবং shipping-address filter/field সরানো হয়েছে। Search input-এ 250ms debounce এবং 30-second in-memory query cache যোগ করা হয়েছে, ফলে প্রতিটি keystroke-এ আলাদা database request কমে যায়। Product images lazy-load হচ্ছে এবং homepage query-তেও digital/approved/visible filter স্পষ্টভাবে দেওয়া হয়েছে।

Seller flow-এ physical/digital selector রাখা হয়নি। Seller verification সবসময় DIGITAL mode-এ শুরু হয় এবং PERSONAL, BUSINESS বা COMPANY type অনুযায়ী প্রয়োজনীয় document checklist দেখায়। Seller approval না হওয়া পর্যন্ত listing public হয় না। Digital content seller-scoped protected endpoint দিয়ে save/read হয়।

Checkout এখন full-screen branded digital purchase flow। Buyer-কে shipping address দিতে হয় না; payment hold, escrow protection, privacy policy এবং refund/dispute policy পরিষ্কারভাবে দেখানো হয়। Existing online UddoktaPay path, coupon support এবং wallet payment path রাখা হয়েছে।

Orders এবং OrderDetail page-এ physical preparation/shipped/delivered action নেই। Buyer `DIGITAL_DELIVERED` অবস্থায় delivery পেয়ে confirmation করতে পারবেন এবং escrow release হবে। Seller `ESCROW_HELD` অবস্থায় protected digital delivery দিতে পারবেন। Buyer একই active state-এ সমস্যা report করলে dispute modal চালু হবে। পুরনো physical order history কেবল legacy record হিসেবে দেখানো হয় এবং নতুন physical action দেওয়া হয় না।

## ৫. Admin panel পরিবর্তন

Admin panel-এ product approval, seller verification, digital delivery readiness, order risk, dispute, wallet ও payout audit flow রাখা হয়েছে। Admin catalogue পুরনো physical rows history হিসেবে দেখাতে পারে, কিন্তু physical row-এর জন্য approval, restore বা edit control নেই। Database RPC স্তরেও একই guardrail আছে, যাতে কেউ UI bypass করে physical listing পুনরায় publish করতে না পারে।

Admin order status mutation এখন dedicated payment, delivery, buyer-confirmation এবং dispute RPC-এর বাইরে arbitrary status change করতে পারে না। Admin-এর সাধারণ status action active digital order cancellation-এ সীমাবদ্ধ। Admin dashboard pending/revenue aggregation digital states এবং dispute queue অনুযায়ী update করা হয়েছে। Digital delivery read direct browser table query নয়; `admin_list_digital_deliveries` permission-scoped RPC দিয়ে server gateway-এর মাধ্যমে পড়া হয়।

## ৬. Wallet, escrow এবং double-credit protection

Buyer payment confirmed হলে order escrow-held হয়। Digital delivery record তৈরি হওয়া এবং buyer confirmation আলাদা audited transition। Settlement trigger ledger reference-এ order এবং effect type ধরে idempotent কাজ করে। একই order-এর জন্য দ্বিতীয়বার `seller_payout`, `buyer_refund` বা completion effect ঢোকার আগে uniqueness/guard যাচাই হয়। Existing withdrawal safety migration 041 এবং payout reconciliation migration 047-এর সঙ্গে compatibility বজায় রাখা হয়েছে।

গুরুত্বপূর্ণ operational rule হলো: migration চালানোর আগে অথবা payment webhook test করার আগে production wallet balances manually edit করা যাবে না। Wallet discrepancy দেখা গেলে reconciliation path ব্যবহার করতে হবে; সরাসরি balance column পরিবর্তন করা যাবে না।

## ৭. যাচাইয়ের ফল

| যাচাই | ফলাফল |
|---|---|
| `npm run build` | সফল |
| `npm run lint` | 0 error; কেবল আগে থেকেই থাকা `AuthContext` Fast Refresh warning |
| `git diff --check` | সফল |
| Vercel API function count | 1টি catch-all function |
| Server-only secret scan | Firebase service account ও Supabase service-role key কেবল server code-এ |
| `_server-auth.js` import scan | missing extension পাওয়া যায়নি |
| Production chunking | upstream admin route code-splitting বজায়; Vite-এর existing large-chunk advisory আছে |
| Git push | `origin/main`-এ সফলভাবে push হয়েছে |

Remote repository move notice এসেছে: canonical repository এখন `https://github.com/mr-ariyanahmad/Bikrikoro.com.git`; পুরনো configured URL থেকেও push সফল হয়েছে।

## ৮. এখন আপনাকে যা করতে হবে

প্রথমে Supabase SQL Editor-এ migration 048 সম্পূর্ণভাবে চালান। এটি migration 047-এর পরে চালাবেন এবং SQL Editor-এ কোনো error থাকলে পরবর্তী ধাপে যাবেন না। সফল হলে একটি approved digital product ও একটি test seller দিয়ে order lifecycle পরীক্ষা করুন।

তারপর Vercel Production environment-এ নিচের server-only variables নিশ্চিত করুন:

| Variable | কোথায় থাকবে |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Vercel Production; `VITE_` prefix নয় |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel Production; `VITE_` prefix নয় |
| `VITE_FIREBASE_VAPID_KEY` | browser push-এর জন্য public VAPID key |
| `AGENT_ROUTER_BASE_URL` | server-side Agent Router endpoint |
| `AGENT_ROUTER_API_KEY` | server-only secret |
| `AGENT_ROUTER_MODEL` | configured model ID |
| `AGENT_ROUTER_CHAT_PATH` | যেমন `/v1/chat/completions` |

আগে screenshot-এ Firebase service-account key প্রকাশ হয়ে থাকলে পুরনো key revoke করে নতুন key তৈরি করুন। পুরনো exposed key Vercel, local `.env`, GitHub history বা কোনো screenshot-এ রাখা যাবে না। Variables save করার পরে Vercel redeploy করুন।

## ৯. Rollback এবং সতর্কতা

এই পরিবর্তনের rollback UI commit revert করে করা সম্ভব, কিন্তু migration 048 চালানোর পরে database state সরাসরি আগের অবস্থায় ফিরিয়ে দেওয়া উচিত নয়। কারণ physical rows archive করা, digital order state, ledger settlement এবং delivery inventory-এর audit history ইচ্ছাকৃতভাবে সংরক্ষিত থাকবে। কোনো সমস্যা হলে public listing বন্ধ রেখে নতুন forward-fix migration ব্যবহার করা নিরাপদ পথ। Physical data restore করার আগে wallet, order এবং approval audit review করা আবশ্যক।

এখনকার local validation build, lint এবং static checks সফল হলেও remote Supabase execution ও payment-provider live smoke test এই sandbox থেকে করা হয়নি। তাই migration apply করার পর production test order দিয়ে ফলাফল যাচাই করাই পরবর্তী নিরাপদ ধাপ।

## ১০. গুরুত্বপূর্ণ ফাইল

| ফাইল | উদ্দেশ্য |
|---|---|
| `supabase/migrations/048_digital_only_marketplace.sql` | Digital-only schema, RPC, trigger, policy ও index |
| `docs/digital-only-migration-plan-bn.md` | Migration contract, archive policy, state machine ও rollback plan |
| `audit/digital-only-inventory.txt` | Physical/digital schema ও route inventory |
| `audit/digital-only-regression-2026-08-21.md` | Static regression evidence |
| `server/api/seller-digital-content.ts` | Protected seller delivery-content gateway |
| `src/pages/Products.tsx` | Digital catalogue, debounce ও cache |
| `src/pages/Sell.tsx` | Digital seller listing workflow |
| `src/pages/Orders.tsx` | Digital order lifecycle UI |
| `src/pages/OrderDetail.tsx` | Escrow, delivery confirmation ও dispute UI |
| `src/pages/admin/AdminDeliveries.tsx` | Digital-only admin delivery queue |

**উপসংহার:** BikriKoro এখন নতুন physical listing বা shipping order-এর উপর নির্ভর করে না। Approved digital seller, escrow-held payment, protected delivery, buyer confirmation, dispute review এবং wallet settlement—এই contract-ই নতুন marketplace-এর active operating model।


## ১১. Live Supabase execution result — ২১ আগস্ট ২০২৬

আপনার সংযুক্ত Supabase project **Bikrikoro** (`lrwvbwkkapmwehvxkqlt`, region `ap-southeast-1`) সরাসরি যাচাই করে migration চালানো হয়েছে। প্রথমবার migration 048-এ `orders.admin_review_status` index-এর একটি incompatible reference ধরা পড়ে। Supabase transaction partial state রেখে যায়নি; read-only check-এ নতুন columns অনুপস্থিত ছিল। তাই local migration থেকে সেই index সরিয়ে commit `da0df54` push করা হয় এবং migration 048 আবার চালিয়ে সফলভাবে apply করা হয়।

এর পরে routine privilege audit-এ দেখা যায় যে পুরনো migration-গুলো কিছু security-definer RPC-তে `anon` ও `authenticated` execute grant রেখে গিয়েছিল। Seller product, digital content, digital delivery, digital library, buyer confirmation এবং admin order RPC-এর জন্য follow-up migration 049 তৈরি ও apply করা হয়েছে। এর পরে audit-এ sensitive routines-এর জন্য কেবল `postgres` ও `service_role` execute privilege দেখা গেছে; `anon` এবং `authenticated` grant আর নেই।

| Live check | ফলাফল |
|---|---|
| Migration 048 | সফলভাবে apply হয়েছে |
| Migration 049 | সফলভাবে apply হয়েছে |
| Public catalogue | ১টি visible, approved digital product পাওয়া গেছে |
| Physical archive | Public catalogue-এ কোনো physical row নেই; historical physical rows hidden/archive policy-এর বাইরে public নয় |
| Digital delivery | ১টি `READY` delivery record আছে |
| Orders | `ESCROW_HELD` ১টি এবং পুরনো/পরীক্ষামূলক `CANCELLED` ৩টি record আছে |
| Wallet settlement | Smoke query-তে নতুন `SELLER_PAYOUT` বা `ORDER_REFUND` ledger row তৈরি হয়নি; migration নিজে কোনো payout/refund চালায়নি |
| Delivery trigger | `trg_sync_digital_delivery` live আছে |
| Wallet trigger | `trg_apply_order_wallet_effects` live আছে |
| Performance indexes | Catalogue, order lifecycle, license inventory এবং delivery indexes live আছে |
| Sensitive RPC grants | `anon`/`authenticated` সরানো হয়েছে; server role-only রাখা হয়েছে |

### Supabase Advisor ফলাফল

Supabase security advisor কিছু **pre-existing INFO/WARN** notice দেখিয়েছে। এগুলোর মধ্যে RLS enabled কিন্তু policy নেই এমন admin/audit/notification tables এবং mutable `search_path` থাকা পুরনো functions আছে। এগুলো migration 048/049-এর failure নয় এবং নতুন digital secret tables-এর policy verification সফল হয়েছে। Advisor remediation links হলো [RLS policy guidance](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) এবং [mutable search_path guidance](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable)। Performance advisor মূলত পুরনো unindexed foreign key এবং unused-index INFO দেখিয়েছে; নতুন digital catalogue/delivery indexes live আছে।

### এখনকার বাস্তব অবস্থা

এখন database-side digital-only contract live। Seller product create/update browser থেকে সরাসরি Supabase RPC call না করে Firebase-verified `/api/seller-product` gateway ব্যবহার করে; server-side service role validated seller UID দিয়ে RPC চালায়। Vercel deployment-এর জন্য commit `9f0c169`-এ gateway change এবং commit `379c788`-এ migration 049 push করা আছে। Migration schema compatibility fix commit `da0df54`-এ আছে।

এখন কেবল Vercel deployment শেষ হওয়া এবং একটি বাস্তব test transaction চালানো বাকি। Test transaction-এ কোনো real high-value payment না দিয়ে, low-price approved digital product দিয়ে online checkout বা existing wallet sandbox path, `ESCROW_HELD`, `DIGITAL_DELIVERED`, buyer confirmation এবং seller wallet ledger যাচাই করবেন। Live database-এ আমি কোনো test purchase, payout বা refund চালাইনি, তাই বিদ্যমান wallet ও order data অপরিবর্তিত আছে।
