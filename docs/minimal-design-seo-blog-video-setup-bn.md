# BikriKoro Minimal Design, SEO, Blog ও Product Video Setup

## কী পরিবর্তন হয়েছে

BikriKoro-এর public storefront ও admin controls-এ একটি minimal visual layer যোগ হয়েছে। Splash screen-এর মতো brand green, white surface, ink text এবং outline ব্যবহার করা হয়েছে। Button এবং button-like control-এ 16px text ও square-corner interaction language প্রয়োগ করা হয়েছে; বড় pill-style control ও rainbow accent CSS layer দিয়ে brand family-তে নামিয়ে আনা হয়েছে। Existing auth, order, payment এবং seller verification flow অপরিবর্তিত রাখা হয়েছে।

Seller এখন listing form-এ একটি optional YouTube URL দিতে পারবেন। Product detail page-এ video প্রথম media item হিসেবে দেখা যাবে। প্রথমে YouTube thumbnail ও “ভিডিও চালু করুন” control থাকে, তাই mobile-এ swipe করা যায়; চালু করলে secure `youtube-nocookie.com` embed player দেখা যায়। এরপর swipe বা thumbnail চাপলে product images দেখা যাবে। Invalid বা non-YouTube URL frontend ও database উভয় স্তরে reject হবে।

Admin Content page-এ blog ও public page-এর title, slug, excerpt, body, cover image URL, SEO title এবং SEO description সম্পাদনা করা যায়। Published content Supabase থেকে public blog route ও public content route-এ আসে। তিনটি Bengali blog post এবং তিনটি matching brand cover image migration-এর seed data হিসেবে রাখা হয়েছে।

## Supabase migration ক্রম

আগের migrations-এর পরে নিচের দুটি migration চালাতে হবে:

```text
034_product_video.sql
035_content_seo_blog.sql
```

`034_product_video.sql` products table-এ optional `video_url` যোগ করে এবং seller-create RPC-এর video parameter যুক্ত করে। `035_content_seo_blog.sql` admin_content table-এ `cover_image_url`, `seo_title`, `seo_description`, `published_at` যোগ করে, admin content RPC আপডেট করে এবং তিনটি Bengali published blog post seed করে।

Migration চালানোর আগে Supabase database backup রাখা ভালো। Migration সফল হলে একটি test listing তৈরি করে YouTube URL দিয়ে product page-এ video thumbnail, play এবং swipe পরীক্ষা করবেন।

## Google Search Console ও Vercel

Google Search Console-এ property হিসেবে `https://bikrikoro.com` যোগ করে HTML-tag verification method বেছে নিন। Google যে verification token দেবে, Vercel-এর Production, Preview এবং Development environment-এ এই variable হিসেবে রাখুন:

```text
VITE_GOOGLE_SITE_VERIFICATION=Google-এর দেওয়া token
VITE_SITE_URL=https://bikrikoro.com
SITE_URL=https://bikrikoro.com
```

`VITE_GOOGLE_SITE_VERIFICATION` client HTML meta tag এবং runtime Supabase SEO metadata-তে ব্যবহৃত হয়। `SITE_URL` server-only sitemap ও product share-preview endpoint-এর canonical URL নির্ধারণ করে। কোনো token GitHub-এ commit করা যাবে না।

Vercel redeploy-এর পরে Search Console-এ verification complete করুন এবং sitemap হিসেবে দিন:

```text
https://bikrikoro.com/sitemap.xml
```

Dynamic sitemap-এ homepage, products, public policy/help routes, published blog posts এবং public products অন্তর্ভুক্ত হবে। Product detail এবং blog article-এ canonical, Open Graph, Twitter metadata এবং structured data দেওয়া হয়েছে।

## Blog cover image

Generated cover assets repository-এর `public/` directory-তে আছে এবং Supabase seed rows এগুলোকে cover URL হিসেবে ব্যবহার করে:

```text
/blog-safe-shopping.jpg
/blog-trusted-sellers.jpg
/blog-better-listings.jpg
```

ভবিষ্যতে admin panel থেকে Supabase Storage public URL বসিয়ে নতুন cover ব্যবহার করা যাবে; frontend-এ cover URL hardcode করা হয়নি।

## Verification

Production build সফল হয়েছে এবং lint-এ কোনো error নেই। শুধু আগের `AuthContext.tsx` Fast Refresh warning এবং Vite-এর existing large-chunk advisory আছে। `git diff --check` clean।
