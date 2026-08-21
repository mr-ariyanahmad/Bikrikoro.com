# Issue 7 — Production Schema Drift ও Security Baseline

## সমস্যাটি

Repository-তে 071–079 পর্যন্ত security hardening migration যোগ হলেও live Supabase schema-তে কোনগুলো সত্যিই apply হয়েছে তা admin health screen নিশ্চিতভাবে জানত না। পুরনো `schema_marker` শুধু 073 migration-এর একটি text value যাচাই করত। ফলে repository-র security fix এবং production database-এর বাস্তব অবস্থা আলাদা হয়ে যাওয়ার ঝুঁকি ছিল।

## কী ফিক্স হয়েছে

`080_security_baseline_marker.sql` একটি additive, idempotent security baseline যোগ করে। এটি কোনো buyer/seller data, wallet balance, order বা payment behavior পরিবর্তন করে না।

Migration-টি `security_schema_baseline` table-এ tracked baseline লিখে এবং `admin_get_security_baseline(p_admin_id)` নামে service-only RPC তৈরি করে। RPC নিম্নলিখিত বিষয় যাচাই করে:

| যাচাই | উদ্দেশ্য |
|---|---|
| `public_products` view | Public product projection live আছে কি না |
| `public_product_questions` view | Public Q&A projection live আছে কি না |
| Base `products` browser read block | Internal product metadata browser-এ না যাওয়া |
| User-scoped table browser read block | Chat, alerts, follows, questions, reports ও addresses protected কি না |
| Legacy Saved Address RPC removal | পুরনো identity-bearing address functions আর আছে কি না |

সবগুলো ঠিক থাকলে `ready: true` ফেরত আসে। কোনো অংশ অনুপস্থিত থাকলে baseline অসম্পূর্ণ দেখাবে।

## Admin health পরিবর্তন

`/api/admin-health` এখন `admin_get_security_baseline` RPC call করে। Admin System Status-এ আলাদা `Security hardening baseline` check দেখা যাবে। Migration apply না হলে status `MANUAL`/`ERROR` দেখাবে; health endpoint ভুল করে system-কে সম্পূর্ণ healthy দাবি করবে না। `schema_marker` এখন নির্দিষ্টভাবে `080_security_baseline` প্রত্যাশা করে।

## Supabase SQL Editor-এ চালানোর নিয়ম

১. আগের security migrations 074–079 apply করা আছে কি না নিশ্চিত করুন।

২. `supabase/migrations/080_security_baseline_marker.sql`-এর সম্পূর্ণ code SQL Editor-এ paste করুন।

৩. সম্পূর্ণ migration একবারে চালান। এটি নিরাপদভাবে baseline table, verification RPC এবং নতুন system-status marker তৈরি/আপডেট করবে।

৪. Baseline সরাসরি যাচাই করতে admin Firebase UID দিয়ে server gateway ব্যবহার করুন; browser থেকে RPC call করবেন না। Admin System Status page-এ `Security hardening baseline: OK` দেখা উচিত।

৫. চাইলে SQL catalog-এ function grant যাচাই করুন:

```sql
select
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as identity_args,
  coalesce(array_to_string(p.proacl, ','), '') as grants
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('admin_get_security_baseline', 'admin_get_system_status')
order by p.proname
limit 10;
```

`service_role=X/...` থাকা উচিত; `anon` বা `authenticated` execution থাকা উচিত নয়।

## Validation অবস্থা

- Production build সফল।
- Lint-এ ০ error; AuthContext-এর আগের ১টি Fast Refresh warning আছে।
- `git diff --check` সফল।
- Migration additive এবং idempotent।
- Live Supabase-এ migration এখনো apply করা হয়নি।
