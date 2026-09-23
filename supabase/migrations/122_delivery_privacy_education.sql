-- Clarify manual delivery and secure-delivery privacy boundaries.
-- This migration deliberately does not claim end-to-end encryption: the current
-- automatic-delivery architecture uses a verified server gateway to store and
-- release delivery content, so a true E2E design needs a separate key-exchange flow.

update public.admin_content
set body = body || E'\n\n৯) Automatic বনাম Manual delivery এবং privacy\nAutomatic delivery বেছে নিলে payment verified হওয়ার পরে system আগে থেকে সংরক্ষিত delivery content buyer-এর order-এ দিতে পারে। এখানে শুধু buyer-এর প্রাপ্য key, account access, download link বা instruction দিন। Manual delivery বেছে নিলে listing তৈরি করার সময় কোনো password, key বা secret দেওয়া বাধ্যতামূলক নয়; payment verified হওয়ার পরে Seller Dashboard/Orders থেকে প্রতিটি order দেখে নিজে delivery দিন।\n\nDigital delivery content browser থেকে সরাসরি public table-এ পড়া যায় না এবং Firebase-verified server gateway ছাড়া access দেওয়া হয় না। তবে বর্তমান automatic delivery architecture-কে true end-to-end encryption বলা যাবে না—content server-side delivery workflow-এর মাধ্যমে process হয়। তাই seller এমন কোনো তথ্য দেবেন না যা platform-এর authorized security, support বা legal process-এর বাইরে একেবারেই অদৃশ্য থাকার দাবি করা হচ্ছে। BikriKoro সত্যিকারের E2E key-exchange চালু না করা পর্যন্ত “আমরা কোনোভাবেই দেখতে পারি না” এমন প্রতিশ্রুতি দেয় না।\n\nPassword বা recovery credential দিলে buyer-কে listing-এর শর্ত অনুযায়ী দ্রুত password পরিবর্তনের নির্দেশ দিন। Public description, image, chat বা review-এ secret credential দেবেন না।',
    updated_at = now()
where content_type = 'SELLER_EDU'
  and slug = 'seller-education'
  and body not like '%Automatic বনাম Manual delivery এবং privacy%';

update public.admin_content
set body = body || E'\n\n১২. Digital delivery content-এর নিরাপত্তা\nAutomatic delivery content public browser table read-এর জন্য উন্মুক্ত নয় এবং Firebase-verified server gateway ও database access policy-এর মাধ্যমে সীমাবদ্ধ করা হয়। Manual delivery-তে listing form-এ secret content দেওয়া বাধ্যতামূলক নয়। বর্তমান automatic delivery design true end-to-end encryption নয়, কারণ secure delivery workflow-এ server-side processing থাকে; তাই “BikriKoro কোনোভাবেই content দেখতে পারে না” এমন দাবি করা যাবে না। E2E encryption চালু করতে seller ও buyer-এর মধ্যে আলাদা public-key exchange, key rotation, recovery এবং order-level decryption flow প্রয়োজন। সেই ব্যবস্থা live না হওয়া পর্যন্ত seller-কে কেবল delivery-এর জন্য প্রয়োজনীয় minimum information দিতে হবে এবং public channel-এ secret রাখা যাবে না।',
    updated_at = now()
where content_type = 'SELLER_PRIVACY'
  and slug = 'seller-privacy-policy'
  and body not like '%Digital delivery content-এর নিরাপত্তা%';
