# Seller Dashboard Mobile Responsive Fix

## সমস্যার কারণ

User-provided mobile screenshot-এ Quick Actions section দুইটি fixed column-এ render হচ্ছিল। Phone viewport-এ প্রতিটি card-এর minimum width না কমায় দ্বিতীয় column screen-এর বাইরে চলে যায় এবং পুরো page-এ horizontal overflow তৈরি হয়। Seller navigation-ও mobile-এ horizontal content ধরে রাখছিল।

## কী ঠিক হয়েছে

| অংশ | সংশোধন |
|---|---|
| Quick Actions | Phone width-এ এক column, `sm` breakpoint-এ দুই column এবং wide desktop-এ ছয় column। প্রতিটি action card-এ `min-w-0` দেওয়া হয়েছে। |
| Metric cards | Phone width-এ এক column, `sm` breakpoint-এ দুই column এবং desktop-এ চার column। |
| Seller navigation | Phone width-এ দুই-column compact navigation; tablet-এ scrollable row; desktop-এ vertical sidebar। ফলে sidebar-এর জন্য page-wide overflow হয় না। |
| Main shell | Seller dashboard wrapper ও main content-এ `w-full`, `min-w-0`, `max-w-full` এবং `overflow-x-hidden` guard যোগ হয়েছে। |
| Data/security | কোনো data query, seller approval gate, wallet flow, order flow বা permission পরিবর্তন করা হয়নি। |

## Verification

`npm run build` সফল হয়েছে। `npm run lint`-এ ০ error; আগের `AuthContext` Fast Refresh warning অপরিবর্তিত আছে। `git diff --check` সফল। Static layout assertion-এ phone-first `grid-cols-1`, `sm:grid-cols-2` Quick Actions ও metric layout এবং mobile navigation collapse পাওয়া গেছে। Local unauthenticated route check-এ `/seller/dashboard` এখনও `/login`-এ redirect করে। Authenticated mobile browser session না থাকায় live seller data-সহ সম্পূর্ণ scroll screenshot পরীক্ষা করা যায়নি; তবে screenshot-এ দেখা fixed two-column overflow source সরিয়ে responsive guards যোগ করা হয়েছে।
