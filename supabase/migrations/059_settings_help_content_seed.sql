-- Default editable Settings & Help Center pages.
-- Existing admin edits are preserved because inserts are keyed by slug.
insert into public.admin_content(
  content_type, title, slug, excerpt, body, status, seo_title, seo_description, published_at
) values
(
  'ABOUT',
  'আমাদের সম্পর্কে',
  'about',
  'BikriKoro.Com-এর উদ্দেশ্য ও নিরাপদ marketplace নীতি।',
  E'BikriKoro.Com বাংলাদেশের buyer ও seller-দের জন্য তৈরি একটি নিরাপদ marketplace। আমাদের লক্ষ্য হলো product খোঁজা, seller যাচাই, order করা এবং payment tracking—এই পুরো অভিজ্ঞতাকে সহজ ও স্বচ্ছ করা।\n\nআমরা buyer ও seller-কে platform-এর ভিতরে যোগাযোগ, order status এবং support ব্যবহারের সুযোগ দিই। নিরাপদ কেনাকাটার জন্য seller profile, product description, delivery তথ্য এবং marketplace policy পড়ে সিদ্ধান্ত নিন।',
  'PUBLISHED',
  'আমাদের সম্পর্কে | BikriKoro.Com',
  'BikriKoro.Com-এর উদ্দেশ্য, marketplace নীতি এবং buyer ও seller নিরাপত্তা সম্পর্কে জানুন।',
  now()
),
(
  'PRIVACY',
  'প্রাইভেসি পলিসি',
  'privacy',
  'আপনার তথ্য কীভাবে ব্যবহৃত ও সুরক্ষিত হয়।',
  E'BikriKoro account, order, chat, payment status, support এবং seller verification পরিচালনার জন্য প্রয়োজনীয় তথ্য ব্যবহার করতে পারে। আমরা service চালানো, fraud prevention, customer support, notification এবং আইনগত দায়িত্ব পালনের উদ্দেশ্যে তথ্য প্রক্রিয়া করি।\n\nSensitive verification documents public product page বা public seller profile-এ প্রকাশ করা হয় না। Password, OTP, payment PIN বা API key কখনো কারও সঙ্গে share করবেন না। আপনার তথ্য, account access বা privacy নিয়ে প্রশ্ন থাকলে Contact বা Help Center ব্যবহার করুন।',
  'PUBLISHED',
  'প্রাইভেসি পলিসি | BikriKoro.Com',
  'BikriKoro কীভাবে account, order, payment, chat এবং verification তথ্য ব্যবহার ও সুরক্ষিত রাখে।',
  now()
),
(
  'CONTACT',
  'যোগাযোগ ও সাপোর্ট',
  'contact',
  'Order, account বা seller সমস্যায় আমাদের জানান।',
  E'Order সংক্রান্ত সমস্যায় প্রথমে Order Detail থেকে report বা dispute খুলুন, যাতে order context ও evidence যুক্ত থাকে। সাধারণ account, payment বা feature সমস্যায় Help Center ব্যবহার করুন।\n\nSupport message-এ আপনার email, order ID, সমস্যার সংক্ষিপ্ত বিবরণ এবং প্রয়োজনীয় screenshot বা evidence দিন। Password, OTP, card number বা payment PIN support message-এ পাঠাবেন না।',
  'PUBLISHED',
  'যোগাযোগ ও সাপোর্ট | BikriKoro.Com',
  'BikriKoro order, account, payment এবং seller support-এর সঙ্গে যোগাযোগের নিয়ম।',
  now()
),
(
  'HELP',
  'Help Center',
  'help',
  'কেনাকাটা, বিক্রি, payment, delivery ও account নিয়ে দ্রুত উত্তর।',
  E'BikriKoro ব্যবহার করার আগে FAQ, Privacy Policy, Return ও Refund Policy এবং Terms পড়ুন। Order সমস্যা হলে Order Detail-এর support path ব্যবহার করুন এবং buyer বা seller হিসেবে সঠিক evidence দিন।\n\nLogin, account, notification, wallet, payment, delivery, dispute এবং seller verification নিয়ে সাধারণ প্রশ্নের উত্তর FAQ-তে পাওয়া যাবে।',
  'PUBLISHED',
  'Help Center | BikriKoro.Com',
  'BikriKoro কেনাকাটা, বিক্রি, payment, delivery, account এবং support-এর Help Center।',
  now()
),
(
  'USER_EDU',
  'User Education Hub',
  'user-education',
  'নিরাপদে কেনাকাটা ও account ব্যবহারের গাইড।',
  E'নিরাপদে কেনাকাটার জন্য seller verification, rating, review, product condition, description এবং delivery তথ্য যাচাই করুন।\n\nPlatform-এর ভিতরে payment ও chat flow ব্যবহার করুন। OTP, password, payment PIN বা card তথ্য কাউকে দেবেন না। পণ্য হাতে পাওয়ার আগে order confirm করবেন না এবং সমস্যা হলে evidence-সহ dispute বা support report করুন।',
  'PUBLISHED',
  'User Education Hub | BikriKoro.Com',
  'BikriKoro-তে নিরাপদে কেনাকাটা, account ব্যবহার এবং order support-এর গাইড।',
  now()
),
(
  'SELLER_EDU',
  'Seller Education Hub',
  'seller-education',
  'ভালো listing, দ্রুত delivery ও বিশ্বস্ত seller profile তৈরির গাইড।',
  E'ভালো seller profile-এর জন্য shop name, image, description এবং contact তথ্য সঠিক রাখুন। Product listing-এ বাস্তব ছবি, পরিষ্কার title, সঠিক condition, description, price এবং delivery তথ্য দিন।\n\nOrder পাওয়ার পরে status সঠিকভাবে update করুন, buyer-এর সঙ্গে platform-এর ভিতরে যোগাযোগ রাখুন এবং payment বা OTP-এর জন্য buyer-কে platform-এর বাইরে পাঠাবেন না।',
  'PUBLISHED',
  'Seller Education Hub | BikriKoro.Com',
  'BikriKoro seller-দের জন্য listing, delivery, buyer communication এবং seller profile guide।',
  now()
),
(
  'RETURN_POLICY',
  'Return ও Refund Policy',
  'return-policy',
  'পণ্য না মিললে কীভাবে সহায়তা পাবেন।',
  E'পণ্য হাতে পাওয়ার পরে description, condition, quantity এবং visible damage যাচাই করুন। পণ্য না পাওয়া, ভুল পণ্য, damaged পণ্য বা listing-এর সঙ্গে না মিললে buyer confirmation না দিয়ে Order Detail থেকে report বা dispute খুলুন।\n\nOrder ID, ছবি, video বা delivery evidence দিন। Refund বা resolution order status, payment এবং admin review-এর উপর নির্ভর করবে। প্রতিটি পণ্যের ক্ষেত্রে seller-এর listing policy এবং applicable marketplace rules প্রযোজ্য হবে।',
  'PUBLISHED',
  'Return ও Refund Policy | BikriKoro.Com',
  'BikriKoro-তে ভুল, damaged বা না পাওয়া product নিয়ে return, dispute ও refund সহায়তার নিয়ম।',
  now()
),
(
  'TERMS',
  'ব্যবহারের শর্ত',
  'terms',
  'BikriKoro marketplace ব্যবহারের গুরুত্বপূর্ণ নিয়ম।',
  E'BikriKoro ব্যবহার করার সময় সঠিক account তথ্য, product information, price, delivery এবং communication বজায় রাখতে হবে। নিষিদ্ধ পণ্য, প্রতারণামূলক listing, copied content, fake identity, platform-এর বাইরে payment এবং abusive behavior গ্রহণযোগ্য নয়।\n\nBuyer ও seller উভয়েই order, payment, delivery এবং dispute-এর platform flow অনুসরণ করবেন। Policy ভঙ্গ হলে content removal, account restriction, seller verification review বা অন্য ব্যবস্থা নেওয়া হতে পারে।',
  'PUBLISHED',
  'ব্যবহারের শর্ত | BikriKoro.Com',
  'BikriKoro marketplace ব্যবহার, listing, payment, delivery, dispute এবং account আচরণের শর্ত।',
  now()
)
on conflict (slug) do nothing;
