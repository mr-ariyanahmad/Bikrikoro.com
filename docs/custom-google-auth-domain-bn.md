# BikriKoro Google Login-এর Custom Domain Setup

## কেন এখন `firebaseapp.com` দেখা যায়

BikriKoro website `bikrikoro.com`-এ থাকলেও Firebase web config-এর `authDomain` এখন Firebase-এর default domain। Google OAuth consent screen-এ তাই `com-bikrikoro.firebaseapp.com` দেখা যায়। এটি স্বাভাবিক এবং login কাজ করার জন্য নিরাপদ default configuration।

## Recommended domain

Google sign-in-এর জন্য আলাদা subdomain ব্যবহার করুন:

```text
auth.bikrikoro.com
```

মূল website `bikrikoro.com` Vercel-এ থাকবে। শুধু Firebase OAuth handler-এর জন্য `auth.bikrikoro.com` Firebase Hosting-এ connect করতে হবে।

## সহজে করার ধাপ

### ধাপ ১ — Firebase Hosting-এ custom domain যোগ করুন

Firebase Console-এ একই `com-bikrikoro` project খুলে **Hosting → Add custom domain** চাপুন। Domain হিসেবে লিখুন:

```text
auth.bikrikoro.com
```

Firebase যে DNS record দেবে, সেটি আপনার domain provider-এ যোগ করুন। DNS verification এবং SSL certificate active হওয়া পর্যন্ত অপেক্ষা করুন। এই ধাপ শেষ না হওয়া পর্যন্ত website-এর `authDomain` পরিবর্তন করবেন না।

### ধাপ ২ — Authorized domains-এ domain যোগ করুন

Firebase Console → **Authentication → Settings → Authorized domains**-এ যোগ করুন:

```text
auth.bikrikoro.com
```

বর্তমান `bikrikoro.com`, `www.bikrikoro.com`, `com-bikrikoro.firebaseapp.com`, `com-bikrikoro.web.app` এবং `localhost` সরাবেন না।

### ধাপ ৩ — Google OAuth redirect URL যোগ করুন

Google Cloud Console বা Identity Platform provider settings-এ custom callback URL হিসেবে যোগ করুন:

```text
https://auth.bikrikoro.com/__/auth/handler
```

যদি Google Cloud Console একটি authorized redirect domain চায়, সেখানে `auth.bikrikoro.com` যোগ করুন।

### ধাপ ৪ — Vercel environment variable বদলান

Firebase Hosting custom domain কাজ করছে নিশ্চিত হওয়ার পরে Vercel → Settings → Environment Variables-এ এই variable-এর value বদলান:

```text
VITE_FIREBASE_AUTH_DOMAIN=auth.bikrikoro.com
```

এটি **Production, Preview এবং Development**—তিন environment-এ update করুন। অন্য Firebase variables পরিবর্তন করবেন না। তারপর Vercel থেকে Redeploy করুন।

### ধাপ ৫ — Test করুন

Redeploy শেষ হলে নতুন private/incognito tab-এ `https://bikrikoro.com/login` খুলে Google login test করুন। Consent screen-এ `auth.bikrikoro.com` দেখা উচিত। Login কাজ না করলে সঙ্গে সঙ্গে আগের value ফিরিয়ে দিন:

```text
VITE_FIREBASE_AUTH_DOMAIN=com-bikrikoro.firebaseapp.com
```

তারপর redeploy করলে বর্তমান working login আবার ফিরে আসবে।

## গুরুত্বপূর্ণ সতর্কতা

শুধু Firebase Authorized domains-এ `auth.bikrikoro.com` যোগ করলে consent screen-এর domain বদলাবে না। Firebase Hosting custom domain, Google OAuth callback এবং Vercel `VITE_FIREBASE_AUTH_DOMAIN`—তিনটি একসাথে সঠিক না হলে custom domain কাজ করবে না। Setup শেষ হওয়ার আগে code বা Vercel value পরিবর্তন করবেন না।

## Current safe state

বর্তমান working configuration অপরিবর্তিত রাখা হয়েছে। Repository code ইতিমধ্যেই `VITE_FIREBASE_AUTH_DOMAIN` environment variable পড়ে, তাই Firebase Hosting ও Google OAuth setup সম্পূর্ণ হওয়ার পরে শুধু Vercel variable বদলালেই হবে।
