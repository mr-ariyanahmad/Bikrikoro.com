# Seller Dashboard Duplicate Navigation and Wallet Contrast Fix

## সমস্যা

Mobile Seller Dashboard-এ Seller Centre navigation-এর পর Quick Actions section-এ একই Orders, Messages, Wallet, Listings ও Guide links আবার দেখানো হচ্ছিল। এতে একই কাজের জন্য দুইটি navigation surface তৈরি হয় এবং mobile page অপ্রয়োজনীয়ভাবে লম্বা হয়। Wallet card-এ `from-brand-600 to-brand-800` gradient-এর শেষ অংশ খুব হালকা দেখায়, তাই সেটি white/faded মনে হচ্ছিল।

## সমাধান

| অংশ | পরিবর্তন |
|---|---|
| Seller Centre | Dashboard, Listings, Orders, Messages, Wallet ও Notifications-এর একমাত্র পূর্ণ navigation surface হিসেবে রাখা হয়েছে। |
| Quick Actions | Duplicate navigation links সরিয়ে শুধু নতুন digital product, Shop profile এবং Seller guide রাখা হয়েছে। |
| Wallet card | Faded gradient সরিয়ে পুরো card-এ solid BikriKoro green (`bg-brand-700`) করা হয়েছে। Available, Reserved, Withdrawable ও wallet link-এর contrast অক্ষুণ্ণ রাখা হয়েছে। |
| Data and security | Wallet calculation, protected wallet endpoint, seller approval gate, order flow, payment flow এবং permissions পরিবর্তন করা হয়নি। |

## Verification

`npm run build` সফল হয়েছে। `npm run lint`-এ ০ error; আগের `AuthContext` Fast Refresh warning অপরিবর্তিত আছে। `git diff --check` সফল। Source assertion-এ Quick Actions-এ আর `/my-listings`, `/orders`, `/chat` বা `/wallet` duplicate links নেই; পূর্ণ navigation সেগুলো একবারই রাখে। Wallet card-এ solid `bg-brand-700` আছে।
