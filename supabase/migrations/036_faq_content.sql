-- BikriKoro — editable FAQ content
-- Each FAQ question is one admin_content row. Answers live in body.

alter table public.admin_content
  add column if not exists sort_order integer not null default 0;

create index if not exists idx_admin_content_faq_order
  on public.admin_content(content_type, status, sort_order, published_at desc);

-- Replace the content RPC so FAQ order is editable while older callers remain valid.
drop function if exists public.admin_upsert_content(text, uuid, text, text, text, text, text, text, text, text, text);
create or replace function public.admin_upsert_content(
  p_admin_id text,
  p_id uuid,
  p_content_type text,
  p_title text,
  p_slug text,
  p_excerpt text,
  p_body text,
  p_status text,
  p_cover_image_url text default null,
  p_seo_title text default null,
  p_seo_description text default null,
  p_sort_order integer default 0
) returns void as $$
begin
  perform public.admin_assert(p_admin_id);
  if p_content_type not in ('BLOG', 'ANNOUNCEMENT', 'ABOUT', 'PRIVACY', 'CONTACT', 'HELP', 'FAQ', 'USER_EDU', 'SELLER_EDU', 'RETURN_POLICY', 'TERMS', 'SETTINGS') then
    raise exception 'Invalid content type';
  end if;
  if p_status not in ('DRAFT', 'PUBLISHED', 'ARCHIVED') then
    raise exception 'Invalid content status';
  end if;
  if coalesce(trim(p_title), '') = '' or coalesce(trim(p_slug), '') = '' then
    raise exception 'Title and slug are required';
  end if;

  if p_id is null then
    insert into public.admin_content(
      content_type, title, slug, excerpt, body, status, author_id,
      cover_image_url, seo_title, seo_description, published_at, sort_order
    ) values (
      p_content_type, trim(p_title), lower(trim(p_slug)), coalesce(p_excerpt, ''),
      coalesce(p_body, ''), p_status, coalesce(current_setting('request.jwt.claim.sub', true), null),
      nullif(trim(coalesce(p_cover_image_url, '')), ''),
      nullif(trim(coalesce(p_seo_title, '')), ''),
      nullif(trim(coalesce(p_seo_description, '')), ''),
      case when p_status = 'PUBLISHED' then now() else null end,
      coalesce(p_sort_order, 0)
    );
  else
    update public.admin_content
    set content_type = p_content_type,
        title = trim(p_title),
        slug = lower(trim(p_slug)),
        excerpt = coalesce(p_excerpt, ''),
        body = coalesce(p_body, ''),
        status = p_status,
        cover_image_url = nullif(trim(coalesce(p_cover_image_url, '')), ''),
        seo_title = nullif(trim(coalesce(p_seo_title, '')), ''),
        seo_description = nullif(trim(coalesce(p_seo_description, '')), ''),
        published_at = case when p_status = 'PUBLISHED' then coalesce(published_at, now()) else published_at end,
        sort_order = coalesce(p_sort_order, 0),
        updated_at = now()
    where id = p_id;
    if not found then raise exception 'Content not found'; end if;
  end if;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function public.get_published_content(p_content_type text, p_slug text default null)
returns setof public.admin_content as $$
begin
  return query
  select * from public.admin_content
  where status = 'PUBLISHED'
    and content_type = p_content_type
    and (p_slug is null or slug = p_slug)
  order by
    case when p_content_type = 'FAQ' then sort_order else 0 end asc,
    coalesce(published_at, updated_at) desc;
end;
$$ language plpgsql security definer stable set search_path = public;

insert into public.admin_content(
  content_type, title, slug, excerpt, body, status, sort_order,
  seo_title, seo_description, published_at
) values
('FAQ', 'BikriKoro কী?', 'faq-bikrikoro-ki', 'BikriKoro কীভাবে কাজ করে?', E'BikriKoro বাংলাদেশের buyer ও seller-দের জন্য একটি digital marketplace। এখানে product খোঁজা, seller-এর সঙ্গে যোগাযোগ, order করা, payment status দেখা এবং order সম্পন্ন হওয়ার পর review দেওয়ার সুবিধা আছে।', 'PUBLISHED', 10, 'BikriKoro কী? | FAQ', 'BikriKoro marketplace কী এবং কীভাবে ব্যবহার করবেন—সাধারণ প্রশ্নের উত্তর।', now()),
('FAQ', 'BikriKoro-তে account কীভাবে খুলব?', 'faq-account-kivabe-khulbo', 'নতুন account তৈরি করার সহজ পদ্ধতি।', E'Login বা Register page-এ গিয়ে email/password, phone OTP অথবা Google login ব্যবহার করে account তৈরি করতে পারেন। নিজের সঠিক নাম, mobile এবং email ব্যবহার করুন, কারণ order, notification ও support-এর সময় এগুলো কাজে লাগে।', 'PUBLISHED', 20, 'BikriKoro account খোলার নিয়ম | FAQ', 'BikriKoro-তে account তৈরি ও login করার নিয়ম।', now()),
('FAQ', 'Password ভুলে গেলে কী করব?', 'faq-password-bhule-gele', 'Forgot password দিয়ে account recovery করুন।', E'Login page-এ Forgot password চাপুন এবং account-এর email দিন। আপনার email-এ reset link এলে নতুন password সেট করুন। Email না এলে spam বা promotions folder দেখুন এবং email ঠিক আছে কি না যাচাই করুন। Google login account-এর password reset Firebase email password-এর মাধ্যমে করতে হবে না; সেক্ষেত্রে Google login ব্যবহার করুন।', 'PUBLISHED', 30, 'Password ভুলে গেলে কী করবেন | BikriKoro FAQ', 'BikriKoro account password reset ও login সমস্যা সমাধানের নির্দেশনা।', now()),
('FAQ', 'Google login কাজ না করলে কী করব?', 'faq-google-login-kaj-na-korle', 'Google login সমস্যা হলে ধাপে ধাপে কী পরীক্ষা করবেন।', E'Browser-এ Google account নির্বাচন করে permission দিন এবং popup বা redirect block করা আছে কি না দেখুন। Mobile browser-এ third-party popup বন্ধ থাকলে অন্য browser বা নতুন tab ব্যবহার করুন। সমস্যা চললে account email, device এবং error message সহ Help Center-এ জানান।', 'PUBLISHED', 40, 'Google login সমস্যা সমাধান | BikriKoro FAQ', 'BikriKoro Google login কাজ না করলে কীভাবে সমাধান করবেন।', now()),
('FAQ', 'কীভাবে কোনো product কিনব?', 'faq-product-kenar-niyom', 'Product দেখুন, seller যাচাই করুন এবং নিরাপদে order করুন।', E'Products বা search থেকে product খুলে ছবি, description, price, condition, seller profile, verification badge এবং review দেখুন। এরপর Buy বা Order button চাপুন, delivery address ও payment method যাচাই করুন এবং order তৈরি করুন। Payment সম্পন্ন না হলে order escrow flow-এ যাবে না।', 'PUBLISHED', 50, 'BikriKoro-তে product কেনার নিয়ম | FAQ', 'Product খোঁজা, seller যাচাই এবং BikriKoro-তে নিরাপদ order করার নিয়ম।', now()),
('FAQ', 'কোন payment method ব্যবহার করা যায়?', 'faq-payment-method', 'Checkout-এ available payment option বেছে নিন।', E'Checkout-এ আপনার account ও product-এর জন্য যে payment option available থাকবে সেটিই ব্যবহার করুন। Hosted payment page থেকে payment সম্পন্ন করুন এবং callback page-এ ফেরত আসা পর্যন্ত tab বন্ধ করবেন না। Payment সফল হলেও order status update না হলে কিছুক্ষণ পরে Orders page refresh করুন।', 'PUBLISHED', 60, 'BikriKoro payment method | FAQ', 'BikriKoro order payment, hosted checkout ও payment status সম্পর্কে সাধারণ প্রশ্ন।', now()),
('FAQ', 'Escrow payment কীভাবে buyer-কে সুরক্ষা দেয়?', 'faq-escrow-payment', 'Payment ও seller payout-এর মাঝের নিরাপত্তা ব্যবস্থা।', E'Payment verify হওয়ার পরে টাকা order-এর escrow flow-এ থাকে। Seller preparation, shipment ও delivery status update করেন। Buyer পণ্য পেয়ে confirm করলে order completed হয় এবং system অনুযায়ী seller payout হয়। সমস্যা থাকলে dispute খোলা যায়; order-এর বাইরে আলাদা payment এড়িয়ে চলুন।', 'PUBLISHED', 70, 'Escrow payment কী | BikriKoro FAQ', 'BikriKoro escrow payment flow কীভাবে buyer ও seller-কে সুরক্ষা দেয়।', now()),
('FAQ', 'Order status-এর ধাপগুলো কী?', 'faq-order-status-steps', 'Place, preparation, delivery এবং completion-এর পুরো flow।', E'সাধারণ physical order flow হলো: order place, payment verified, escrow held, seller preparation, shipped, delivered, buyer received confirmation এবং completed। কোনো সমস্যা হলে shipped বা delivered অবস্থায় dispute report করা যায়। Digital product-এর delivery type অনুযায়ী library বা order detail-এ access দেওয়া হয়।', 'PUBLISHED', 80, 'BikriKoro order status ধাপ | FAQ', 'BikriKoro order place থেকে completed পর্যন্ত status flow-এর ব্যাখ্যা।', now()),
('FAQ', 'Seller order preparation কীভাবে শুরু করেন?', 'faq-seller-preparation', 'Seller-এর preparation ধাপের নিয়ম।', E'Payment verify হয়ে order seller-এর Orders বা Seller Dashboard-এ দেখা গেলে seller order details খুলে preparation শুরু করতে পারবেন। Product, quantity, address এবং delivery information যাচাই করে প্রস্তুতি নিন। প্রস্তুতি শেষ হলে পরের shipment action ব্যবহার করুন।', 'PUBLISHED', 90, 'Seller order preparation | BikriKoro FAQ', 'BikriKoro seller কীভাবে order প্রস্তুত করে fulfillment শুরু করবেন।', now()),
('FAQ', 'Seller কীভাবে order shipped বা delivered করবেন?', 'faq-seller-shipped-delivered', 'Seller-side fulfillment update কীভাবে কাজ করে।', E'Preparation শেষ হলে seller shipment mark করবেন এবং প্রয়োজনীয় courier বা delivery information রাখবেন। পণ্য বাস্তবে buyer-এর কাছে পৌঁছানোর পরে delivered mark করবেন। ভুল status আগে থেকে দেওয়া যাবে না, কারণ buyer confirmation, dispute এবং payout status-এর সঙ্গে এগুলো যুক্ত।', 'PUBLISHED', 100, 'Seller shipped delivered flow | BikriKoro FAQ', 'BikriKoro seller shipment ও delivery status update করার সঠিক ধাপ।', now()),
('FAQ', 'পণ্য পেলে buyer কীভাবে confirm করবেন?', 'faq-buyer-received-confirmation', 'Delivered order-এর receipt confirmation।', E'Seller delivered mark করার পরে Orders বা Order Detail page-এ পণ্য পেয়েছি বা confirm delivery action দেখা যাবে। Product ও quantity যাচাই করে confirm করুন। Confirm করার পরে order completed হবে এবং eligible seller payout system-এর নিয়মে এগোবে।', 'PUBLISHED', 110, 'Buyer received confirmation | BikriKoro FAQ', 'BikriKoro-তে পণ্য পাওয়ার পরে buyer কীভাবে delivery confirm করবেন।', now()),
('FAQ', 'পণ্য না পেলে বা ভুল পেলে কী করব?', 'faq-product-not-received', 'Order Detail থেকে report বা dispute খুলুন।', E'Seller delivered mark করলেও পণ্য না পেলে, ভুল পণ্য এলে, damaged হলে বা description-এর সঙ্গে না মিললে buyer confirmation না দিয়ে Order Detail থেকে dispute/report খুলুন। Order ID, ছবি, video বা courier evidence দিন এবং dispute thread-এ support-এর সঙ্গে যোগাযোগ রাখুন।', 'PUBLISHED', 120, 'Product না পেলে কী করবেন | BikriKoro FAQ', 'BikriKoro order না পাওয়া, ভুল বা damaged product হলে dispute করার নিয়ম।', now()),
('FAQ', 'Dispute বা claim কীভাবে খুলব?', 'faq-dispute-claim-kivabe', 'Order সমস্যা হলে evidence-সহ claim করুন।', E'Orders page থেকে নির্দিষ্ট order খুলে Report problem বা Dispute option চাপুন। সমস্যার ধরন, বিস্তারিত এবং প্রয়োজনীয় ছবি বা evidence যুক্ত করুন। একই order-এ duplicate open claim করা যাবে না। Admin review চলাকালীন dispute thread-এ নতুন তথ্য যোগ করতে পারবেন।', 'PUBLISHED', 130, 'BikriKoro dispute claim করার নিয়ম | FAQ', 'Order সমস্যা, evidence এবং admin dispute review সম্পর্কে BikriKoro FAQ।', now()),
('FAQ', 'Dispute resolve হতে কত সময় লাগে?', 'faq-dispute-resolution', 'Admin evidence দেখে সিদ্ধান্ত নেন।', E'Dispute-এর সময় evidence, buyer-seller message, delivery status এবং payment/order record-এর উপর নির্ভর করে। Admin সিদ্ধান্ত নেওয়ার পরে buyer ও seller notification পান। Claim approve হলে policy অনুযায়ী refund বা order resolution হতে পারে; deny হলে order-এর পরের valid step চালু থাকে।', 'PUBLISHED', 140, 'Dispute resolution | BikriKoro FAQ', 'BikriKoro dispute claim review, refund ও resolution process।', now()),
('FAQ', 'Order completed হলে rating কীভাবে দেব?', 'faq-rating-review', 'Completed order-এর পরে review লিখুন।', E'Buyer order received confirm করে order completed হওয়ার পরে Review বা Rating option দেখতে পাবেন। Product-এর quality, description match, delivery এবং seller communication সম্পর্কে সৎ feedback দিন। একই order-এ duplicate review করা যাবে না এবং ভুল তথ্য বা abusive language এড়িয়ে চলুন।', 'PUBLISHED', 150, 'BikriKoro rating review | FAQ', 'BikriKoro completed order-এর পরে product ও seller review দেওয়ার নিয়ম।', now()),
('FAQ', 'Order cancel করা যাবে কি?', 'faq-order-cancel', 'Order status অনুযায়ী cancellation সম্ভব হতে পারে।', E'Order cancel করার সুযোগ status, payment এবং dispute অবস্থার উপর নির্ভর করে। Payment না হলে unpaid order cancel করা যেতে পারে। Payment verify হওয়ার পরে seller fulfillment শুরু করলে cancellation-এর বদলে Order Detail থেকে dispute বা support path ব্যবহার করতে হতে পারে। Cancel করার আগে order policy ও notification দেখে নিন।', 'PUBLISHED', 160, 'BikriKoro order cancel | FAQ', 'BikriKoro order cancellation, payment ও fulfillment status-এর নিয়ম।', now()),
('FAQ', 'Digital product কীভাবে পাব?', 'faq-digital-product-delivery', 'Payment ও completion-এর পরে digital delivery access।', E'Digital product কিনলে seller-এর delivery type অনুযায়ী instructions, license key বা download link দেওয়া হতে পারে। Payment verify এবং order flow সম্পন্ন হওয়ার পরে Order Detail বা Digital Library থেকে access দেখুন। Public chat বা review-এ license key বা private download link প্রকাশ করবেন না।', 'PUBLISHED', 170, 'Digital product delivery | BikriKoro FAQ', 'BikriKoro digital product payment, delivery এবং library access-এর নিয়ম।', now()),
('FAQ', 'কীভাবে seller হব?', 'faq-become-seller', 'Physical বা digital seller হওয়ার শুরু।', E'Become Seller page-এ গিয়ে আগে Physical বা Digital option বেছে নিন। Physical listing দিয়ে শুরু করা যায়। Digital product বিক্রি করতে হলে seller type নির্বাচন করে প্রয়োজনীয় identity, address এবং business documents জমা দিতে হবে। Admin review ও approval না হওয়া পর্যন্ত restricted seller সুবিধা চালু হবে না।', 'PUBLISHED', 180, 'BikriKoro seller হওয়ার নিয়ম | FAQ', 'BikriKoro physical ও digital seller onboarding এবং approval process।', now()),
('FAQ', 'Digital seller verification কেন দরকার?', 'faq-digital-seller-verification', 'Digital seller-এর শক্ত verification process।', E'Digital product-এ delivery, license বা download access থাকে, তাই buyer trust ও marketplace safety-এর জন্য অতিরিক্ত verification দরকার। Personal, business বা company type অনুযায়ী NID, selfie, address, trade license বা company information চাওয়া হতে পারে। Admin approve করার পরে digital listing permission দেওয়া হয়।', 'PUBLISHED', 190, 'Digital seller verification | BikriKoro FAQ', 'BikriKoro digital seller verification documents ও admin approval সম্পর্কে তথ্য।', now()),
('FAQ', 'Product listing admin approval কীভাবে হয়?', 'faq-product-admin-approval', 'নতুন product publish হওয়ার আগে review।', E'Seller listing তৈরি করার পরে product admin review queue-তে যেতে পারে। Admin title, image, category, price, policy compliance এবং product quality দেখে approve বা reject করতে পারেন। Rejected listing-এর note seller দেখতে পাবেন এবং প্রয়োজনে edit করে আবার submit করতে পারবেন।', 'PUBLISHED', 200, 'Product admin approval | BikriKoro FAQ', 'BikriKoro product listing approval, rejection note ও seller review process।', now()),
('FAQ', 'Seller approval history কোথায় দেখা যায়?', 'faq-seller-approval-history', 'Admin decision audit trail।', E'Seller verification approve বা reject হলে decision history admin panel-এ সংরক্ষিত থাকে। সেখানে decision নেওয়া admin-এর Gmail বা UID, সময় এবং note দেখা যায়। Seller-side status থেকে বুঝতে পারবেন verification pending, approved না rejected।', 'PUBLISHED', 210, 'Seller approval history | BikriKoro FAQ', 'BikriKoro seller verification decision history ও admin audit information।', now()),
('FAQ', 'Seller-এর সঙ্গে chat কীভাবে করব?', 'faq-seller-chat', 'Product page থেকে নিরাপদে seller message করুন।', E'Product detail page-এ Chat বা seller message option থাকলে সেটি ব্যবহার করুন। Order, product condition, delivery এবং availability নিয়ে platform-এর ভিতরে কথা বলুন। OTP, password, card information বা অপ্রয়োজনীয় ব্যক্তিগত তথ্য chat-এ পাঠাবেন না।', 'PUBLISHED', 220, 'Seller chat | BikriKoro FAQ', 'BikriKoro buyer-seller chat নিরাপদে ব্যবহার করার নিয়ম।', now()),
('FAQ', 'Notification কীভাবে চালু করব?', 'faq-notification-enable', 'In-app ও browser push notification।', E'Notifications page-এ গেলে notification permission-এর আগে BikriKoro-এর branded prompt দেখা যাবে। সকল update পেতে Enable notifications চাপুন এবং browser permission Allow করুন। In-app notification inbox account-এর ভিতরে থাকবে; browser permission বন্ধ থাকলেও inbox দেখতে পারবেন।', 'PUBLISHED', 230, 'BikriKoro notification চালু | FAQ', 'BikriKoro in-app notification ও browser push permission চালু করার নিয়ম।', now()),
('FAQ', 'Wallet, reward বা daily check-in কীভাবে কাজ করে?', 'faq-wallet-rewards-checkin', 'Wallet balance ও reward history দেখুন।', E'Account বা Rewards page থেকে wallet, reward এবং daily check-in status দেখতে পারবেন। Check-in সফল হলে system অনুযায়ী reward যোগ হয় এবং notification আসতে পারে। Balance বা transaction নিয়ে সমস্যা হলে transaction reference সহ support-এ জানান; password বা OTP কাউকে দেবেন না।', 'PUBLISHED', 240, 'Wallet reward daily check-in | BikriKoro FAQ', 'BikriKoro wallet, reward, VIP এবং daily check-in সম্পর্কে সাধারণ প্রশ্ন।', now()),
('FAQ', 'Free delivery বা COD badge-এর অর্থ কী?', 'faq-free-delivery-cod-badge', 'Product সুবিধাগুলো product card-এ দেখুন।', E'Product card বা detail page-এ দেখানো Free delivery, Fast delivery, COD বা Free return badge seller-এর listing configuration থেকে আসে। Order করার আগে delivery location, eligibility, cost এবং seller-এর description যাচাই করুন। সব product বা সব location-এ একই সুবিধা প্রযোজ্য নাও হতে পারে।', 'PUBLISHED', 250, 'Free delivery COD badge | BikriKoro FAQ', 'BikriKoro product delivery, COD ও listing benefit badge-এর অর্থ।', now()),
('FAQ', 'Product-এ YouTube video কীভাবে দেখব?', 'faq-product-youtube-video', 'Product video প্রথমে, তারপর ছবি swipe করুন।', E'Seller valid YouTube video link দিলে product detail page-এ video thumbnail প্রথম media হিসেবে দেখা যাবে। ভিডিও চালু করতে “ভিডিও চালু করুন” চাপুন। Mobile-এ thumbnail অবস্থায় swipe করলে product images দেখা যাবে। সব video YouTube policy ও seller-provided content-এর উপর নির্ভরশীল।', 'PUBLISHED', 260, 'Product YouTube video | BikriKoro FAQ', 'BikriKoro product page-এ YouTube video দেখা ও swipe gallery ব্যবহার করার নিয়ম।', now()),
('FAQ', 'কীভাবে product report করব?', 'faq-report-product', 'ভুল, নিষিদ্ধ বা প্রতারণামূলক listing জানান।', E'Product detail page-এর report option ব্যবহার করে কারণ নির্বাচন করুন এবং সংক্ষিপ্ত বিস্তারিত লিখুন। Fake product, prohibited item, misleading price, copied image বা suspicious behavior হলে evidence দিন। Admin review না হওয়া পর্যন্ত অভিযোগের তথ্য public comment বা chat-এ ছড়াবেন না।', 'PUBLISHED', 270, 'Product report | BikriKoro FAQ', 'BikriKoro product report, policy violation ও safety support-এর নিয়ম।', now()),
('FAQ', 'আমার personal information কীভাবে ব্যবহৃত হয়?', 'faq-privacy-information', 'Privacy ও account safety সম্পর্কে জানুন।', E'Account, order, chat, payment এবং verification information marketplace service, fraud prevention, support এবং notification-এর জন্য ব্যবহার করা হতে পারে। Verification documents public product page-এ দেখানো হয় না। বিস্তারিত জানতে Privacy Policy পড়ুন এবং password, OTP বা payment PIN কারও সঙ্গে share করবেন না।', 'PUBLISHED', 280, 'BikriKoro privacy FAQ', 'BikriKoro personal information, verification document ও account privacy নীতি।', now()),
('FAQ', 'সমস্যা হলে Support-এ কীভাবে যোগাযোগ করব?', 'faq-contact-support', 'Order ID ও পরিষ্কার বিবরণ দিন।', E'Order সমস্যা হলে প্রথমে Order Detail থেকে report বা dispute খুলুন, কারণ এতে order context ও evidence যুক্ত থাকে। সাধারণ account, payment বা feature সমস্যায় Help Center বা Contact page ব্যবহার করুন। Support message-এ আপনার email, order ID, কী হয়েছে এবং কখন হয়েছে—এই তথ্য দিলে দ্রুত সাহায্য করা সহজ হয়।', 'PUBLISHED', 290, 'BikriKoro support contact | FAQ', 'BikriKoro support, Help Center ও order issue যোগাযোগের নিয়ম।', now())
on conflict (slug) do nothing;
