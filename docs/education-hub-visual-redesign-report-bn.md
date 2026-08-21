# Education Hub Visual Redesign Report

**প্রকল্প:** BikriKoro.com  
**পরিবর্তন:** User Education ও Seller Education-এর visual redesign  
**উদ্দেশ্য:** Shopee Seller Education-এর মতো image-led, color-organized এবং সহজে শেখার অভিজ্ঞতা তৈরি করা—কিন্তু BikriKoro-এর digital-only workflow ও Bengali content বজায় রেখে।

## কী পরিবর্তন হয়েছে

| অংশ | নতুন অভিজ্ঞতা |
|---|---|
| Hero section | প্রতিটি hub-এ আলাদা green brand hero, Bengali heading, short explanation, action button এবং chapter count আছে। |
| Visual cover | User Education-এর জন্য buyer journey illustration এবং Seller Education-এর জন্য verification-listing-delivery illustration যোগ হয়েছে। এগুলো repository-owned SVG, কোনো third-party course thumbnail নয়। |
| Topic cards | Buyer-এর জন্য খোঁজা, নিরাপদ payment ও access verification; seller-এর জন্য verification, listing এবং delivery—তিনটি color-coded learning signal card দেখানো হয়। |
| Chapter index | Live education body-এর numbered Bengali sections থেকে chapter index তৈরি হয়। এটি hard-coded course list নয়; Supabase-এর published content থেকে তৈরি হয়। |
| Accordion reading | প্রতিটি chapter collapsible। প্রথম chapter খোলা থাকে, বাকিগুলো চাপলে দেখা যায়। Mobile-এ vertical reading এবং desktop-এ sticky chapter index থাকে। |
| Admin control | Admin Content থেকে User Education/Seller Education-এর title, excerpt, body, SEO fields, status এবং cover image URL পরিবর্তন করা যায়। |
| Truthful data | কোনো live chapter না থাকলে fake course, fake duration, fake progress বা fake student count দেখানো হয় না; honest empty state দেখানো হয়। |

## Live content ও security boundary

Education hub এখন `get_published_content('USER_EDU')` এবং `get_published_content('SELLER_EDU')` থেকে published content পড়ে। Body-র numbered section-গুলো frontend-এ chapter হিসেবে সাজানো হয়। ফলে admin নতুন numbered section প্রকাশ করলে UI-তে chapter index ও accordion নিজে থেকে আপডেট হবে। কোনো sample course, বানানো enrollment count, demo completion percentage বা fake seller identity যোগ করা হয়নি।

Live Supabase-এ `055_education_hub_covers` migration সফল হয়েছে এবং দুইটি published row-তে cover path যুক্ত হয়েছে। Content row-গুলো admin content architecture-এর মধ্যেই থাকে; frontend-এ content hard-code করে database-এর সঙ্গে দ্বৈত source তৈরি করা হয়নি।

## Implementation files

`src/components/EducationHub.tsx` visual hub, topic cards, chapter parsing, sticky index ও accordion reading experience তৈরি করে। `src/pages/PublicContentPage.tsx` education type শনাক্ত করে নতুন renderer ব্যবহার করে, কিন্তু FAQ, Help, policy ও সাধারণ content-এর আগের renderer অপরিবর্তিত রাখে। `src/pages/admin/AdminContent.tsx` education page-এ cover image URL edit করার capability দেয়। `public/education/user-education-cover.svg` এবং `public/education/seller-education-cover.svg` ছোট, repository-owned visual assets। `supabase/migrations/055_education_hub_covers.sql` live content rows-এর cover path সেট করে।

## Verification

`npm run build` সফল হয়েছে। `npm run lint`-এ ০ error এবং আগের `AuthContext` Fast Refresh warning রয়েছে। Live Supabase query-তে দুইটি row-ই `PUBLISHED` এবং যথাক্রমে `/education/user-education-cover.svg` ও `/education/seller-education-cover.svg` path দেখিয়েছে। Release push-এর পর Vercel deployment শেষ হলে production domain-এ নতুন visual hub দেখা যাবে।

## References

[1]: https://www.bikrikoro.com/user-education "BikriKoro User Education Hub"

[2]: https://www.bikrikoro.com/seller-education "BikriKoro Seller Education Hub"

[3]: https://github.com/mrariyanahmad-eng/Bikrikoro.com "BikriKoro.com GitHub repository"
