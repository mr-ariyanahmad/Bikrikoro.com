# BikriKoro Z2U-style Digital Product Form — Final Bengali Report

**প্রস্তুতকারক:** Manus AI  
**তারিখ:** ২১ আগস্ট ২০২৬  
**Repository:** `mrariyanahmad-eng/Bikrikoro.com`  
**Live Supabase project:** `lrwvbwkkapmwehvxkqlt`

## ১. কাজটির উদ্দেশ্য

BikriKoro-এর seller listing form-কে Z2U-এর category-first digital marketplace ধারণার সঙ্গে সামঞ্জস্যপূর্ণ করা হয়েছে। এখানে Z2U-এর branding বা code কপি করা হয়নি; বরং তাদের publicly documented workflow থেকে category-specific specifications, automatic delivery, stock/key management, delivery conditions, warranty, region এবং subscription metadata-এর ধারণাগুলো নিয়ে BikriKoro-এর Bengali UI, BDT currency, Firebase authentication, Supabase RLS এবং existing escrow/wallet contract-এর সঙ্গে যুক্ত করা হয়েছে।

> **মূল নীতি:** BikriKoro এখন digital-only থাকবে। Physical listing option, shipping field, COD field বা physical delivery flow পুনরায় যুক্ত করা হয়নি। পুরনো physical data history হিসেবে archive/hidden অবস্থায় রাখা হয়েছে।

## ২. Z2U research থেকে নেওয়া কার্যকর ধারণা

| Z2U-এর documented ধারণা | BikriKoro-এ বাস্তবায়ন |
|---|---|
| Seller প্রথমে game/product/category নির্বাচন করে তারপর offer information দেয় | Seller form এখন database-backed digital category template থেকে category-specific field দেখায় |
| Listing edit-এ description, delivery method, price ও stock পরিবর্তন করা যায় | Seller form-এ description, price, delivery type, stock mode, stock quantity ও delivery note আছে |
| Automatic delivery enable/disable এবং stock শেষ হলে listing deactivate করার নিয়ম | `auto_delivery_enabled` এবং `deactivate_when_out_of_stock` server-persisted fields যোগ হয়েছে |
| Storage/key inventory এবং batch product addition | `KEY_POOL` mode এবং প্রতি লাইনে একটি key দিয়ে protected batch inventory যোগ করার UI রয়েছে |
| Warranty, region, subscription period, delivery condition ও product specification | Region, subscription period, warranty period, fulfillment window এবং buyer delivery note যোগ হয়েছে |
| Category-specific product specification buyer-facing page-এ দেখানো | Secret delivery content বাদ দিয়ে buyer-safe structured specifications ProductDetail-এ দেখানো হয় |
| Manual review, abnormal pricing, suspicious transaction ও delayed settlement-এর মতো risk concepts | Existing seller verification, product approval, admin audit এবং escrow/delivery protection-এর সঙ্গে সংযুক্ত করা হয়েছে |

এই mapping-টি Z2U-এর listing management, seller rules, automatic-delivery tutorial এবং product specification guidance থেকে তৈরি করা হয়েছে। বিস্তারিত references শেষে দেওয়া আছে।

## ৩. Live database-এ তৈরি হওয়া category ও template

Supabase-এ migration `050_z2u_style_digital_listing_options.sql` সফলভাবে apply হয়েছে। মোট **১২টি active digital category template** seed করা হয়েছে এবং template-গুলোর মধ্যে মোট **৫৬টি category-specific field** রয়েছে।

| Category ID | বাংলা নাম | মূল specification-এর উদাহরণ |
|---|---|---|
| `digital_game_accounts` | গেম অ্যাকাউন্ট | গেম, server/region, level, rank, login type |
| `digital_game_currency` | গেম কয়েন / গোল্ড | game, currency name, প্রতি order amount, delivery method |
| `digital_game_items` | গেম আইটেম / স্কিন | game, item name, rarity, platform |
| `digital_game_topups` | গেম টপ-আপ / ভাউচার | game/service, region, top-up amount, redeem instructions |
| `digital_gift_cards` | গিফট কার্ড | brand, region, card value, expiry |
| `digital_software_license` | সফটওয়্যার / লাইসেন্স | software, edition/version, মেয়াদ, device limit, activation region |
| `digital_subscription` | স্ট্রিমিং / সাবস্ক্রিপশন | service, plan, মেয়াদ, profile/access type, region |
| `digital_social_accounts` | সোশ্যাল মিডিয়া অ্যাকাউন্ট | platform, niche, follower range, account age, region |
| `digital_course` | অনলাইন কোর্স | platform, language, level, access period |
| `digital_design_assets` | ডিজাইন অ্যাসেট / টেমপ্লেট | asset type, file format, compatible software, license, included files |
| `digital_ebook_files` | ই-বুক / ডিজিটাল ফাইল | file type, language, format, page/size, usage license |
| `digital_game_service` | গেম সার্ভিস | game, service type, platform, completion window, buyer requirements |

প্রতিটি template admin panel থেকে edit করা যাবে। Category name, English name, description, icon key, order, active/inactive state এবং specification field-গুলো hardcoded নয়; এগুলো Supabase table-এ থাকে।

## ৪. Seller form-এ এখন যে অপশনগুলো রয়েছে

Seller form এখন শুধু digital listing-এর জন্য কাজ করে। Seller প্রথমে category নির্বাচন করলে সেই category-এর template অনুযায়ী required এবং optional field দেখা যায়। Field type হিসেবে text, textarea, number, select এবং boolean toggle ব্যবহার করা যায়। Required field frontend-এ submit বন্ধ করে এবং migration `052_digital_listing_server_validation.sql` একই validation database RPC-এর ভেতরেও করে; ফলে browser request পরিবর্তন করলেও incomplete listing সেভ হওয়ার কথা নয়।

প্রধান listing metadata-এর মধ্যে title, Bengali description, BDT price, optional original price, condition, product images এবং YouTube video URL রয়েছে। Digital terms অংশে delivery type হিসেবে instructions, license/activation key এবং download link আছে। এছাড়া region code, subscription period, warranty/replacement period, fulfillment window, buyer delivery tutorial এবং seller delivery note রাখা যায়।

| Stock / delivery control | আচরণ |
|---|---|
| `UNLIMITED` | Instructions, download link বা সাধারণ digital content-এর জন্য ব্যবহারযোগ্য |
| `QUANTITY` | Fixed quantity listing; server-side quantity শূন্যের বেশি হতে হবে |
| `KEY_POOL` | License-key delivery-এর জন্য; প্রতি লাইনে একটি key দিয়ে existing listing-এ batch inventory যোগ করা যায় |
| Automatic delivery | Payment escrow-এ যাওয়ার পর delivery flow-এর সঙ্গে যুক্ত |
| Out of stock deactivation | Stock শেষ হলে listing inactive/hidden করার seller preference |
| Fulfillment window | Buyer expectation এবং seller delivery timing-এর জন্য মিনিটে সংরক্ষিত |

`KEY_POOL` নির্বাচন করলে server-side validation নিশ্চিত করে যে delivery type অবশ্যই `LICENSE_KEY` এবং সংশ্লিষ্ট digital delivery content আগে সংরক্ষিত আছে। Secret key public product page বা public catalogue-এ দেখানো হয় না।

## ৫. Buyer-facing ProductDetail পরিবর্তন

Approved, visible digital product-এর ক্ষেত্রে buyer এখন public product page-এ category-specific non-secret specifications দেখতে পারে। যেমন game account-এর server বা rank, software license-এর edition ও মেয়াদ, gift card-এর region/value এবং design asset-এর file format বা license type।

Secret delivery text, license key, account access বা download credential public query-তে রাখা হয়নি। এগুলো existing authenticated order/library delivery path-এ থাকে এবং buyer-এর নিজের order ownership যাচাই হওয়ার পরেই দেখা যায়।

## ৬. Admin panel পরিবর্তন

Admin Catalogue-এর Categories view-এ এখন প্রতিটি category-এর পাশে template তৈরি বা edit করার option আছে। Template editor থেকে Bengali name, English name, description, icon key, sort order, active state এবং field definitions সম্পাদনা করা যায়। প্রতিটি field-এর key, Bengali label, type, required/optional state এবং select options admin নির্ধারণ করতে পারে।

এই কাজগুলো direct browser table write নয়। Admin action Firebase-authenticated gateway দিয়ে permission-scoped RPC-তে যায়। নতুন RPC দুটির public execution revoke করা হয়েছে এবং শুধু server-side `service_role` execution রাখা হয়েছে:

- `admin_list_digital_category_templates`
- `admin_upsert_digital_category_template`

Product approval, seller verification approval, admin audit history এবং archived physical record visibility আগের নিরাপত্তা নিয়মেই রাখা হয়েছে। Admin পুরনো physical record দেখতে পারবে, কিন্তু সেটিকে digital public catalogue-এ restore বা approve করতে পারবে না।

## ৭. Database ও security পরিবর্তন

তিনটি migration version করা হয়েছে এবং live project-এ সফলভাবে apply হয়েছে।

| Migration | Live ফলাফল |
|---|---|
| `050_z2u_style_digital_listing_options.sql` | Digital template, structured specs, stock/auto-delivery fields, public-safe policy এবং seller/admin RPC তৈরি হয়েছে |
| `051_digital_listing_advisor_hardening.sql` | `product_digital_specs`-এর permissive policy overlap সরানো হয়েছে এবং নতুন foreign-key covering indexes যোগ হয়েছে |
| `052_digital_listing_server_validation.sql` | Required category fields, quantity stock, key-pool compatibility এবং admin Bengali category-name persistence server-side enforce হয়েছে |

নতুন গুরুত্বপূর্ণ table দুটির মধ্যে `digital_category_templates`-এ active templates থাকে এবং `product_digital_specs`-এ buyer-safe structured specification ও seller terms থাকে। `product_digital_specs`-এর public SELECT policy শুধু approved, visible, digital product-এর specification প্রকাশ করে। Insert, update ও delete public role-এর জন্য blocked এবং Firebase-verified server gateway service-role client দিয়ে RPC চালায়।

Seller option endpoint হলো existing single catch-all Vercel gateway-এর ভেতরে `/api/seller-listing-options`; নতুন serverless function যোগ করা হয়নি। Seller product create/update-ও Firebase-protected `/api/seller-product` path-এর মাধ্যমে চলে। ফলে Vercel Hobby function limit অতিক্রম হয়নি।

## ৮. Live Supabase verification

Migration 050 apply করার পরে read-only smoke query-তে নিম্নের অবস্থা পাওয়া গেছে:

| Live metric | ফলাফল |
|---|---:|
| Digital category template | ১২টি |
| Active template | ১২টি |
| মোট configured specification field | ৫৬টি |
| Existing `product_digital_specs` rows | ০টি |
| Existing license-key inventory rows | ০টি |
| `admin_list_digital_category_templates` public execution | বন্ধ |
| `admin_upsert_digital_category_template` public execution | বন্ধ |
| `seller_upsert_digital_listing_options` public execution | বন্ধ |
| Service-role execution | চালু |

`product_digital_specs` এবং license inventory row শূন্য থাকা স্বাভাবিক; কোনো seller নতুন Z2U-style listing save বা key batch upload না করা পর্যন্ত এই tables-এ নতুন row তৈরি হবে না। আমি কোনো real purchase, payout, refund বা inventory key upload test চালাইনি, তাই live financial state পরিবর্তন করা হয়নি।

## ৯. Validation ও test ফলাফল

| Test | ফলাফল |
|---|---|
| `npm run build` | সফল |
| TypeScript compile | সফল |
| Vite production bundle | সফল |
| `npm run lint` | ০ error; শুধু আগের `AuthContext.tsx` Fast Refresh warning আছে |
| `git diff --check` | সফল |
| Z2U-style seller form type integration | সফল build |
| Buyer structured-spec rendering | সফল build |
| Admin template editor integration | সফল build |
| Live migration 050 | সফলভাবে applied |
| Live migration 051 | সফলভাবে applied |
| Live migration 052 | সফলভাবে applied |
| Sensitive RPC grant verification | anon/authenticated execution বন্ধ, service-role চালু |
| Supabase security advisor focused recheck | নতুন `product_digital_specs` policy-overlap finding আর নেই |
| Supabase performance advisor focused recheck | নতুন category parent এবং license-inventory indexes যুক্ত হয়েছে; অবশিষ্ট findings মূল project-এর পুরনো/global advisor notices |

Supabase advisors-এ project-wide কিছু পুরনো INFO/WARN notice এখনও আছে, যেমন বহু পুরনো function-এর mutable `search_path` এবং কিছু legacy foreign-key index। এগুলো migration 050-এর নতুন category form থেকে তৈরি নয়। নতুন `product_digital_specs` policy overlap migration 051-এ ঠিক করা হয়েছে।

## ১০. GitHub commit ও deployment

Implementation commit: `dcf3429` — `Add Z2U-style digital listing options`  
Advisor hardening commit: `c806922` — `Harden digital listing policies and indexes`  
Server validation commit: `483ca8e` — `Validate digital listing specs on the server`

সব commit `origin/main`-এ push করা হয়েছে। Vercel-এ নতুন commit থেকে deployment trigger হওয়ার কথা। Production deployment page-এ build status এবং runtime environment variables একবার যাচাই করা উচিত, বিশেষ করে `FIREBASE_SERVICE_ACCOUNT_JSON`, `SUPABASE_SERVICE_ROLE_KEY` এবং existing Firebase/Supabase public variables।

## ১১. গুরুত্বপূর্ণ সীমাবদ্ধতা ও পরবর্তী নিরাপদ ধাপ

এই iteration-এ Z2U-এর documented form concepts এবং BikriKoro-এর digital-only marketplace contract বাস্তবায়ন হয়েছে; Z2U-এর private categories, internal seller tools বা proprietary code কপি করা হয়নি। Category templates seeded হলেও প্রতিটি live listing-এর জন্য seller-কে নিজের পণ্যের সঠিক specification, delivery content এবং stock/key inventory দিতে হবে।

পরবর্তী controlled QA হিসেবে একটি approved seller account দিয়ে একটি low-value digital test listing তৈরি করা, একটি `INSTRUCTIONS` delivery এবং একটি `LICENSE_KEY` key-pool listing তৈরি করা, তারপর sandbox/controlled payment path-এ buyer order দিয়ে `ESCROW_HELD → DIGITAL_DELIVERED → COMPLETED` flow যাচাই করা উচিত। এই test-এ real money ব্যবহার না করে payment provider-এর test/safe mode বা manually approved internal test product ব্যবহার করা উচিত।

## References

[1]: https://www.z2u.com/faq/How-do-I-create-and-manage-listing.html "Z2U — How do I create and manage listing"

[2]: https://www.z2u.com/faq/seller-rules.html "Z2U — Seller rules"

[3]: https://www.z2u.com/de/faq/tutorial-of-z2u-automatic-delivery-system.html "Z2U — Tutorial of automatic delivery system"

[4]: https://www.z2u.com/faq/product-specification-guidelines-when-creating-listing.html "Z2U — Product specification guidelines when creating listing"
