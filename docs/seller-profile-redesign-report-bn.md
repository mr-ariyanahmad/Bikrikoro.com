# BikriKoro Seller Profile Redesign Report

## উদ্দেশ্য

`pasted_content_2.txt`-এর Shopee, Z2U, Etsy, Fiverr ও Envato-inspired brief অনুযায়ী public Seller Profile page-কে নতুন করে premium, clean, mobile-first এবং trust-focused করা হয়েছে। Page-এ কেবল public seller data, approved digital product এবং public review data ব্যবহার করা হয়েছে। কোনো phone, email, private verification document, demo product বা invented seller metric প্রকাশ করা হয়নি।

## নতুন public profile surface

| অংশ | বাস্তবায়ন |
|---|---|
| Cover banner | Seller-specific cover field বর্তমানে schema-তে নেই, তাই branded BikriKoro green gradient cover ব্যবহার করা হয়েছে; কোনো fake seller-uploaded image দেখানো হয়নি। |
| Seller header | Public shop name, owner name, profile photo, verified seller badge, rating/review count, active digital product count এবং member-since date। |
| Seller trust | Verification status, digital catalogue activity, review history এবং BikriKoro-তে থাকার বছর—শুধু live fields থেকে। ব্যক্তিগত identity document বা email/phone trust proof দেখানো হয়নি। |
| Shop summary | Rating, product count, total public product views এবং review count। Sales total, followers, response rate ও delivery score-এর source না থাকায় এগুলো দেখানো হয়নি। |
| Buyer actions | Follow Shop existing `toggle_seller_follow` RPC-তে, Chat Now existing secure `find_or_create_chat_thread` RPC-তে, Share Shop native share/clipboard-এ এবং Report button truthful explanation dialog-এ। Shop-level report RPC বর্তমানে নেই; product সমস্যা হলে product page report flow ব্যবহার করতে বলা হয়। |
| About section | Seller-এর live `shop_description` এবং admin/seller-published content; description না থাকলে honest empty state। |
| Product catalogue | Seller-এর শুধু `is_digital = true`, `is_hidden = false`, `approval_status = APPROVED` product loaded হয়। Search এবং সব, জনপ্রিয়, নতুন, কম দাম, বেশি দাম filter আছে। |
| Product cards | Existing ProductCard reuse করা হয়েছে, যাতে image, BDT price, discount, escrow protection, digital delivery badge, favorite/compare এবং product detail route একই থাকে। |
| Reviews | সর্বশেষ public review, buyer name, product title, rating, comment ও date। Verified purchase/photo/video review field বর্তমান Review type-এ না থাকায় সেগুলোর badge বা media claim করা হয়নি। |
| Mobile | Sticky bottom Follow ও Chat Seller action bar, responsive product grid, touch-friendly search/filter এবং wrapped profile actions। |

## ইচ্ছাকৃতভাবে বানানো হয়নি

Brief-এ seller level, Bronze/Silver/Gold/Platinum, trust score ০–১০০, mobile/email/payment/business verification breakdown, last active, location, total sales, followers/following, response rate, average response time, delivery success, cancellation rate, repeat customers, achievements, gallery, social links, coupons, flash sales, live visitor count, wishlist counter, QR code ও call seller চাওয়া হয়েছে। বর্তমান public schema বা RPC-তে এসবের নির্ভরযোগ্য live source নেই। তাই page-এর শেষ অংশে buyer-কে সৎভাবে জানানো হয় যে এই তথ্য বর্তমানে প্রকাশিত নয়।

> Screenshot বা reference-এর মতো visual trust তৈরি করা হয়েছে, কিন্তু কোনো trust score, sales count বা follower counter অনুমান করে দেখানো হয়নি।

## Privacy ও security

আগের `select('*')` বাদ দিয়ে profile-এর explicit public fields ব্যবহার করা হয়েছে: `id`, `name`, `photo_url`, `shop_name`, `shop_description`, `is_verified`, `rating`, `review_count` এবং `created_at`। Product query-তেও explicit public columns এবং digital/approved/visible filter আছে। Buyer-seller chat protected RPC-তে যায়; follow existing RPC-তে যায়; কোনো নতুন direct chat write বা private profile field access যোগ করা হয়নি।

## Verification

`npm run build` সফল হয়েছে। `npm run lint`-এ ০ error এবং আগের `AuthContext` Fast Refresh warning রয়েছে। `git diff --check` ও static privacy/demo scan সফল। Local public seller route নতুন renderer-এ পৌঁছেছে; local Supabase data unavailable থাকায় সে environment-এ truthful profile-load error state দেখা গেছে, fake seller data নয়। Production Supabase data deploy-এর পর authenticated browser session ছাড়াই public route যাচাই করা যাবে।

## References

[1]: https://www.bikrikoro.com "BikriKoro.Com"

[2]: https://github.com/mrariyanahmad-eng/Bikrikoro.com "BikriKoro.com GitHub repository"
