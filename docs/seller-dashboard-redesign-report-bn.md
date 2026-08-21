# BikriKoro Seller Dashboard Redesign Report

**Release:** Seller Dashboard premium workspace redesign  
**Source brief:** User-provided `/home/ubuntu/upload/pasted_content.txt` and the supplied Shopee-style dashboard reference image.  
**Scope:** Bengali, digital-only seller workspace with live Firebase/Supabase data and no invented marketplace records.

## নতুন dashboard-এর গঠন

| অংশ | কী দেখা যায় |
|---|---|
| Seller Centre navigation | ড্যাশবোর্ড, আমার লিস্টিং, অর্ডার, মেসেজ, ওয়ালেট ও নোটিফিকেশন—বর্তমান protected routes-এ সরাসরি যাওয়ার responsive sidebar/tab navigation। |
| Seller profile hero | Live shop name/name, profile photo, shop description, verified badge, rating/review count, active product count এবং member-since date। Profile editor খুলে বর্তমান shop-profile fields পরিবর্তন করা যায়। |
| Metric cards | আজকের বিক্রি, এই মাসের বিক্রি, মোট বিক্রি, wallet balance, pending orders, completed orders, মোট product এবং listing views। এগুলো live completed/seller order, seller product ও protected wallet response থেকে হিসাব হয়। |
| Sales overview | গত ৭ দিনের completed digital order থেকে তৈরি compact bar chart। Order না থাকলে কোনো zero-filled demo graph নয়; সত্যিকারের empty state দেখায়। |
| Wallet summary | Protected `order-read` wallet branch ব্যবহার করে available balance, reserved amount এবং withdrawable/spendable balance। Withdraw action আগের Wallet page-এ থাকে; নতুন কোনো financial mutation তৈরি করা হয়নি। |
| Recent orders | Protected `/api/order-read` list response থেকে seller-এর recent order, product image/title, BDT amount, created time এবং digital status। Pending payment, escrow, digital delivery, completed, cancelled, dispute ও refund status আলাদা label/tone-এ দেখানো হয়। |
| Notifications | In-app notification preview এবং authoritative unread-count helper। Order, payment, chat, verification ও wallet update-এর জন্য বর্তমান notification system-ই ব্যবহৃত হয়েছে। |
| Product performance | Completed order history থেকে best-selling product এবং বাস্তব sales amount/order count। কোনো completed sale না থাকলে honest empty state। |
| Seller performance | Rating, view-to-sale conversion, active product এবং approval queue—শুধু বর্তমান live data থেকে। |
| Quick actions | নতুন digital product, listing management, orders, chat, wallet withdrawal এবং Seller Education-এর সরাসরি route। |
| Export | Live dashboard metrics-এর CSV export; sample order/product বা fake balance export করা হয় না। |

## কোন requested field ইচ্ছাকৃতভাবে বানানো হয়নি

Pasted brief-এ followers, seller level, cover banner, visitor count, country analytics, wishlist/click analytics, response rate, customer satisfaction, delivery rate, cancellation percentage, achievement badge, referral earnings, flash-sale manager, recent visitors এবং top search keywords চাওয়া হয়েছে। বর্তমান BikriKoro schema/API-তে এসবের নির্ভরযোগ্য live source পাওয়া যায়নি। তাই এই release-এ এগুলোর fake number, demo chart বা invented customer record দেখানো হয়নি। UI-তে performance note দিয়ে বলা হয়েছে যে এই data এখনো সংযুক্ত নয়।

> Dashboard-এ দেখানো প্রতিটি টাকা, order, product, view, rating ও notification বাস্তব authenticated seller data থেকে আসে। Data না থাকলে empty state দেখায়—reference screenshot-এর Wireless Headphone, Smart Watch, sample order, fake wallet balance বা made-up percentage ব্যবহার করা হয়নি।

## Security ও compatibility

Seller access আগের `useIsSeller` approval gate-এর মধ্যেই আছে। Seller order data existing Firebase-protected `/api/order-read` gateway থেকে আসে, wallet data একই gateway-এর wallet action থেকে আসে, এবং notification data existing marketplace helper ব্যবহার করে। কোনো Firebase service-account credential, Supabase service-role key অথবা secret environment variable browser code-এ যোগ করা হয়নি। Vercel-এর একটিমাত্র catch-all gateway অক্ষুণ্ণ আছে; নতুন serverless function বা migration প্রয়োজন হয়নি। Digital-only order states এবং UddoktaPay checkout অপরিবর্তিত রাখা হয়েছে।

## Verification

`npm run build` সফল হয়েছে। `npm run lint`-এ ০ error এবং আগের `AuthContext` Fast Refresh warning রয়েছে। Static scan-এ sample products, fake wallet figures, physical/COD/free-shipping dashboard assumptions এবং secret credential references পাওয়া যায়নি। Local browser check-এ `/seller/dashboard` unauthenticated অবস্থায় সঠিকভাবে `/login`-এ redirect করেছে।

## মূল implementation

প্রধান পরিবর্তন `src/pages/SellerDashboard.tsx`-এ। Existing `ShopProfileEditor`, `Wallet`, `Notifications`, `MyListings`, `Orders`, `Seller Education` এবং protected order/wallet APIs পুনঃব্যবহার করা হয়েছে। কোনো নতুন dashboard-only database table বা fake analytics seed করা হয়নি।

## References

[1]: https://www.bikrikoro.com/seller/dashboard "BikriKoro Seller Dashboard"

[2]: https://www.bikrikoro.com/seller-education "BikriKoro Seller Education Hub"

[3]: https://github.com/mrariyanahmad-eng/Bikrikoro.com "BikriKoro.com GitHub repository"
