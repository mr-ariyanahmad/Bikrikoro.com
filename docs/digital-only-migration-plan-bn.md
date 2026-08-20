# BikriKoro DIGITAL-only marketplace migration plan

## সিদ্ধান্ত

BikriKoro-এর নতুন marketplace হবে **শুধু digital key/file/service marketplace**। Existing physical products ও physical orders মুছে ফেলা হবে না; সেগুলো archive/hidden হয়ে history, accounting, dispute evidence এবং admin audit-এর জন্য থাকবে। Public catalogue, নতুন listing, checkout, delivery এবং seller workflow-এ শুধু DIGITAL পণ্য অনুমোদিত হবে।

## সংরক্ষণ নীতি

| রেকর্ড | নতুন আচরণ | পুরনো রেকর্ড |
|---|---|---|
| Physical product | নতুন করে তৈরি/এডিট/প্রকাশ করা যাবে না | `is_hidden=true`/archived; admin history-তে থাকবে |
| Physical order | নতুন physical checkout নিষিদ্ধ | সম্পূর্ণ order history ও status অপরিবর্তিত থাকবে |
| Physical category | public digital catalogue-এ দেখানো হবে না | admin archive/report-এ থাকবে |
| Seller verification | digital seller approval বাধ্যতামূলক | আগের approval/audit history থাকবে |
| Wallet ledger | escrow release ও payout idempotent হবে | পুরনো ledger delete হবে না |

## Digital order state machine

নতুন digital order-এর নিরাপদ flow হবে:

`PENDING_PAYMENT → ESCROW_HELD → DIGITAL_DELIVERED → COMPLETED`

Buyer delivery পাওয়ার পরে নির্দিষ্ট সময়ের মধ্যে সমস্যা report করতে পারবে। Dispute খুললে escrow release স্থগিত থাকবে:

`DIGITAL_DELIVERED → DISPUTED → COMPLETED অথবা REFUNDED`

Payment callback, delivery creation, buyer confirmation, dispute resolution ও wallet credit—প্রতিটি operation idempotency key এবং row lock দিয়ে সুরক্ষিত হবে। কোনো browser-supplied seller/buyer ID trust করা হবে না; Firebase token থেকে verified UID নেওয়া হবে।

## Delivery model

`LICENSE_KEY` হলে key inventory থেকে একটি unused key atomically claim হবে। `DOWNLOAD_LINK` বা protected file হলে buyer-owned delivery record তৈরি হবে এবং short-lived access URL দেওয়া হবে। `INSTRUCTIONS` হলে seller-provided text শুধু সফল payment ও buyer-owned order-এর জন্য প্রকাশ হবে। Raw digital secrets public product row বা public storage URL-এ রাখা যাবে না।

## Wallet ও escrow invariants

Seller wallet-এ credit কেবল payment verified এবং delivery/dispute window সফলভাবে শেষ হওয়ার পরে হবে। একই order-এ দুইবার credit, দুইবার delivery, দুইবার refund বা দুইবার withdrawal ledger entry তৈরি করা যাবে না। Admin risk review বা dispute pending থাকলে release বন্ধ থাকবে। Wallet balance কখনো negative হতে পারবে না এবং payout reservation available balance অতিক্রম করতে পারবে না।

## দ্রুত browsing/search

Public query কেবল `approval_status='APPROVED'`, `is_hidden=false` এবং `is_digital=true` rows পড়বে। `products`-এ category, approval, hidden এবং created-at/price indexes যোগ হবে। Search input debounce/controlled query ব্যবহার করবে; public page-এ private delivery content বা seller verification document query হবে না।

## বাস্তবায়নের দুইটি পথ

| পদ্ধতি | Trade-off | খরচ | Setup complexity |
|---|---|---|---|
| বর্তমান Vercel + Supabase architecture-এ database RPC, protected API gateway ও Supabase transaction ব্যবহার | বর্তমান auth/payment/domain বজায় থাকে; Vercel Hobby function limit ও gateway discipline বজায় রাখতে হবে | বর্তমান hosting plan অনুযায়ী | মাঝারি |
| আলাদা persistent backend/queue service ব্যবহার | Background queue, retries ও event processing বেশি শক্তিশালী; কিন্তু নতুন hosting, monitoring, secret management ও deployment দরকার | অতিরিক্ত hosting খরচ হতে পারে | বেশি |

প্রথম পদ্ধতিই বর্তমান project-এর জন্য নিরাপদ lighter-weight path। Digital delivery, escrow release ও wallet settlement transaction/RPC-এ করা যাবে; genuine external webhook বা long-running queue দরকার হলে পরে আলাদা worker যোগ করা হবে।

## Rollback

Migration প্রথমে additive columns, indexes, views এবং RPC তৈরি করবে। Existing physical records hard-delete হবে না। UI flag ও public-query filter আলাদা batch-এ যাবে। কোনো সমস্যা হলে digital-only UI rollback করলেও archived data ও old order lifecycle অক্ষত থাকবে।

## বাস্তবায়ন ক্রম

১. Additive schema/RPC migration এবং public digital-only read contract।

২. Protected digital delivery/escrow endpoints ও idempotency।

৩. Seller listing ও checkout থেকে physical controls অপসারণ।

৪. Orders, admin delivery, wallet, dispute ও customer UI পরিবর্তন।

৫. Build, lint, API route, SQL reference, auth, payment, wallet invariant এবং mobile regression test।
