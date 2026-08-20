# Demo Data Removal ও Education Hub Rollout Report

**প্রকল্প:** BikriKoro.com  
**পরিবর্তন:** Production data integrity, User Education Hub ও Seller Education Hub  
**ভাষা:** বাংলা  
**তারিখ:** ২১ আগস্ট ২০২৬

## সারসংক্ষেপ

BikriKoro-এর user-facing interface-এ যে তথ্য বাস্তব account, Supabase অথবা Firebase data থেকে আসার কথা, সেখানে আর অনুমানভিত্তিক demo record দেখানো হয় না। কোনো live row না থাকলে এখন honest empty state, loading state অথবা configuration message দেখানো হয়। এই পরিবর্তনের সঙ্গে live Supabase-এ বিস্তারিত Bengali User Education ও Seller Education content publish করা হয়েছে, যাতে buyer ও seller পুরো digital marketplace workflow এক জায়গায় বুঝতে পারেন।

## Demo বা অনুমানভিত্তিক তথ্যের সংশোধন

| এলাকা | সংশোধন |
|---|---|
| Home | Hard-coded `সাধারণ সদস্য` VIP status সরানো হয়েছে। Homepage এখন wallet, reward coins ও check-in data account/Supabase থেকে দেখায়; live product না থাকলে `এখনো কোনো পণ্য যোগ হয়নি` দেখায়। |
| Rewards | Live VIP field না থাকায় অনুমানভিত্তিক membership level বাদ দেওয়া হয়েছে। Coins, streak ও check-in status server-backed reward data থেকেই আসে। |
| Welcome splash | Digital-only marketplace অনুযায়ী Physical illustration ও location-centric demo claim সরিয়ে category, delivery, trusted seller ও digital payment guidance রাখা হয়েছে। |
| Admin dashboard | Hard-coded `OK` system status বাদ দেওয়া হয়েছে। Queue count না থাকলে live count-ই দেখানো হয়। |
| Contact page | Fake `+880 1XXX-XXXXXX` এবং fallback support email সরানো হয়েছে। Admin `public_support_email` ও `public_support_phone` publish করলে শুধু সেই real values দেখাবে; না থাকলে Help Center ও Order support path দেখাবে। |
| FAQ | Physical order, shipment, COD, free delivery ও free return-ভিত্তিক stale FAQ rows archive করা হয়েছে অথবা digital order flow অনুযায়ী সংশোধন করা হয়েছে। Historical physical order records code-level legacy handling-এ অপরিবর্তিত আছে, কারণ সেগুলো real historical data। |

## User Education Hub

User Education-এ account নিরাপত্তা, phone OTP/email/Google login, notification, digital product search, seller verification badge, product detail যাচাই, BDT checkout, `PENDING_PAYMENT`, `ESCROW_HELD`, automatic/manual delivery, Digital Library, delivery confirmation, dispute, review, wallet, reward এবং fraud warning বিস্তারিতভাবে লেখা হয়েছে। বিশেষভাবে বলা হয়েছে যে seller আগে থেকে inventory না রাখলে system নিজে থেকে account ID/password তৈরি করে না।

## Seller Education Hub

Seller Education-এ Digital seller হওয়ার আগে Personal, Business ও Company type নির্বাচন, type-specific NID/business/company document, sector checklist, authorized admin review, approval history, category-first listing, duplicate information এড়ানো, title/description/specification, stock mode, `UNLIMITED`, `QUANTITY`, `KEY_POOL`, automatic delivery inventory, manual delivery, product approval, order flow, wallet/payout, buyer chat, dispute evidence এবং seller safety checklist বিস্তারিতভাবে লেখা হয়েছে।

> **গুরুত্বপূর্ণ নিয়ম:** Auto delivery চালু করলেই system কোনো credential বানায় না। Seller-কে আগে থেকেই valid key, file, access instruction অথবা আলাদা account inventory রাখতে হবে। Inventory খালি থাকলে automatic delivery হবে না।

## Live Supabase verification

Migration `054_truthful_education_content` live project `lrwvbwkkapmwehvxkqlt`-এ সফলভাবে প্রয়োগ হয়েছে। পরবর্তী read-only query-তে `user-education` এবং `seller-education` উভয় row `PUBLISHED` পাওয়া গেছে। User Education body length ৪,১৭৪ character এবং Seller Education body length ৬,১৮২ character-এর live Bengali content বহন করছে। সংশোধিত digital FAQ rows-ও `PUBLISHED`, আর `faq-seller-shipped-delivered` ও `faq-free-delivery-cod-badge` `ARCHIVED` হয়েছে।

## Verification ফলাফল

`npm run build` সফলভাবে শেষ হয়েছে। `npm run lint`-এ ০ error এবং আগের `AuthContext` Fast Refresh warning রয়েছে। Static scan-এ নতুন hard-coded demo product, fake account বা placeholder support contact পাওয়া যায়নি। Local browser-এ homepage-এর truthful empty state ও payment strip দেখা গেছে। Local preview-তে Supabase environment না থাকায় education RPC error state দেখা গেছে; production URL-এ User Education content সফলভাবে load হয়েছে। Current code push এবং deployment-এর পরে নতুন digital-only splash-ও production-এ দেখা যাবে।

## পরিবর্তিত ফাইল ও migration

| ফাইল | ভূমিকা |
|---|---|
| `src/pages/Home.tsx` | Hard-coded VIP ও stale marketplace copy সরানো |
| `src/pages/RewardsHub.tsx` | Fake membership status সরিয়ে live reward explanation |
| `src/components/FirstVisitSplash.tsx` | Digital-only welcome visual |
| `src/pages/ContactUs.tsx` | Real admin-configured public contact অথবা honest empty state |
| `src/pages/admin/AdminSettings.tsx` | Public support email/phone admin-editable করা |
| `src/pages/admin/AdminDashboard.tsx` | Hard-coded system `OK` status সরানো |
| `supabase/migrations/054_truthful_education_content.sql` | Education content publish ও stale FAQ correction |

## References

[1]: https://www.bikrikoro.com/user-education "BikriKoro User Education Hub"

[2]: https://www.bikrikoro.com/seller-education "BikriKoro Seller Education Hub"

[3]: https://github.com/mrariyanahmad-eng/Bikrikoro.com "BikriKoro.com GitHub repository"
