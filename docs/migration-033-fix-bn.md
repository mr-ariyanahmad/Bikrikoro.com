# Migration 033 Error Fix

## Error

Supabase SQL Editor-এ migration 033 চালানোর সময় `operator does not exist: text = uuid` error দেখা গেলে এটি `notify_order_change()` বা related notification trigger-এর seller/buyer ID comparison-এর type mismatch। Firebase-UID schema-এ IDs text হলেও কিছু existing database schema-তে UUID type থাকতে পারে।

## কী ঠিক করা হয়েছে

Notification trigger-গুলোর comparison এখন explicit text cast ব্যবহার করে:

```sql
if new.seller_id::text <> new.buyer_id::text then
```

এই correction 013, 031 এবং 033 migration file-এ রাখা হয়েছে, যাতে পুরনো ও নতুন schema উভয়েই notification trigger compile হয়।

## Supabase SQL Editor-এ কী করবেন

1. পুরনো failed 033 query আর Run করবেন না।
2. Repository-এর corrected `supabase/migrations/033_order_lifecycle_hardening.sql` পুরোটা copy করে নতুন SQL Editor query-তে paste করুন।
3. পুরো corrected 033 একবার Run করুন। Migration-এর statements idempotent রাখা হয়েছে, তাই আগের failed attempt-এর কিছু অংশ apply হয়ে থাকলেও rerun করা যাবে।
4. 001–032 বা 034–036 আবার চালানোর দরকার নেই।
5. সফল হলে Vercel latest deployment refresh করুন এবং admin deliveries/order flow পরীক্ষা করুন।

## Expected result

সফল run-এর পরে `text = uuid` বা seller/buyer notification trigger error থাকবে না। Migration 033-এর order preparation, delivered, dispute, review validation, wallet এবং notification changes database-এ সক্রিয় হবে।
