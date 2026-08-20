-- Truthful Bengali education content for the digital-only marketplace.
-- The content is stored in admin_content so admins can edit and publish it later.

insert into public.admin_content(
  content_type, title, slug, excerpt, body, status, seo_title, seo_description, published_at
) values (
  'USER_EDU',
  'User Education Hub',
  'user-education',
  'BikriKoro-তে account, digital product, payment, delivery, dispute ও নিরাপত্তা কীভাবে কাজ করে তার সম্পূর্ণ গাইড।',
  E'BikriKoro এখন digital-only marketplace। এখানে game account, digital key, software license, subscription, gift card, course, design asset, ebook, access ও digital service-এর মতো পণ্য দেখা যায়। সব দাম BDT-তে এবং checkout-এ যে payment option available থাকবে সেটিই ব্যবহার করতে হবে।\n\n১) Account তৈরি ও নিরাপদ রাখা\nLogin বা Register page থেকে phone OTP, email/password অথবা Google login ব্যবহার করে account তৈরি করুন। নিজের সঠিক নাম, email ও mobile ব্যবহার করুন, কারণ order, notification, wallet এবং support-এর সময় এগুলো কাজে লাগে। Password, OTP, payment PIN, card information বা Firebase/কোনো API key কাউকে দেবেন না। একই password অন্য সাইটে ব্যবহার না করাই নিরাপদ।\n\nNotification চালু করলে in-app notification inbox-এ order, payment, delivery, chat, verification ও support update দেখা যাবে। Browser notification চালু করা ঐচ্ছিক; browser permission না দিলেও account-এর ভেতরের notification দেখা যাবে।\n\n২) Product খোঁজা ও যাচাই\nSearch, trending term, category filter ও product detail ব্যবহার করে digital product খুঁজুন। Product detail-এ title, ছবি বা video, description, price, category, structured specification, stock, delivery method, warranty বা replacement note এবং seller profile দেখুন। Approved listing-ই public catalogue-এ দেখানোর কথা; সন্দেহজনক, copied, misleading বা অসম্পূর্ণ listing দেখলে report করুন।\n\nSeller-এর verification badge, profile, review এবং product-specific information মিলিয়ে সিদ্ধান্ত নিন। Public chat বা seller-এর ব্যক্তিগত নম্বরে payment করবেন না। Payment ও order flow সবসময় BikriKoro-এর ভেতরে রাখুন।\n\n৩) Order ও payment flow\nProduct বেছে Buy চাপলে order তৈরি হবে এবং hosted checkout-এ payment সম্পন্ন করতে হবে। Payment শেষ না হওয়া পর্যন্ত order PENDING_PAYMENT অবস্থায় থাকে। Payment verified হলে order ESCROW_HELD হয়—অর্থাৎ seller-এর payout সঙ্গে সঙ্গে ছেড়ে দেওয়া হয় না।\n\nডিজিটাল পণ্যের ক্ষেত্রে seller আগে থেকে key, file, access instruction অথবা account inventory রেখে থাকলে system automatic delivery তৈরি করতে পারে। Seller-এর inventory না থাকলে system কোনো password বা account নিজে থেকে তৈরি করে না; তখন seller-কে manual delivery দিতে হতে পারে অথবা delivery না হলে buyer support/dispute path ব্যবহার করবেন।\n\n৪) Digital delivery পাওয়ার পর\nPayment verified হওয়ার পরে Order Detail বা Digital Library দেখুন। Delivery প্রস্তুত হলে সেখানে protected instruction, license key বা download/access information দেখা যেতে পারে। Public chat, product review বা screenshot-এ কোনো credential প্রকাশ করবেন না। Account credential পেলে দ্রুত password পরিবর্তন বা seller-provided recovery instruction অনুসরণ করুন, যদি listing-এর শর্তে তা অনুমোদিত থাকে।\n\nDelivery সত্যিই কাজ করছে কি না যাচাই না করে Order received বা confirm action দেবেন না। Access কাজ করলে এবং listing-এর সঙ্গে মিললে confirm করলে order DIGITAL_DELIVERED থেকে COMPLETED flow-এ যেতে পারে এবং system-এর নিয়ম অনুযায়ী seller payout এগোয়।\n\n৫) সমস্যা হলে dispute\nPayment হওয়ার পর delivery না এলে, key invalid হলে, file খুলতে না পারলে, access listing-এর সঙ্গে না মিললে বা seller ভুল তথ্য দিলে Order Detail থেকে report বা dispute খুলুন। Order ID, screenshot, error message, delivery time এবং প্রাসঙ্গিক evidence দিন। Problem থাকা অবস্থায় confirm করবেন না এবং public chat-এ sensitive information দেবেন না। Admin review চলাকালীন নতুন তথ্য dispute thread-এ যোগ করুন।\n\n৬) Review ও rating\nOrder সম্পন্ন হওয়ার পরে product ও seller সম্পর্কে সত্য feedback দিন। Review-এ password, OTP, payment information বা ব্যক্তিগত document লিখবেন না। শুধু বাস্তব product quality, description match, delivery experience এবং seller communication নিয়ে লিখুন।\n\n৭) Wallet ও reward\nWallet balance, transaction ও payout information account-এর সংশ্লিষ্ট page থেকে দেখুন। Daily check-in বা reward coin account data থেকে আসে; reward coin BDT wallet balance নয় এবং cash-out করা যায় না, যদি platform policy-তে আলাদা করে বলা না থাকে। কোনো balance mismatch হলে transaction reference-সহ support path ব্যবহার করুন।\n\n৮) নিরাপত্তার সংক্ষিপ্ত নিয়ম\nঅস্বাভাবিক কম দাম, copied image, জরুরি payment চাপ, platform-এর বাইরে যোগাযোগের অনুরোধ এবং OTP বা password চাওয়া—এসব red flag। Product report, seller chat, order dispute ও Help Center ব্যবহার করুন। BikriKoro কখনো chat-এ আপনার password, OTP, payment PIN বা secret credential চাইবে না।',
  'PUBLISHED',
  'User Education Hub | BikriKoro',
  'BikriKoro digital marketplace-এ account, product search, BDT payment, escrow, digital delivery, dispute ও নিরাপত্তার সম্পূর্ণ Bengali গাইড।',
  now()
), (
  'SELLER_EDU',
  'Seller Education Hub',
  'seller-education',
  'Digital seller verification, listing approval, stock ও automatic delivery, order fulfillment, wallet এবং buyer safety-এর সম্পূর্ণ গাইড।',
  E'BikriKoro-তে শুধু digital product বিক্রি করা যায়। Seller হিসেবে আপনার দায়িত্ব হলো নিজের পরিচয় ও ব্যবসার তথ্য সঠিকভাবে দেওয়া, বাস্তব ও বৈধ product listing তৈরি করা, buyer-কে নির্ধারিত সময়ে delivery দেওয়া এবং platform-এর ভেতরে order evidence রাখা।\n\n১) Seller হওয়ার আগে\nBecome Seller page থেকে Digital নির্বাচন করুন। Digital seller হওয়ার জন্য Personal, Business অথবা Company type বেছে নিতে হবে। এই selection-এর পরে আপনার type ও sector অনুযায়ী document checklist দেখা যাবে। Approval না হওয়া পর্যন্ত seller verification বা listing public catalogue-এ live হওয়ার নিশ্চয়তা নেই।\n\nPersonal seller-এর ক্ষেত্রে NID-এর সামনের ও পেছনের অংশ, NID হাতে selfie, ঠিকানা এবং digital product-এর মালিকানার প্রমাণ লাগতে পারে। Business seller-এর ক্ষেত্রে NID, Trade License, e-TIN, প্রয়োজনে authorization এবং product ownership-এর প্রমাণ লাগতে পারে। Company seller-এর ক্ষেত্রে NID, company Trade License, e-TIN, BIN/VAT, registration/incorporation certificate, authorized representative letter এবং ownership evidence লাগতে পারে। Server থেকে sector-specific checklist এলে সেটিই চূড়ান্ত; কোনো document বুঝতে অসুবিধা হলে সহজভাবে দেখুন preview ব্যবহার করুন।\n\nDocument পরিষ্কার, সম্পূর্ণ, নিজের এবং বর্তমান হতে হবে। অন্যের document, edited document, password, OTP বা অপ্রয়োজনীয় sensitive file upload করবেন না। সব verification document private storage-এ থাকে এবং authorized admin review করেন।\n\n২) Verification review\nApplication submit হওয়ার পরে admin আপনার identity, business type, sector, address, document quality এবং digital product ownership review করতে পারেন। Approved হলে profile-এ sector অনুযায়ী trust badge দেখা যেতে পারে। Rejected হলে admin note দেখে ভুল সংশোধন করে আবার submit করুন। Approval history-তে decision নেওয়া admin-এর identifier ও সময় সংরক্ষিত থাকে।\n\n৩) Listing তৈরি করার সঠিক ক্রম\nSell page-এ আগে active digital category নির্বাচন করুন। Category বাছাই করার পরে একবার product title দিন এবং category-specific specification পূরণ করুন। Title, description, price, optional discount, image, valid YouTube video link, region, subscription period, warranty/replacement period, fulfillment window এবং buyer delivery note সত্য তথ্য দিয়ে পূরণ করুন। একই তথ্য অন্য field-এ কপি করে duplicate করবেন না।\n\nProduct-এর description-এ buyer কী পাবেন, access কতদিন থাকবে, region বা platform restriction কী, replacement বা warranty কীভাবে হবে এবং delivery-এর পরে buyer কীভাবে ব্যবহার করবেন—এগুলো পরিষ্কার লিখুন। অন্যের logo, copied image, misleading promise বা platform policy-বিরোধী content ব্যবহার করবেন না।\n\n৪) Stock ও delivery mode\nUNLIMITED কেবল তখনই ব্যবহার করুন যখন একই delivery content সব buyer-কে দেওয়া বৈধ ও নিরাপদ। QUANTITY ব্যবহার করলে available quantity সঠিক রাখুন। KEY_POOL ব্যবহার করলে প্রত্যেক buyer-এর জন্য আলাদা unused key, file access অথবা credential inventory আগে থেকেই জমা রাখুন।\n\nAutomatic delivery চালু করলেই system কোনো account ID/password বানায় না। Game বা subscription account বিক্রি করলে seller-কে আগে থেকেই প্রত্যেক account-এর ID, password, region, expiry এবং প্রয়োজনীয় instruction নিরাপদ inventory-তে রাখতে হবে। Inventory খালি থাকলে auto delivery হবে না। তখন listing out of stock রাখা, manual delivery দেওয়া অথবা buyer-কে policy অনুযায়ী refund/dispute path-এ সহায়তা করা উচিত।\n\nManual delivery হলে payment verified হয়ে order ESCROW_HELD হওয়ার পরে Seller Dashboard বা Orders থেকে protected delivery content দিন। Public chat-এ password, key বা download secret পাঠাবেন না। Delivery text-এ কেবল buyer-এর order-এর জন্য প্রয়োজনীয় information দিন।\n\n৫) Product approval ও publication\nListing submit করার পরে admin title, image, category, description, price, stock mode, delivery readiness, policy compliance এবং product quality review করতে পারেন। Approval না হওয়া পর্যন্ত listing public catalogue-এ দেখানোর কথা নয়। Rejected listing-এর admin note পড়ে সংশোধন করুন; একই ভুল content বারবার submit করবেন না।\n\n৬) Order fulfillment flow\nPayment না হলে order PENDING_PAYMENT থাকে। Payment verified হলে order ESCROW_HELD হয়। Auto-delivery inventory থাকলে system protected delivery তৈরি করতে পারে; না থাকলে seller manual delivery action ব্যবহার করবেন। Delivery দেওয়ার পরে buyer access যাচাই করে confirm করতে পারেন। Buyer confirm করলে order COMPLETED হতে পারে এবং eligible seller payout wallet flow-এ এগোয়। Buyer সমস্যা জানালে dispute চলাকালীন evidence দেখে admin সিদ্ধান্ত দিতে পারেন।\n\nDigital seller-এর ক্ষেত্রে physical shipment, courier status বা delivered claim প্রযোজ্য নয়। Delivery বলতে key, file, account access, instruction বা service completion বোঝায়। ভুল status দিলে buyer trust নষ্ট হয় এবং dispute বা payout delay হতে পারে।\n\n৭) Wallet ও payout\nOrder completed হওয়ার পরে seller wallet ও ledger-এ transaction দেখা যায়। Payout release platform-এর order, risk, dispute এবং payment rules-এর উপর নির্ভর করে। Available balance, reserved amount ও transaction reference মিলিয়ে দেখুন। Buyer confirm না করলে বা dispute থাকলে টাকা reserved/held থাকতে পারে।\n\n৮) Buyer communication ও account safety\nBuyer-এর প্রশ্নের উত্তর platform-এর seller chat-এ দিন এবং product-specific তথ্য সংরক্ষণ করুন। Buyer-এর OTP, payment PIN, card information বা অপ্রয়োজনীয় personal document চাইবেন না। কোনো buyer platform-এর বাইরে payment দিতে বললে বা suspicious আচরণ করলে report করুন।\n\n৯) Dispute হলে seller-এর করণীয়\nBuyer dispute করলে order details, delivery timestamp, inventory record, license/source evidence এবং chat context প্রস্তুত রাখুন। Buyer-কে threat বা pressure দেবেন না। ভুল delivery হলে দ্রুত সংশোধিত access দিন এবং admin review-এর জন্য সত্য তথ্য রাখুন। Fake screenshot, altered inventory বা misleading response দিলে seller trust ও account status ক্ষতিগ্রস্ত হতে পারে।\n\n১০) নিয়মিত seller checklist\nপ্রতিটি listing publish করার আগে category, title, price, image/video, specification, stock count, delivery mode, region, expiry, warranty এবং delivery note পরীক্ষা করুন। প্রতিটি auto-delivery product-এর inventory count দেখুন। Order এলে payment status যাচাই না করে delivery দেওয়ার দাবি করবেন না। Wallet ledger, notification এবং admin note নিয়মিত দেখুন।\n\nভালো seller হওয়ার মূল নিয়ম হলো: বাস্তব product দিন, সঠিক তথ্য লিখুন, secret data public করবেন না, inventory খালি রেখে auto delivery চালু করবেন না এবং buyer-কে platform-এর নিরাপদ order flow-এর মধ্যেই সহায়তা করুন।',
  'PUBLISHED',
  'Seller Education Hub | BikriKoro',
  'BikriKoro digital seller verification, listing, admin approval, stock, automatic delivery, order fulfillment, wallet ও dispute-এর Bengali গাইড।',
  now()
)
on conflict (slug) do update set
  content_type = excluded.content_type,
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  status = 'PUBLISHED',
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  published_at = now(),
  updated_at = now();

update public.admin_content
set title = 'Digital order status-এর ধাপগুলো কী?',
    excerpt = 'Digital order-এর payment, escrow, delivery ও completion status বুঝুন।',
    body = E'Digital order-এর সাধারণ flow হলো: order তৈরি, PENDING_PAYMENT, payment verified, ESCROW_HELD, automatic অথবা seller manual digital delivery, DIGITAL_DELIVERED, buyer access confirmation এবং COMPLETED। Payment না হলে seller delivery শুরু করবেন না। Delivery না এলে বা access কাজ না করলে buyer confirm না করে Order Detail থেকে report বা dispute খুলবেন।',
    status = 'PUBLISHED',
    updated_at = now(),
    published_at = coalesce(published_at, now())
where slug = 'faq-order-status-steps';

update public.admin_content
set title = 'Seller digital order preparation কীভাবে শুরু করেন?',
    excerpt = 'Payment verified হওয়ার পরে digital delivery প্রস্তুত করুন।',
    body = E'Payment verify হয়ে order ESCROW_HELD হলে seller Order বা Seller Dashboard-এ order details দেখবেন। Auto delivery হলে আগে থেকে রাখা key, file, access instruction অথবা account inventory থেকে protected delivery তৈরি হতে পারে। Inventory না থাকলে seller manual delivery content দেবেন। Public chat-এ password বা secret পাঠাবেন না।',
    status = 'PUBLISHED',
    updated_at = now(),
    published_at = coalesce(published_at, now())
where slug = 'faq-seller-preparation';

update public.admin_content
set title = 'Buyer digital delivery পেয়ে কীভাবে confirm করবেন?',
    excerpt = 'Access, key বা file কাজ করছে কি না যাচাই করে confirm করুন।',
    body = E'Digital delivery ready হলে Order Detail বা Digital Library-তে access information দেখতে পারেন। Key valid, file usable অথবা account access listing-এর সঙ্গে মিলছে কি না যাচাই করুন। সব ঠিক থাকলে buyer confirm করলে order COMPLETED flow-এ যেতে পারে। সমস্যা থাকলে confirm না করে dispute খুলুন।',
    status = 'PUBLISHED',
    updated_at = now(),
    published_at = coalesce(published_at, now())
where slug = 'faq-buyer-received-confirmation';

update public.admin_content
set title = 'Digital delivery না এলে বা access ভুল হলে কী করব?',
    excerpt = 'Delivery না পেলে confirm না করে order support path ব্যবহার করুন।',
    body = E'Payment verified হওয়ার পরও delivery না এলে, key invalid হলে, file খুলতে না পারলে বা account access listing-এর সঙ্গে না মিললে buyer confirm করবেন না। Order Detail থেকে report বা dispute খুলে order ID, error message, screenshot এবং delivery context দিন। Admin review চলাকালীন dispute thread-এ নতুন evidence যোগ করুন।',
    status = 'PUBLISHED',
    updated_at = now(),
    published_at = coalesce(published_at, now())
where slug = 'faq-product-not-received';

update public.admin_content
set title = 'কীভাবে digital seller হব?',
    excerpt = 'Digital seller হতে verification, listing quality ও admin approval দরকার।',
    body = E'Become Seller page-এ Digital option বেছে seller type নির্বাচন করুন। Personal, Business অথবা Company অনুযায়ী identity, address, ownership এবং প্রযোজ্য business documents জমা দিন। Admin review শেষ হলে approved seller listing তৈরি করতে পারবেন। Listing submit করার পরে product approval প্রয়োজন হতে পারে।',
    status = 'PUBLISHED',
    updated_at = now(),
    published_at = coalesce(published_at, now())
where slug = 'faq-become-seller';

update public.admin_content
set status = 'ARCHIVED', updated_at = now()
where slug in ('faq-seller-shipped-delivered', 'faq-free-delivery-cod-badge');
