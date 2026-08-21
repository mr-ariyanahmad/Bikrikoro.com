# BikriKoro Seller Card ও Shop Username Report

## কী পরিবর্তন করা হয়েছে

Product Detail page-এর নিচের বড় seller follow অংশটি সরিয়ে compact Shopee-style seller card করা হয়েছে। এখন seller-এর cover photo, profile photo, shop name, verified badge, rating, product count, follower count এবং seller badges একই card-এর ভেতরে থাকে। Seller-এর ছবি, নাম বা cover-এ ক্লিক করলে shop profile খোলে। আলাদা Visit button রাখা হয়নি; card-এর নিচে শুধু Follow button আছে।

Seller Profile page-এও seller-এর cover photo, shop username, সত্যিকারের follower count, product count এবং total views দেখানো হয়েছে। Follow বা Unfollow করার পর follower count UI-তে সঙ্গে সঙ্গে আপডেট হয় এবং database-এর `seller_follows` source of truth হিসেবে থাকে। Live lookup test-এ `shavora` shop-এর জন্য ১ জন follower, ১টি approved digital product এবং ৩৬টি view পাওয়া গেছে।

## Seller-এর জন্য editable branding

Seller Dashboard-এর shop profile editor এখন profile photo, cover photo, shop name, shop description এবং unique shop username সম্পাদনার সুযোগ দেয়। Profile ও cover ছবি বিদ্যমান storage flow ব্যবহার করে আপলোড হয়। Update request Firebase token যাচাই করে existing catch-all gateway-এর `/api/seller-profile` handler-এর মাধ্যমে সংরক্ষিত হয়; নতুন Vercel function যোগ করা হয়নি।

## Unique username ও onboarding flow

Digital seller verification form-এ এখন seller type ও documents-এর পাশাপাশি shop name এবং unique shop username নেওয়া হয়। Username ইংরেজি ছোট হাতের অক্ষর, সংখ্যা ও hyphen-এ normalize হয়। Username টাইপ করার সময় live availability check চলে; নেওয়া থাকলে ❎ status এবং alternative suggestion দেখা যায়। Shop name লেখার পর username খালি থাকলে shop name থেকে automatic suggestion তৈরি হয়। Username availability database unique index এবং `check_shop_username` function দিয়ে নিশ্চিত করা হয়েছে।

সফলভাবে submit হলে shop page-এর canonical URL হবে:

> `https://bikrikoro.com/seller/shop-username`

পুরোনো `/sellers/:id` route রাখা হয়েছে, তাই আগের link ভাঙবে না। নতুন username route একই SellerProfile page-এ lookup হয়।

## SEO পরিবর্তন

Seller Profile page-এ title, description, canonical URL, Open Graph title/description/image এবং Twitter card metadata যোগ করা হয়েছে। Server sitemap এখন approved digital product-এর পাশাপাশি সব active shop username-এর `/seller/:shop_username` URL প্রকাশ করে। ফলে নতুন shop গুলো আলাদা করে rebuild ছাড়াই sitemap-এর মাধ্যমে search engine discovery-এর জন্য প্রস্তুত থাকে।

## Live Supabase migrations

| Migration | উদ্দেশ্য | ফলাফল |
|---|---|---|
| `063_seller_usernames_public_profile.sql` | `shop_username`, `shop_cover_url`, unique index, availability RPC, public seller lookup RPC | সফলভাবে প্রয়োগ হয়েছে |
| `064_seller_onboarding_shop_username.sql` | username-সহ seller verification submission RPC | সফলভাবে প্রয়োগ হয়েছে |
| `065_readable_shop_username_backfill.sql` | বিদ্যমান profile handle seed | সফলভাবে প্রয়োগ হয়েছে |
| `066_fix_shop_username_case_backfill.sql` | username normalization correction | সফলভাবে প্রয়োগ হয়েছে |
| `067_correct_shop_username_normalization.sql` | lowercase-first readable handle correction | সফলভাবে প্রয়োগ হয়েছে |

বর্তমান live handle-এর উদাহরণ হিসেবে `Nasah Group Ltd` এখন `nasah-group-ltd`, `Hiplastics.my` এখন `hiplastics-my`, `Shavora` এখন `shavora`, এবং `Ariyan` shop এখন `amar-nam-ariyan` URL ব্যবহার করছে।

## যাচাইয়ের ফলাফল

`npm run build` সফল হয়েছে। `npm run lint`-এ ০ error; শুধু আগের `AuthContext` Fast Refresh warning আছে। `git diff --check` সফল। Live RPC test-এ username lookup, follower/product/view totals এবং unavailable username-এর suggestion—সব কাজ করেছে। Local browser route test-এ `/seller/shavora` React route-এ পৌঁছেছে; local sandbox-এ Firebase ও Supabase environment variables না থাকায় live data shell load করা যায়নি, তাই কোনো production-data সমস্যা হিসেবে সেটি গণ্য করা হয়নি।

## পরিবর্তিত প্রধান ফাইল

`src/components/SellerShopCard.tsx`, `src/components/ShopProfileEditor.tsx`, `src/pages/ProductDetail.tsx`, `src/pages/SellerProfile.tsx`, `src/pages/SellerVerification.tsx`, `src/pages/SellerDashboard.tsx`, `src/lib/shopProfile.ts`, `src/lib/verification.ts`, `server/api/seller-profile.ts`, `server/api/sitemap.xml.ts`, `api/[...route].ts`, `src/App.tsx`, এবং `src/types/product.ts`।

## References

[1]: https://github.com/mrariyanahmad-eng/Bikrikoro.com "BikriKoro.com GitHub repository"

[2]: https://bikrikoro.com/sitemap.xml "BikriKoro sitemap"
