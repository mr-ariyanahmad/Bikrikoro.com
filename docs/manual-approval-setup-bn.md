# BikriKoro manual approval setup

এই পরিবর্তনের পরে **প্রোডাক্ট এবং seller verification** admin review-এর মাধ্যমে চলবে। **অর্ডার admin review-এর মাধ্যমে চলবে না**; order, payment, escrow, shipping এবং delivery আগের সিস্টেম অনুযায়ী automatic flow-তে চলবে।

## Supabase migration

Supabase SQL Editor-এ একই project-এ এই ক্রমে migration চালান:

1. `028_notifications_push.sql`
2. `029_secure_notification_rpc_execution.sql`
3. `030_notification_function_hardening.sql`
4. `031_admin_manual_approval_workflows.sql`
5. `032_remove_order_manual_approval.sql`

`031` আগে চালানো হয়ে থাকলে `032` অবশ্যই চালাবেন। এটি শুধু order-level manual approval-এর columns, history table, trigger এবং RPC সরাবে। Product approval, product history এবং seller verification reviewer history অক্ষত থাকবে। `031` migration চালানোর সময় existing products এবং orders-কে `APPROVED` করা হয়েছিল, তাই live product ও order data নষ্ট হবে না।

## Admin workflow

### Product

নতুন product প্রথমে `PENDING` থাকে এবং public catalogue-এ দেখা যায় না। Admin Panel → **Products** থেকে product খুলে অনুমোদন করলে এটি public হবে। বাতিল করলে product hidden থাকবে এবং seller-এর কাছে কারণসহ in-app notification যাবে। Seller product edit করলে approval status আবার `PENDING` হয়, তাই edit করা content নতুন করে review করা যায়।

### Order

Order-এর জন্য কোনো manual admin approval নেই। Buyer order করলে আগের flow অনুযায়ী order তৈরি হবে, verified payment webhook-এর পরে escrow transition হবে, এবং seller আগের নিয়মে shipment mark করতে পারবে। Buyer delivery confirm করলে আগের wallet এবং completion logic অনুযায়ী order complete হবে। Admin Panel থেকে আগের operational order status management থাকলে সেটি ব্যবহার করা যাবে, কিন্তু আলাদা order approval বা rejection করতে হবে না।

### Seller verification

Admin Panel → **Seller Verification** থেকে প্রতিটি required document আলাদাভাবে approve বা reject করুন। সব required document approved হলে final application approve করা যাবে। প্রতিটি document review এবং final decision-এর সঙ্গে reviewer-এর **Gmail, Firebase UID, action, document type, note এবং সময়** history panel-এ থাকে।

## Required Vercel variables

সার্ভার-side secret কখনো `VITE_` variable বা GitHub-এ রাখবেন না। Vercel-এ প্রয়োজনীয় variables:

- `VITE_FIREBASE_VAPID_KEY`
- `FIREBASE_SERVICE_ACCOUNT_JSON`
- `SUPABASE_SERVICE_ROLE_KEY`

## Edge Function deploy

Repository root থেকে updated payment webhook deploy করুন:

```bash
supabase functions deploy uddoktapay-webhook --no-verify-jwt
```

Deploy-এর পরে একটি test order তৈরি করে এই flow যাচাই করুন: order তৈরি → payment verify → escrow held → seller ship → buyer delivery confirm → order complete। Order approve/reject করার কোনো ধাপ থাকবে না।

## Security notes

Product mutation এবং product history read operations permission-scoped RPC ব্যবহার করে। Public product read policy শুধু `APPROVED` এবং non-hidden listings প্রকাশ করে। Seller-owned pending listings-এর জন্য আলাদা seller-scoped RPC ব্যবহার করা হয়েছে, যাতে seller নিজের pending/rejected listing দেখতে ও edit করতে পারে কিন্তু public catalogue-এ তা প্রকাশ না পায়। Firebase service account এবং Supabase service-role key client bundle-এ পাঠানো হয় না।
