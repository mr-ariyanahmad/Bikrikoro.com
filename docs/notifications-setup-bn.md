# BikriKoro নোটিফিকেশন ও Firebase Push সেটআপ

এই নথিতে BikriKoro.Com-এর **in-app notification**, **browser Firebase push notification**, এবং admin campaign console চালু করার জন্য production setup দেওয়া হলো। নতুন notification backend `supabase/migrations/028_notifications_push.sql`-এ রাখা হয়েছে। Firebase-এর web push SDK চালাতে production site অবশ্যই HTTPS-এ পরিবেশিত হতে হবে, কারণ browser push service worker-এর উপর নির্ভর করে। [1]

> **গুরুত্বপূর্ণ:** Firebase service-account private key কখনো React/Vite frontend, GitHub repository, বা `VITE_*` variable-এ রাখা যাবে না। এটি শুধু Vercel server environment variable হিসেবে সংরক্ষণ করতে হবে।

## ১. Firebase Console প্রস্তুতি

প্রথমে Android app এবং BikriKoro web app যেন একই Firebase project ব্যবহার করে তা নিশ্চিত করুন। Firebase Console-এ গিয়ে **Project settings → General → Your apps** থেকে web app-এর configuration নিন। Existing `VITE_FIREBASE_*` variables-এ আগের মানই থাকবে; Firebase project পরিবর্তন করলে Firebase UID-এর সঙ্গে Supabase profile mapping নষ্ট হতে পারে।

এরপর **Project settings → Cloud Messaging → Web configuration → Web Push certificates** অংশে যান এবং **Generate key pair** চাপুন। Firebase-এর এই public Web Push credential-ই VAPID key; এটি browser-কে push service-এ subscribe করতে সাহায্য করে। [1]

নতুন Firebase project হলে Cloud Messaging API এবং প্রয়োজনে FCM Registration API enabled আছে কি না দেখুন। Firebase-এর official guide অনুযায়ী web FCM SDK-এর জন্য browser Push API support এবং HTTPS দরকার। [1]

## ২. Vercel environment variables

Vercel project-এর **Settings → Environment Variables**-এ নিচের variables যোগ করুন। `Production`, `Preview`, এবং প্রয়োজন হলে `Development` environment-এ সঠিকভাবে সেট করুন।

| Variable | কোথা থেকে পাবেন | কোথায় ব্যবহার হয় |
| --- | --- | --- |
| `VITE_FIREBASE_VAPID_KEY` | Firebase Console → Project settings → Cloud Messaging → Web Push certificates → public key | Browser-এ FCM token তৈরি করতে |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Firebase Console → Project settings → Service accounts → Generate new private key | Vercel server-side push endpoint-এ |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Project settings → API → service_role secret | শুধু Vercel API endpoint-এ admin RPC চালাতে |
| `VITE_SUPABASE_URL` | Supabase Project settings → API | Existing frontend এবং Vercel endpoint |
| `VITE_SUPABASE_ANON_KEY` | Supabase Project settings → API | Existing frontend |

`FIREBASE_SERVICE_ACCOUNT_JSON` variable-এ downloaded JSON file-এর সম্পূর্ণ content এক লাইনে paste করুন। JSON-এ সাধারণত `project_id`, `client_email`, এবং escaped `private_key` থাকে। বিকল্প হিসেবে JSON না রাখতে চাইলে endpoint এই তিনটি আলাদা variable-ও নিতে পারে: `FIREBASE_ADMIN_PROJECT_ID`, `FIREBASE_ADMIN_CLIENT_EMAIL`, এবং `FIREBASE_ADMIN_PRIVATE_KEY`।

`SUPABASE_SERVICE_ROLE_KEY` কোনোভাবেই `VITE_` prefix দিয়ে রাখবেন না। Vite-এর `VITE_*` variables browser bundle-এ চলে যেতে পারে, কিন্তু service role key অবশ্যই server-only থাকতে হবে।

## ৩. Service worker এবং frontend token registration

Repository-তে `public/firebase-messaging-sw.js` root path-এ রাখা আছে। FCM web setup-এর জন্য `firebase-messaging-sw.js` domain root-এ থাকা প্রয়োজন; Firebase-এর guide-এও এই file root-এ রাখার কথা বলা হয়েছে। [1]

Signed-in user-এর browser notification permission চাইবে, service worker register করবে, `VITE_FIREBASE_VAPID_KEY` দিয়ে FCM token তৈরি করবে, এবং `register_notification_push_token` RPC-এর মাধ্যমে token Supabase-এ সংরক্ষণ করবে। Token-এর সঙ্গে Firebase UID যুক্ত থাকে, তাই admin campaign পাঠানোর সময় relevant user-এর token-ই নেওয়া হয়। Browser permission denied হলে existing login বা in-app notification বন্ধ হবে না; শুধু ওই browser-এ push বন্ধ থাকবে।

FCM payload-এ title, body এবং app link দেওয়া হয়। Background অবস্থায় service worker notification দেখায় এবং notification tap করলে সেই link-এ BikriKoro.Com খুলে। Firebase Admin SDK multicast send করার সময় এক invocation-এ সর্বোচ্চ 500টি target পাঠানো যায়, তাই endpoint 500-token batch করে delivery status ধরে রাখে। [2]

## ৪. Supabase migration চালানোর ক্রম

Supabase SQL Editor বা আপনার migration workflow-এ আগের migration-গুলোর পরে `028_notifications_push.sql` চালান। Migration 028 চালানোর আগে সাধারণত 013 থেকে 027 পর্যন্ত migration প্রয়োগ থাকা দরকার, কারণ notification table, profiles, seller verification, admin permission, audit log, wallet ledger, chat thread এবং chat message-এর উপর এটি নির্ভর করে।

Migration 028 এই জিনিসগুলো যোগ করে:

| অংশ | কাজ |
| --- | --- |
| `notification_push_tokens` | প্রতি user-এর enabled browser FCM token সংরক্ষণ করে |
| `notification_campaigns` | Admin campaign-এর target, content, status ও aggregate statistics রাখে |
| `notification_deliveries` | In-app এবং push delivery আলাদাভাবে audit করে |
| `notify_seller_verification_event` | Seller registration submit বা review status বদলালে notification তৈরি করে |
| `notify_wallet_event` | Wallet ledger-এ credit/debit হলে notification তৈরি করে |
| `notify_chat_message_event` | Chat message insert হলে অপর পক্ষকে notification তৈরি করে |
| `admin_create_notification_campaign` | Permission-scoped in-app broadcast তৈরি করে |
| `admin_get_campaign_push_targets` | Campaign-এর user এবং active push token দেয় |
| `admin_record_push_delivery` | Firebase success/failure record করে; invalid token disable করে |
| `admin_finish_notification_campaign` | Sent, partial বা failed status এবং counters finalize করে |
| `get_my_unread_notification_count` | Header badge-এর unread count দেয় |

013 migration-এর existing order trigger order insert বা status change-এর notification চালু রাখে। 028 migration নতুন verification, wallet এবং chat event যুক্ত করে। Admin campaign পাঠানোর সময় `admin_assert_permission(p_admin_id, 'content.notifications')` এবং audit log ব্যবহার করা হয়; তাই permission ছাড়া কোনো admin broadcast পাঠাতে পারবে না।

## ৫. Admin campaign পাঠানোর নিয়ম

Admin panel-এর **কনটেন্ট → নোটিফিকেশন** page-এ গিয়ে campaign তৈরি করুন। Title, Bengali message এবং optional app link দেওয়ার পর audience বেছে নিন।

| Target | কারা পাবে |
| --- | --- |
| **সব user** | Block করা account বাদে সব profile |
| **কাস্টমার** | Seller listing বা approved seller verification নেই এমন profile |
| **সেলার** | Product listing আছে অথবা approved seller verification আছে এমন profile |
| **নির্দিষ্ট user** | Firebase UID-এর তালিকা; প্রতি লাইনে একটি UID বা comma-separated UID |

`Firebase push পাঠান` চালু থাকলে দুটি channel-এই notification যাবে: প্রথমে user-এর in-app inbox-এ campaign record হবে, তারপর active browser token-গুলোর মাধ্যমে Firebase push পাঠানোর চেষ্টা হবে। Push permission না দেওয়া user in-app notification অবশ্যই দেখতে পাবে, কিন্তু browser push পাবে না। Campaign history-তে target, recipient count, push sent count, failure count এবং status দেখা যাবে।

## ৬. Test checklist

প্রথমে migration 028 চালিয়ে Supabase-এ functions এবং tables তৈরি হয়েছে কি না দেখুন। এরপর Vercel variables save করে নতুন deployment দিন। Production HTTPS domain-এ একজন test user দিয়ে sign in করুন এবং browser notification permission **Allow** করুন। Browser DevTools-এর Application → Service Workers অংশে `/firebase-messaging-sw.js` active আছে কি না যাচাই করুন।

Admin account দিয়ে **কনটেন্ট → নোটিফিকেশন** খুলে একটি ছোট **নির্দিষ্ট user** campaign পাঠান। In-app inbox-এ notification দেখা, header bell-এর unread badge বাড়া, এবং browser background অবস্থায় push আসা—এই তিনটি আলাদাভাবে পরীক্ষা করুন। Push tap করলে campaign-এর app link খুলছে কি না দেখুন।

এরপর Firebase Console-এর Cloud Messaging test flow-তে চাইলে সেই browser token দিয়ে test message পাঠানো যায়; Firebase official guide-এ test notification-এর জন্য registration token ব্যবহার করে background device-এ test করার ধাপ দেওয়া আছে। [1]

যদি push না আসে, প্রথমে browser permission, HTTPS, service worker scope, VAPID key, Firebase project match এবং Vercel service-account variables যাচাই করুন। Firebase Admin delivery endpoint error করলে Admin campaign history-তে in-app delivery থাকবে, কিন্তু push status queued বা failed হিসেবে দেখা যেতে পারে; এটি ইচ্ছাকৃতভাবে in-app channel-কে push failure থেকে আলাদা রাখে।

## ৭. নিরাপত্তা ও অপারেশনাল নোট

Firebase service-account JSON, Supabase service-role key এবং private VAPID key কখনো Git commit বা frontend bundle-এ রাখা যাবে না। Client-side-এ শুধু public VAPID key থাকবে। Server endpoint Firebase ID token verify করে, তারপর Supabase permission-scoped RPC-এর মাধ্যমে campaign target এবং delivery record পরিচালনা করে। Firebase Admin SDK delivery result-এর response order target list-এর সঙ্গে মিলে যায়, তাই প্রতিটি token-এর success বা failure আলাদাভাবে record করা সম্ভব। [2] [3]

খুব বড় audience-এ campaign পাঠানোর আগে ছোট user list-এ পরীক্ষা করুন। Firebase multicast limit অনুযায়ী endpoint 500-token batch ব্যবহার করে; future-এ কোটি user হলে queue/worker, retry policy, rate limit এবং provider-level topic strategy যোগ করা উচিত। বর্তমান implementation অকারণে browser-এ Firebase secret পাঠায় না এবং পুরোনো Firebase auth, Supabase wallet, order বা payment flow পরিবর্তন করে না।

## References

[1]: https://firebase.google.com/docs/cloud-messaging/web/get-started "Firebase — Get started with Firebase Cloud Messaging in Web apps"
[2]: https://firebase.google.com/docs/cloud-messaging/send/admin-sdk "Firebase — Send a message using the Firebase Admin SDK"
[3]: https://firebase.google.com/docs/reference/admin/node/firebase-admin.messaging.messaging "Firebase Admin Node.js Messaging reference"
