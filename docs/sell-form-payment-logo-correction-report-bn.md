# Sell Form ও Payment Logo সংশোধন প্রতিবেদন

**প্রকল্প:** BikriKoro.com  
**ভাষা ও মুদ্রা:** বাংলা ও BDT  
**পরিবর্তনের ধরন:** Digital seller form ও payment display correction

## সমস্যার কারণ

Sell page-এ category নির্বাচন করার আগেই পণ্যের নাম, ছবি ও অন্যান্য তথ্য দেখানো হচ্ছিল। আবার কিছু digital category-তে `গেমের নাম`-এর মতো template field মূল পণ্যের নামের সঙ্গে একই তথ্য দ্বিতীয়বার চাইছিল। ফলে seller-এর কাছে title দুই জায়গায় দেখা যাচ্ছিল এবং form flow স্বাভাবিক লাগছিল না। একই সঙ্গে seller-facing copy-তে `Z2U-style`, `Product approval`, `Payment escrow`, `authenticated order view` এবং implementation-oriented English শব্দ চলে এসেছিল, যেগুলো customer বা seller-এর সরাসরি দেখার কথা নয়।

## কী কী সংশোধন করা হয়েছে

| এলাকা | সংশোধন |
|---|---|
| Category flow | এখন digital category-ই প্রথম ধাপ। Category বেছে নেওয়ার আগে বাকি listing fields দেখা যায় না। |
| Title | মূল পণ্যের নাম একবারই seller-এর কাছে দেখা যায়। `game_name` ধরনের duplicate template field UI থেকে বাদ দেওয়া হয়েছে; save করার সময় এটি নিরাপদভাবে মূল title থেকে পূরণ হয়। |
| Dynamic fields | Category বাছাই করার পরে সংশ্লিষ্ট category-এর অতিরিক্ত তথ্য দেখা যায়। Required-field validation আগের মতো server-side flow-এর সঙ্গে সামঞ্জস্যপূর্ণ আছে। |
| Seller copy | `Z2U-style`, `Product approval`, `Payment escrow`, `authenticated order view` ও অনুরূপ internal wording সরিয়ে স্বাভাবিক Bengali helper text দেওয়া হয়েছে। |
| Delivery section | Delivery, stock, region, subscription, warranty, fulfillment time এবং key pool-এর label সহজ Bengali ভাষায় দেখানো হয়েছে। |
| Payment logos | Footer ও BuyModal-এ text badge-এর পরিবর্তে local image asset ব্যবহার করা হয়েছে। bKash, Nagad, Rocket, Upay, City Bank, Islami Bank, Agrani Bank, Pubali Bank এবং UCB—সব নয়টি brand দেখানো হচ্ছে। |
| Fallback behavior | Admin settings-এ কোনো পুরনো payment JSON থাকলেও known brand name থেকে local logo path স্বয়ংক্রিয়ভাবে resolve হবে। নতুন বা custom method-এর ক্ষেত্রে নিরাপদ text fallback থাকবে। |
| Checkout security | Logo display-only। Customer checkout আগের `startUddoktaPayCheckout()` ও UddoktaPay hosted payment flow-তেই যায়; কোনো নতুন payment route যোগ করা হয়নি। |

## Auto-delivery সম্পর্কিত সীমা

এই UI seller-কে delivery content, key pool এবং stock model সঠিকভাবে পূরণ করার পথ দেখায়। Auto delivery চালু করলেও seller-এর আগে থেকে key, file link, instruction বা account credential inventory না থাকলে system কোনো delivery content তৈরি করবে না। Inventory খালি থাকলে automatic delivery সম্পন্ন হবে না—এই behavior পরিবর্তন করা হয়নি।

## নিরাপত্তা ও deployment যাচাই

Client source-এ Supabase service-role key, Firebase service account, private key বা server-only credential পাওয়া যায়নি। `VITE_FIREBASE_VAPID_KEY` কেবল browser push configuration হিসেবে আগের code path-এ রয়েছে। Vercel function count একটিই আছে: `api/[...route].ts`। Checkout route scan-এ UddoktaPay hosted checkout-ই পাওয়া গেছে।

## যাচাইয়ের ফলাফল

`npm run build` সফলভাবে সম্পন্ন হয়েছে। `npm run lint`-এ ০ error পাওয়া গেছে; আগের `AuthContext` Fast Refresh warning অপরিবর্তিত আছে। Local browser preview-তে footer-এ নয়টি local payment logo render হয়েছে। Unauthenticated অবস্থায় `/sell` route আগের মতো `/login`-এ redirect করেছে; authenticated seller session না থাকায় browser দিয়ে full form submission পরীক্ষা করা সম্ভব হয়নি।

## সংশ্লিষ্ট ফাইল

| ফাইল | ভূমিকা |
|---|---|
| `src/pages/Sell.tsx` | Category-first form, duplicate title suppression ও Bengali copy |
| `src/components/PaymentMethodBadges.tsx` | Footer ও checkout-এর reusable payment-logo renderer |
| `src/components/Layout.tsx` | Global payment logo strip |
| `src/components/BuyModal.tsx` | Checkout payment logo panel |
| `src/lib/publicSettings.ts` | Admin-configurable payment methods ও local-logo fallback |
| `public/payment-logos/` | নয়টি payment-brand image asset |

## References

[1]: https://www.bkash.com/ "bKash official website"

[2]: https://nagad.com.bd/bn/ "Nagad official website"

[3]: https://www.citybankplc.com/ "City Bank PLC official website"

[4]: https://www.islamibankbd.com/ "Islami Bank Bangladesh PLC official website"

[5]: https://www.dutchbanglabank.com/rocket/ "Dutch-Bangla Bank Rocket official page"
