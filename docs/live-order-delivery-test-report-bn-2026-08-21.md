# BikriKoro লাইভ Order ও Automatic Digital Delivery Test Report

**পরীক্ষার তারিখ:** ২১ আগস্ট ২০২৬, GMT+8  
**ডাটাবেস:** Bikrikoro Supabase project (`lrwvbwkkapmwehvxkqlt`)  
**Project status:** `ACTIVE_HEALTHY`  
**Region:** `ap-southeast-1`  
**পরীক্ষার ধরন:** Read-only production inspection; কোনো order, delivery, wallet, payout, refund বা dispute record পরিবর্তন করা হয়নি।

## ১. পরীক্ষার উদ্দেশ্য

এই পরীক্ষার উদ্দেশ্য ছিল লাইভ database-এ বর্তমানে কতগুলো order কোন state-এ আছে, automatic digital delivery record তৈরি হয়েছে কি না, delivery content ready কি না, escrow থেকে digital delivery state-এ transition সঠিকভাবে কাজ করেছে কি না, এবং duplicate বা missing delivery-এর মতো anomaly আছে কি না—এসব যাচাই করা। Secret delivery text, license key, buyer UID এবং seller UID রিপোর্টে আনা হয়নি। Order reference কেবল শনাক্ত করার সুবিধার জন্য প্রথম ৮টি অক্ষর হিসেবে দেখানো হয়েছে।

## ২. লাইভ Order State Summary

| Order state | সংখ্যা | ব্যাখ্যা |
|---|---:|---|
| `ESCROW_HELD` | ১ | একটি wallet-paid order escrow-এ আছে এবং তার digital delivery record `READY` |
| `CANCELLED` | ৩ | তিনটি পুরনো cancelled order; এগুলোর payment method `UNSET` এবং কোনো delivery record নেই |
| `DIGITAL_DELIVERED` | ০ | বর্তমানে কোনো order এই state-এ নেই |
| `COMPLETED` | ০ | বর্তমানে কোনো payout-eligible completed order নেই |
| `DISPUTED` | ০ | কোনো active dispute state পাওয়া যায়নি |
| `REFUNDED` | ০ | কোনো refunded order পাওয়া যায়নি |

লাইভ database-এ মোট **৪টি order** পাওয়া গেছে। এর মধ্যে ১টি বর্তমানে paid wallet order হিসেবে escrow-এ আছে; বাকি ৩টি cancelled এবং unpaid/`UNSET` payment-method state-এ আছে।

## ৩. সাম্প্রতিক Order ও Delivery Records

| Order reference | Order state | Payment | Delivery state | Delivery type | Order time (UTC) | Delivery time (UTC) |
|---|---|---|---|---|---|---|
| `25083ede` | `ESCROW_HELD` | `WALLET` | `READY` | `INSTRUCTIONS` | ১৮ আগস্ট ২০২৬, ২৩:১৪:১৭ | ১৮ আগস্ট ২০২৬, ২৩:১৪:১৭ |
| `9877c9cb` | `CANCELLED` | `UNSET` | কোনো record নেই | — | ১৮ আগস্ট ২০২৬, ২৩:১৩:০৬ | — |
| `168e40b9` | `CANCELLED` | `UNSET` | কোনো record নেই | — | ১৮ আগস্ট ২০২৬, ১৭:৩৮:০৭ | — |
| `89368d5c` | `CANCELLED` | `UNSET` | কোনো record নেই | — | ১৮ আগস্ট ২০২৬, ১৬:৫১:১৪ | — |

`25083ede` order-এর product digital, visible এবং approved অবস্থায় আছে। Delivery record-এর content readiness পরীক্ষায় `INSTRUCTIONS` type-এর ১টি record এবং non-empty delivery content পাওয়া গেছে। রিপোর্টে সেই content প্রকাশ করা হয়নি।

## ৪. Automatic Delivery Readiness Test

| Test | ফলাফল | বর্তমান observation |
|---|---|---|
| Escrow order-এর delivery record আছে কি না | PASS | `ESCROW_WITHOUT_DELIVERY = 0` |
| Delivery record `READY` কি না | PASS | ১টি `READY` record |
| Delivery content empty কি না | PASS | ১টি `INSTRUCTIONS` content non-empty |
| একই order-এর duplicate delivery আছে কি না | PASS | `DUPLICATE_DELIVERY_ORDER = 0` |
| `DIGITAL_DELIVERED` order-এর delivery record ready কি না | PASS | এমন কোনো order নেই; mismatch `0` |
| Escrow থেকে delivery promotion সম্পন্ন হয়েছে কি না | ATTENTION REQUIRED | `ESCROW_READY_NOT_PROMOTED = 1` |
| License inventory readiness | N/A | বর্তমানে license inventory row পাওয়া যায়নি; active deliveryটি `INSTRUCTIONS` type |

## ৫. গুরুত্বপূর্ণ Anomaly: `ESCROW_HELD` কিন্তু Delivery `READY`

একটি order—reference `25083ede`—এর বর্তমান অবস্থা হলো:

| Field | Value |
|---|---|
| Order state | `ESCROW_HELD` |
| Delivery state | `READY` |
| Delivery type | `INSTRUCTIONS` |
| `digital_delivered_at` | `NULL` |
| Delivery `delivered_at` | ১৮ আগস্ট ২০২৬, ২৩:১৪:১৭ UTC |
| Product type | Digital |
| Product visibility | Visible |
| Product approval | Approved |

এটি নতুন delivery creation-এর failure নয়, কারণ delivery record তৈরি হয়েছে এবং `READY`। বরং এটি একটি **stale transition**: delivery ready হওয়ার পর order state `DIGITAL_DELIVERED`-এ promote হয়নি।

লাইভ trigger definition অনুযায়ী `sync_digital_delivery()` কেবল order insert হওয়ার সময় বা order status পরিবর্তন করে `ESCROW_HELD` হওয়ার সময় `ensure_digital_delivery()` চালায়। তাই migration apply হওয়ার আগেই তৈরি হওয়া order বা delivery record-এর জন্য trigger নিজে থেকে retroactive repair চালায় না। এই order-এর timestamp migration apply-এর আগের; সেই কারণে এটি historical pre-migration state হওয়ার সম্ভাবনা বেশি।

## ৬. Trigger ও Wallet Safety Verification

লাইভ database-এ নিচের logic পাওয়া গেছে:

> Order `ESCROW_HELD` হলে `sync_digital_delivery()` automatic delivery ensure করে। Delivery content ready হলে `ensure_digital_delivery()` order-কে `DIGITAL_DELIVERED` করার চেষ্টা করে।

> Wallet effect trigger `COMPLETED` হলে seller payout এবং `CANCELLED`/`REFUNDED` হলে buyer refund ledger entry তৈরি করে; একই order ও ledger type-এর duplicate entry আগে থেকেই থাকলে নতুন entry তৈরি করে না।

বর্তমান smoke query-তে নতুন `SELLER_PAYOUT` বা `ORDER_REFUND` ledger effect পাওয়া যায়নি। এটি expected, কারণ কোনো order এখনো `COMPLETED` বা `REFUNDED` নয়। আমি কোনো payout বা refund চালাইনি।

## ৭. Overall Test Verdict

| Area | Verdict |
|---|---|
| Current order data readable and consistent | PASS |
| Digital product condition for active escrow order | PASS |
| Automatic delivery record creation | PASS |
| Delivery content readiness | PASS |
| Duplicate delivery protection | PASS |
| Missing delivery protection | PASS |
| Escrow-to-`DIGITAL_DELIVERED` promotion for the existing historical record | NEEDS CONTROLLED REPAIR |
| Wallet duplicate-credit protection | PASS by trigger inspection; no settlement event executed |
| End-to-end live purchase test | NOT EXECUTED |

## ৮. নিরাপদ পরবর্তী করণীয়

এই report অনুযায়ী production-এ একটি controlled repair দরকার, তবে সেটি সরাসরি এখন চালানো হয়নি যাতে আপনার অনুমতি ছাড়া existing order state পরিবর্তন না হয়। Repair-এর scope কেবল সেই order-গুলো হওয়া উচিত যেখানে `orders.status = 'ESCROW_HELD'`, সংশ্লিষ্ট `digital_deliveries.status = 'READY'`, এবং product digital ও approved। Repair-এ একই idempotent transition ব্যবহার করে `DIGITAL_DELIVERED` এবং `digital_delivered_at` set করতে হবে; কোনো delivery text, license key বা wallet ledger স্পর্শ করা উচিত নয়।

তারপর একটি low-value controlled test order চালিয়ে নিচের sequence পর্যবেক্ষণ করা উচিত: `PENDING_PAYMENT → ESCROW_HELD → DIGITAL_DELIVERED → COMPLETED`। Buyer confirmation-এর আগে seller payout না হওয়া এবং completion-এর পরে একবারের বেশি payout না হওয়া যাচাই করতে হবে। এই test purchase, repair অথবা payout আমি এই রিপোর্ট তৈরির সময় চালাইনি।

## ৯. পরীক্ষার সীমাবদ্ধতা

এই রিপোর্ট database state inspection-এর ফল, full browser checkout simulation নয়। Firebase login, UddoktaPay callback, wallet deduction, seller delivery action এবং buyer confirmation-এর real end-to-end test চালানো হয়নি, কারণ সেগুলো production mutation তৈরি করে। তাই বর্তমান report live data consistency, trigger definition, readiness এবং anomaly detection প্রমাণ করে; real-money transaction success প্রমাণ করে না।

**রিপোর্টের উপসংহার:** Automatic delivery record বর্তমানে সঠিকভাবে আছে এবং কোনো missing বা duplicate delivery পাওয়া যায়নি। তবে একটি pre-existing `ESCROW_HELD + READY` order `DIGITAL_DELIVERED` state-এ promote হয়নি। এটি controlled, narrowly scoped data repair-এর জন্য চিহ্নিত করা হয়েছে; wallet বা payout data-তে কোনো পরিবর্তন করা হয়নি।
