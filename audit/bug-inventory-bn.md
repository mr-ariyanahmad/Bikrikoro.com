# BikriKoro.com — পূর্ণ Bug Audit Inventory

এই working inventory-তে repository scan, migration/RPC contract scan, previous production screenshots এবং ইতিমধ্যে পাওয়া runtime failures মিলিয়ে ৬০টি concrete finding রাখা হলো। একই ধরনের কয়েকটি সমস্যা একসঙ্গে সংশোধন করা হবে, কিন্তু প্রতিটি finding আলাদাভাবে track করা হবে।

| ID | ক্ষেত্র | Finding | Evidence/target | Status |
|---:|---|---|---|---|
| 01 | Global | Supabase config না থাকলেও placeholder anon key দিয়ে app চালু হয় | `src/lib/supabase.ts` | Audit |
| 02 | Global | Error message বহু page-এ ভুলভাবে migration-কে দায়ী করে | admin/public error handlers | Audit |
| 03 | Global | Loading state শেষে error হলেও stale data থেকে যায় | list page loaders | Audit |
| 04 | Global | বহু destructive action-এ double-submit guard অসম্পূর্ণ | action handlers | Audit |
| 05 | Global | Mobile page-গুলোতে button/toolbar overflow ঝুঁকি | page action bars | Audit |
| 06 | Global | পুরনো rounded/pill button design system-এর square-button rule ভাঙে | `src/pages`, `src/components` | Audit |
| 07 | Global | ইংরেজি labels Bengali UI consistency ভাঙে | admin/seller/customer pages | Audit |
| 08 | Global | Empty state-এ প্রয়োজনীয় next action সব জায়গায় নেই | list pages | Audit |
| 09 | Global | API non-JSON response অনেক client-এ generic error হয়ে যায় | API clients | Audit |
| 10 | Global | Error boundary থেকে retry করলে current route state হারাতে পারে | `AppErrorBoundary` | Audit |
| 11 | Auth | Profile bootstrap আগে client insert-এ নির্ভর করত | `useEnsureProfile` | Fixed earlier |
| 12 | Auth | Admin profile/allowlist mapping না থাকলে misleading permission error | admin access | Fixed earlier |
| 13 | Auth | Super Admin resolution-এ legacy/member role collision ছিল | `admin_access` | Fixed earlier |
| 14 | Auth | Role list RPC failure dropdown-এ শুধু “বেছে নিন” দেখায় | `AdminTeam` | Fixed earlier |
| 15 | Auth | Case-sensitive email fallback valid admin-কে চিনত না | `useIsAdmin` | Fixed earlier |
| 16 | Auth | Firebase Admin v14 dependency Vercel jose ESM crash করত | notification API | Fixed earlier |
| 17 | Auth | Login failure-তে browser-specific popup error বেশি generic | `AuthContext/Login` | Audit |
| 18 | Auth | Protected route loading/error state route intent সংরক্ষণ করে না | `ProtectedRoute` | Audit |
| 19 | Auth | Account profile update failure-এ local state rollback অসম্পূর্ণ | `Account` | Audit |
| 20 | Auth | Photo upload validation অনুপস্থিত | `Account` | Audit |
| 21 | Browse | Home category select full page reload করে | `Home.tsx` | Audit |
| 22 | Browse | Saved search localStorage JSON corrupt হলে page crash করতে পারে | `Products.tsx` | Audit |
| 23 | Browse | Clipboard unavailable হলে share fallback নেই | `Products.tsx` | Audit |
| 24 | Browse | Product image missing হলে accessible fallback/alt অসম্পূর্ণ | product cards | Audit |
| 25 | Browse | Product detail question submit-এ duplicate click guard অসম্পূর্ণ | `ProductDetail` | Audit |
| 26 | Browse | Product Q&A seller notification trigger অনুপস্থিত ছিল | `product_questions` | Fixed in migration 040 |
| 27 | Browse | Q&A notification migration user-applied না হলে silent feature gap থাকে | migration 040 | Pending user apply |
| 28 | Browse | Share preview/API failure-এর fallback metadata অসম্পূর্ণ | `product-preview` | Audit |
| 29 | Browse | Filter URL update/back-forward synchronization অসম্পূর্ণ | `Products.tsx` | Audit |
| 30 | Browse | Compare list stale/localStorage invalid item সামলায় না | `Compare.tsx` | Audit |
| 31 | Seller | Seller listing loader generic error দেখায় | `MyListings` | Audit |
| 32 | Seller | Listing delete direct table mutation ও error check ছাড়া | `MyListings` | Audit |
| 33 | Seller | Duplicate digital content rollback failure check নেই | `MyListings` | Audit |
| 34 | Seller | Duplicate product response null হলেও unsafe cast হয় | `MyListings` | Audit |
| 35 | Seller | Sell edit path direct product update RPC policy bypass/contract mismatch ঝুঁকি | `Sell.tsx` | Audit |
| 36 | Seller | Digital delivery save failure-এ product published অবস্থায় থাকতে পারে | `Sell.tsx` | Audit |
| 37 | Seller | Image upload size/type/count validation অসম্পূর্ণ | `Sell/ImageUploader` | Audit |
| 38 | Seller | Verification document size/type validation অসম্পূর্ণ | `SellerVerification` | Audit |
| 39 | Seller | Dispute evidence file size/type validation অসম্পূর্ণ | `ReportDisputeModal` | Audit |
| 40 | Seller | Verification submit শেষে full reload UX ও unsaved state হারায় | `SellerVerification` | Audit |
| 41 | Seller | Seller dashboard unread notification count আগে ছিল না | `SellerDashboard` | Fixed in current batch |
| 42 | Seller | Seller question notification dashboard/inbox path অনুপস্থিত ছিল | migration 040 + dashboard | Fixed in current batch |
| 43 | Seller | Seller dashboard stats query errors আলাদা করে দেখায় না | `SellerDashboard` | Audit |
| 44 | Seller | Seller access failure ও verification pending state আলাদা নয় | `useIsSeller/SellerDashboard` | Audit |
| 45 | Chat | Chat thread `user!` assertion runtime-safe নয় | `ChatThread` | Audit |
| 46 | Chat | Chat load/message/unread update errors অসম্পূর্ণভাবে handle হয় | `ChatThread` | Audit |
| 47 | Chat | Client-side participant check database policy-এর বিকল্প নয় | chat RLS/RPC | Audit |
| 48 | Chat | Message send retry/double-submit state edge cases আছে | `ChatThread` | Audit |
| 49 | Order | Payment redirect failure state পুনরুদ্ধার/duplicate guard audit দরকার | `Orders/BuyModal` | Audit |
| 50 | Order | Order action error-এ transition-specific explanation অসম্পূর্ণ | `Orders/OrderDetail` | Audit |
| 51 | Order | Order lifecycle trigger duplicate/old migration definitions audit দরকার | 009/031/032/033 | Audit |
| 52 | Wallet | Withdrawal request ও paid settlement race condition ছিল | `apply_paid_withdrawal` | Fixed in migration 041 |
| 53 | Wallet | Insufficient balance raw constraint error হিসেবে দেখা যেত | `AdminFinance` | Fixed in current batch |
| 54 | Wallet | Wallet ledger/balance drift diagnostic নেই | wallet tables | Audit |
| 55 | Notification | Public inbox generic migration error দেখাত | `Notifications/marketplace` | Fixed earlier |
| 56 | Notification | Campaign history jose module crash করত | `api/notifications` | Fixed earlier |
| 57 | Notification | Push token registration config error user-friendly নয় | push client/API | Audit |
| 58 | Notification | Realtime notification channel cleanup/error state অসম্পূর্ণ | `Notifications` | Audit |
| 59 | Admin | Admin list pages-এ RPC/table/permission error আলাদা করা অসম্পূর্ণ | admin modules | Fixed in batches/audit |
| 60 | Admin | Admin system status বাস্তব health checks না দেখিয়ে shallow table checks করে | `AdminSystemStatus` | Audit |
| 61 | Admin | Admin Team email lookup profile না থাকলে self-repair path ছিল না | `AdminTeam` | Fixed earlier |
| 62 | Admin | Admin customer bulk/action safeguards audit দরকার | `AdminCustomerDetail` | Audit |
| 63 | Admin | Banner delete action flow/refresh audit দরকার | `AdminContent` | Audit |
| 64 | Admin | Content/blog/FAQ validation ও slug collision audit দরকার | `AdminContent` | Audit |
| 65 | Admin | Product approval/history admin identity display audit দরকার | catalogue/history | Audit |
| 66 | Admin | Finance payout status transition guard client+RPC দুই স্তরে audit দরকার | finance | Fixed/verify |
| 67 | SEO | Dynamic metadata fallback/canonical route audit দরকার | `SiteMeta/sitemap` | Audit |
| 68 | SEO | Product/social preview cache/fallback audit দরকার | `api/product-preview` | Audit |
| 69 | Security | Direct client table writes high-risk tablesে audit দরকার | chat/products/digital content | Audit |
| 70 | Security | File upload path/content-type/size policy audit দরকার | storage helpers | Audit |

## Repair batches

প্রথমে Global/Auth এবং high-risk data mutation fixes, তারপর seller/chat/order/wallet, এরপর notification/admin/content, এবং শেষে regression checks চালানো হবে। কোনো destructive schema change না করে নতুন migration বা idempotent function replacement ব্যবহার করা হবে।
