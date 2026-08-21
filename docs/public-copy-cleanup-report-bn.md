# BikriKoro Public Copy Cleanup Report

## উদ্দেশ্য

Buyer-facing এবং seller-facing marketplace surface থেকে implementation, schema, data-availability, configuration, migration, internal approval এবং sensitive-data ব্যাখ্যার ভাষা সরানো হয়েছে। Product listing page, public seller profile, footer এবং সংশ্লিষ্ট account/education surface-এ এখন কেবল ব্যবহারকারীর জন্য প্রয়োজনীয় পরিষ্কার Bengali বার্তা রাখা হয়েছে।

## পরিবর্তনের সারাংশ

| ফাইল/সারফেস | পরিবর্তন |
|---|---|
| `SellerProfile.tsx` | Seller trust-এর phone/email/sensitive-document ব্যাখ্যা সরানো হয়েছে; unavailable sales/followers/response-rate/source disclaimer সরানো হয়েছে; review empty state ছোট করে “এই seller-এর এখনো কোনো রিভিউ নেই।” করা হয়েছে; “এই profile-এ যা দেখানো হয় না” অংশ সম্পূর্ণ বাদ; report dialog-কে সাধারণ অভিযোগ জানানোর ভাষায় আনা হয়েছে; প্রধান action text Bengali করা হয়েছে। |
| `Products.tsx` | Supabase configuration, live data এবং English-mixed technical error notice সরিয়ে “পণ্য লোড করা যাচ্ছে না” ধরনের সাধারণ Bengali message করা হয়েছে; category/search/share/empty-state text Bengali করা হয়েছে। |
| `Layout.tsx` | Footer থেকে payment brand ও UddoktaPay payment-page implementation disclaimer সম্পূর্ণ সরানো হয়েছে। Payment method logos এবং সংক্ষিপ্ত নিরাপদ checkout guidance রাখা হয়েছে। |
| `BuyModal.tsx` | Checkout-এর admin review/escrow release implementation explanation সরিয়ে payment-এর পর digital library-তে পণ্য পাওয়ার সাধারণ buyer guidance রাখা হয়েছে। |
| `Home.tsx` | Homepage ও daily check-in error-এ Supabase configuration বা migration-এর উল্লেখ সরিয়ে সাধারণ Bengali status message রাখা হয়েছে। |
| `SellerDashboard.tsx` | Followers, country analytics, response rate ও buyer satisfaction-এর live-data disclaimer বাদ দেওয়া হয়েছে। |
| `BecomeSeller.tsx` | Firebase, secure gateway, manual admin approval, public catalogue এবং admin review wording সরিয়ে seller-এর জন্য প্রয়োজনীয় তথ্য, যাচাই ও digital delivery-এর পরিষ্কার ভাষা রাখা হয়েছে। |
| `Sell.tsx` | Listing প্রকাশের আগে admin review করে approve করবেন—এই internal process copy বদলে seller identity ও ব্যবসায়িক তথ্য যাচাইয়ের সাধারণ guidance রাখা হয়েছে। |
| `SellerVerification.tsx` | Firebase session, migration checklist এবং Admin review wording সরিয়ে neutral Bengali session, checklist ও correction message রাখা হয়েছে। |
| `PublicContentPage.tsx` | Raw backend error এবং “admin panel-এ প্রকাশ করা হয়নি” লেখা সরিয়ে সাধারণ page-load error ও empty state রাখা হয়েছে। ফলে About, Privacy, Help, FAQ, Return Policy ও Education routes-এ internal publishing copy নেই। |
| `EducationHub.tsx` | User/Seller Education empty state থেকে admin panel প্রকাশের উল্লেখ সরিয়ে সাধারণ “এই গাইডে এখনো কোনো অধ্যায় নেই” লেখা হয়েছে। |
| `RewardsHub.tsx` | Server-backed reward data, live field, অনুমানভিত্তিক status, migration এবং admin-review implementation wording সরানো হয়েছে; reward, check-in এবং buyer protection-এর ব্যবহারযোগ্য নির্দেশনা রাখা হয়েছে। |
| `Library.tsx` | Migration যাচাই করার error message সরিয়ে সাধারণ retry message রাখা হয়েছে। |

## যা ইচ্ছাকৃতভাবে রাখা হয়েছে

Payment logos, digital delivery, escrow, refund policy, privacy policy, seller verification এবং buyer protection-এর ব্যবহারযোগ্য তথ্য রাখা হয়েছে, কারণ এগুলো ক্রেতা বা সেলার কীভাবে সেবা ব্যবহার করবেন তা বোঝায়। তবে Supabase, Firebase, migration number, schema, RPC, live source, raw error, admin-panel publishing এবং unavailable metric-এর ব্যাখ্যা কোনো buyer-facing জায়গায় রাখা হয়নি।

Admin-only catalogue page-এর description-এ `approved digital listing` ও archive/history management-এর ভাষা রাখা হয়েছে, কারণ সেটি public buyer page নয় এবং admin-এর কাজ বোঝানোর জন্যই ব্যবহৃত হয়।

## যাচাই

`npm run build` সফল হয়েছে। `npm run lint`-এ **০ error** এবং আগের `AuthContext` Fast Refresh warning রয়েছে। `git diff --check` সফল হয়েছে। Public ও seller-facing source scan-এ screenshot-এ থাকা internal phrase-গুলো আর পাওয়া যায়নি; একমাত্র অবশিষ্ট match admin-only `AdminCatalogue.tsx` description, যা public page-এ render হয় না।

## পরিবর্তিত ফাইল

মোট ১৩টি source file পরিবর্তন করা হয়েছে:

`BuyModal.tsx`, `EducationHub.tsx`, `Layout.tsx`, `BecomeSeller.tsx`, `Home.tsx`, `Library.tsx`, `Products.tsx`, `PublicContentPage.tsx`, `RewardsHub.tsx`, `Sell.tsx`, `SellerDashboard.tsx`, `SellerProfile.tsx`, এবং `SellerVerification.tsx`।

## References

[1]: https://github.com/mrariyanahmad-eng/Bikrikoro.com "BikriKoro.com GitHub repository"

[2]: https://bikrikoro.com "BikriKoro.Com"
