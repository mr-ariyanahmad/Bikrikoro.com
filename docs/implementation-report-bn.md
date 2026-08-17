# BikriKoro.Com — সর্বশেষ উন্নয়ন প্রতিবেদন

## সারসংক্ষেপ

এই release-এর মূল উদ্দেশ্য ছিল BikriKoro.Com-কে scattered static pages-এর বদলে একটি কেন্দ্রীভূত, admin-controlled marketplace হিসেবে সাজানো। Login navigation, product share preview, account sizing, seller chat এবং daily check-in—এই critical flowগুলোকে অগ্রাধিকার দেওয়া হয়েছে। একই সঙ্গে Settings ও Help Center, public content editor, feature control center এবং নিরাপদ Agent Router boundary যোগ করা হয়েছে।

> গুরুত্বপূর্ণ নীতি: real-money BDT wallet এবং reward coins আলাদা রাখা হয়েছে। Daily check-in কখনো wallet balance বাড়ায় না; এটি আলাদা reward ledger-এ coins রাখে।

## ১. কেন্দ্রীভূত Settings ও Help Center

এখন footer-এ About, Contact এবং Privacy আলাদা আলাদা link হিসেবে ছড়িয়ে নেই। একটি `Settings ও Help` hub-এর মধ্যে Help Center, FAQ, Contact, Privacy Policy, Return/Refund Policy, Terms, User Education Hub, Seller Education Hub এবং About রাখা হয়েছে। Mobile account drawer-এও একই hub দেখা যায়।

Public pages-এর content database থেকে `PUBLISHED` অবস্থায় পড়ে। Admin panel-এর `পাবলিক পেজ` editor থেকে Help, FAQ, About, Privacy, Contact, policy এবং education content draft করে publish বা archive করা যায়। Database content না থাকলেও নিরাপদ Bengali fallback copy দেখানো হয়, তাই migration প্রয়োগ না থাকলেও page blank হয় না।

## ২. Admin control architecture

Admin panel-এ এখন `পাবলিক পেজ` এবং `ফিচার কন্ট্রোল` আলাদা destination আছে। Feature Control Center-এ ১০০টি marketplace feature category অনুযায়ী দেখানো হয়েছে। প্রতিটি feature enabled/disabled করা যায় এবং secure `admin_upsert_setting` RPC-এর মাধ্যমে সংরক্ষিত হয়।

Feature registry-তে প্রতিটি item-এর id, Bengali label, category এবং status (`live`, `admin`, `planned`) রয়েছে। ফলে future feature rollout-এ প্রথমে implementation, তারপর admin flag, তারপর production visibility—এই ধারাবাহিকতা রাখা যাবে।

## ৩. যেসব critical flow ঠিক করা হয়েছে

### Login navigation

Standalone login page-এ mobile-friendly `ফিরে যান`, `প্রোডাক্ট` এবং Home controls যোগ করা হয়েছে। Browser history না থাকলে Back action Products পেজে fallback করে। Google login-এর আগের mobile redirect ও popup fallback-ও অক্ষুণ্ণ আছে।

### Seller chat

Seller chat শুরু করার helper এখন participant validation, duplicate-thread race handling এবং unique constraint conflict recovery করে। একই buyer-seller pair-এর দুইটি simultaneous click হলেও duplicate thread তৈরি না করে existing thread ব্যবহার করবে। ProductDetail-এ chat failure আর silently ignore হয় না; Bengali error message দেখায়। ChatThread-এ unauthorized participant check, missing-thread state, send failure state, unread update error, product context এবং Help shortcut যোগ করা হয়েছে। Chat list-এ search এবং Unread filter যোগ করা হয়েছে।

Supabase-এ chat tables-এর migration 001 অবশ্যই প্রয়োগ করা থাকতে হবে এবং buyer/seller profile rows Firebase UID দিয়ে তৈরি হতে হবে।

### Daily check-in

আগের localStorage-only check-in কেবল button label বদলাত, coins save করত না। Migration 020-এর পর daily check-in Bangladesh time অনুযায়ী server-side atomic claim ব্যবহার করে। একই দিনে দ্বিতীয়বার claim করলে duplicate reward হবে না। Homepage-এ মোট coins, streak, claim result এবং migration error message দেখা যায়। Migration 022 reward amount admin site settings থেকে নিয়ন্ত্রণযোগ্য করেছে।

### Product share preview

Vercel serverless product preview endpoint এবং rewrite যোগ করা হয়েছে। Product URL crawler-এর কাছে server-rendered title, description, canonical URL এবং product-এর প্রথম image-এর Open Graph/Twitter metadata পাঠায়। Browser পরে app-এর canonical product page-এ redirect হয়। WhatsApp পুরোনো preview cache করলে link-এর শেষে `?v=2` যোগ করে নতুন করে share করতে হবে।

### Account ও visual consistency

Account page wide responsive shell ব্যবহার করছে। Comparison page-এর empty state, global focus ring, tap feedback, reduced-motion support, responsive chat এবং Settings hub একই design tokens ব্যবহার করে। লক্ষ্য হলো generic AI-generated card pattern বাদ দিয়ে restrained green brand, clear hierarchy, consistent spacing এবং purposeful icon use রাখা।

## ৪. Marketplace feature registry

এই release-এ registry-তে মোট ১০০টি feature রাখা হয়েছে। এগুলো account/navigation, discovery, buyer trust, checkout, orders, seller operations, support/AI, rewards এবং admin control—এই নয়টি domain-এ ভাগ করা। আগের marketplace implementation-এর live featureগুলো registry-তে `live`, admin-managed featureগুলো `admin`, এবং এখনও backend/business rule প্রয়োজন এমন featureগুলো `planned` হিসেবে চিহ্নিত।

### Live বা admin-connected feature-এর উদাহরণ

Login mobile navigation, Google fallback, saved address, account hub, profile photo, email verification, password change, recent search, saved search, wishlist folder, advanced filters, multiple sorting modes, grid/list view, product compare, first-image share preview, recently viewed, related products, price/stock alerts, seller follow, Q&A, report, delivery badges, escrow messaging, saved checkout address, coupon validation, digital delivery, payment callback, order filtering, order timeline, seller onboarding, listing quality score, seller dashboard, conversion rate, performance export, drafts, duplicate listing, buyer/seller chat, realtime refresh, unread count, Help Center, education hubs, daily check-in, streak, reward coins, notification filters, mark-all-read, admin catalogue/order/payout/dispute/review/coupon/banner/content/settings/audit controls—এসব feature-এর ভিত্তি repository-তে রয়েছে।

### Planned status-এর অর্থ

Bulk upload, vacation mode, product recommendation in chat, verified-purchase review label, shipping estimate, gift message, referral program ইত্যাদির জন্য আলাদা business rule, schema বা operational workflow দরকার। এগুলোকে fake button হিসেবে চালু না করে registry-তে planned রাখা হয়েছে। Admin Feature Control Center-এ planned feature default off থাকে, যাতে অসম্পূর্ণ workflow customer-এর সামনে না আসে।

## ৫. Agent Router সংযোগ

`api/agent-router.ts` server-side proxy হিসেবে তৈরি হয়েছে এবং Help Center-এর AI Assistant এটি ব্যবহার করে। Browser কখনো upstream API key দেখে না। Vercel-এ নিচের variables যোগ করতে হবে:

```text
AGENT_ROUTER_BASE_URL=https://আপনার-agent-router-host
AGENT_ROUTER_API_KEY=আপনার-গোপন-api-key
AGENT_ROUTER_MODEL=আপনার-default-model
AGENT_ROUTER_CHAT_PATH=/v1/chat/completions
```

বর্তমান proxy OpenAI-compatible `messages` request পাঠায়। আপনার Agent Router-এর endpoint বা response shape আলাদা হলে server-side mapping পরিবর্তন করতে হবে; frontend secret বা API call বদলাতে হবে না। বিস্তারিত setup, security rules এবং testing steps আলাদা file-এ আছে: `docs/agent-router-setup-bn.md`।

## ৬. Supabase migration order

নতুন release-এর জন্য আগের migrationগুলোর পরে নিচের ক্রমে প্রয়োগ করুন:

```text
013_marketplace_features.sql
014_admin_workspace.sql অথবা idempotent 015_admin_control_center.sql
016_public_expansion.sql
017_marketplace_badges.sql
018_wishlist_folders.sql
019_notification_tools.sql
020_rewards_checkin.sql
021_public_content_center.sql
022_admin_reward_ai_controls.sql
```

`014` এবং `015` আপনার migration history অনুযায়ী একবার প্রয়োগ করবেন; দুটো একই admin RPC layer-এর variants। Production-এ SQL Editor-এ চালানোর আগে backup এবং migration history যাচাই করুন।

## ৭. Shopee Malaysia থেকে নেওয়া design direction

Shopee Malaysia Seller Centre-এর public education pages-এ product management, order processing, instant communication, performance insights, marketing tools, chat filtering, shop settings, vacation mode, bulk operations, listing content quality এবং seller education-এর মতো pattern দেখা যায়। BikriKoro-তে এগুলো copy না করে Bangladesh-focused Bengali UX হিসেবে রূপ দেওয়া হয়েছে: Seller Education Hub, listing quality score, seller dashboard, chat filters, centralized help এবং admin content publishing সেই direction-এর প্রথম ভিত্তি।

## ৮. Validation ও deployment

Production build সফল হয়েছে। Lint-এ নতুন কোনো error নেই; কেবল পূর্ববর্তী `AuthContext.tsx` Fast Refresh export warning আছে। TypeScript build, diff check এবং responsive-focused changes validation করা হয়েছে। GitHub push-এর পরে Vercel auto-deploy হওয়ার কথা।

Vercel environment variables-এ Agent Router values যোগ করার পর `/help`, `/faq`, `/settings`, `/chat`, `/account` এবং homepage daily check-in নতুন করে পরীক্ষা করুন। Supabase migration না চালালে public pages fallback content দেখাবে, কিন্তু daily rewards, wishlist folders, bulk notification read এবং admin content publishing চালু হবে না।

## References

[1]: https://seller.shopee.com.my/edu/article/25954 "Introduction to the Shopee Seller Centre App"

[2]: https://seller.shopee.com.my/edu/article/20467 "Selling via Seller Centre vs Shopee App"

[3]: https://seller.shopee.com.my/edu/article/6807 "Product Category Guide"
