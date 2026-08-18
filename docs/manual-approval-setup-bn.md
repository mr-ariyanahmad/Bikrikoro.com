# BikriKoro manual approval setup

এই পরিবর্তনের পরে নতুন **প্রোডাক্ট, অর্ডার এবং seller verification** admin review ছাড়া live বা fulfillment stage-এ যাবে না। পুরোনো live data নষ্ট না করার জন্য migration `031_admin_manual_approval_workflows.sql` চালানোর সময় existing products এবং orders-কে `APPROVED` করা হয়।

## Supabase migration

Supabase SQL Editor-এ একই project-এ এই ক্রমে migration চালান:

1. `028_notifications_push.sql`
2. `029_secure_notification_rpc_execution.sql`
3. `030_notification_function_hardening.sql`
4. `031_admin_manual_approval_workflows.sql`

`031` migration একবারই চালাবেন। Migration সফল হলে `products.approval_status`, `orders.admin_review_status`, `product_approval_history`, `order_admin_approval_history` এবং seller verification reviewer identity fields তৈরি হবে।

## Admin workflow

### Product

নতুন product প্রথমে `PENDING` থাকে এবং public catalogue-এ দেখা যায় না। Admin Panel → **Products** থেকে product খুলে `Approve` করলে এটি public হবে। `Reject` করলে product hidden থাকবে এবং seller-এর কাছে কারণসহ in-app notification যাবে। Seller product edit করলে approval status আবার `PENDING` হয়, তাই edit করা content নতুন করে review করা যায়।

### Order

নতুন order `PENDING` admin review status নিয়ে তৈরি হয়। Admin Panel → **Orders** থেকে order খুলে আগে manual review করুন। Approve করার পরে verified payment escrow-এ যেতে পারে এবং seller ship করতে পারে। Reject করলে order cancel হয়। UddoktaPay webhook-ও `APPROVED` status না থাকলে escrow transition বন্ধ রাখে।

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

Deploy-এর পরে একটি test order তৈরি করে এই ক্রম যাচাই করুন: order pending review → admin approve → payment verified → escrow held → seller ship। Reject path-এ order cancel এবং buyer/seller notification-ও পরীক্ষা করুন।

## Security notes

Admin mutation এবং history read operations permission-scoped RPC ব্যবহার করে। Public product read policy শুধু `APPROVED` এবং non-hidden listings প্রকাশ করে। Seller-owned pending listings-এর জন্য আলাদা seller-scoped RPC ব্যবহার করা হয়েছে, যাতে seller নিজের pending/rejected listing দেখতে ও edit করতে পারে কিন্তু public catalogue-এ তা প্রকাশ না পায়। Firebase service account এবং Supabase service-role key client bundle-এ পাঠানো হয় না।
