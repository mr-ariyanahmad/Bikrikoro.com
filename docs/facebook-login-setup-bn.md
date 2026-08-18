# BikriKoro Facebook Login Setup

## Code status

BikriKoro login page-এ এখন Google button-এর নিচে **Facebook দিয়ে চালিয়ে যান** button আছে। Firebase `FacebookAuthProvider` ব্যবহার করে popup-first login হয় এবং browser popup block করলে redirect fallback ব্যবহার করে। Existing phone OTP, email/password এবং Google login flow অপরিবর্তিত থাকে। Facebook login সফল হলে একই Firebase UID, profile bootstrap, protected route এবং Supabase profile flow ব্যবহার হবে।

## Firebase Console

1. Firebase Console-এ একই `com-bikrikoro` project খুলুন।
2. **Authentication → Sign-in method**-এ যান।
3. **Facebook** provider খুলে Enable করুন।
4. Facebook Developer App-এর **App ID** এবং **App Secret** এখানে বসিয়ে Save করুন।
5. Authorized domains-এ `bikrikoro.com`, `www.bikrikoro.com`, `localhost` এবং OAuth custom domain ব্যবহার করলে `auth.bikrikoro.com` রাখুন।

## Meta for Developers

1. [Meta for Developers](https://developers.facebook.com/) খুলে **My Apps → Create App** চাপুন।
2. Consumer বা আপনার business-এর উপযুক্ত app type নির্বাচন করুন।
3. App তৈরি হলে **Add Product → Facebook Login** যোগ করুন।
4. **Facebook Login → Settings**-এ Valid OAuth Redirect URIs হিসেবে বর্তমানে এই URL যোগ করুন:

```text
https://com-bikrikoro.firebaseapp.com/__/auth/handler
```

5. Custom Firebase auth domain `auth.bikrikoro.com` fully active করে Firebase web config-এর `authDomain` পরিবর্তন করার পরে এই callback-ও যোগ করুন:

```text
https://auth.bikrikoro.com/__/auth/handler
```

6. Meta app-এ App Domains হিসেবে `bikrikoro.com` এবং `auth.bikrikoro.com` যোগ করুন, যদি Meta UI এটি চায়।
7. Development test-এর সময় নিজের Facebook account-কে tester বা developer হিসেবে যোগ করুন। Public users-এর জন্য Meta app review, privacy policy URL, terms URL এবং app visibility/Live status প্রয়োজন হতে পারে।

## Test order

প্রথমে Firebase provider save করুন এবং Meta redirect URI ঠিকভাবে যোগ করুন। তারপর Vercel latest deployment খুলে Login page-এ Facebook button চাপুন। Popup-এ Facebook account দিয়ে Continue করলে user home page-এ যাওয়ার কথা। Popup block হলে redirect flow চালু হবে।

`auth/account-exists-with-different-credential` এলে একই email আগে Google, phone অথবা email/password দিয়ে account তৈরি করেছে। এই ক্ষেত্রে আগে existing method দিয়ে login করুন এবং পরে account linking flow ব্যবহার করতে হবে; একই email-এর duplicate profile তৈরি করা উচিত নয়।

## Security

Facebook App Secret কখনো Vercel `VITE_` variable, frontend code বা GitHub-এ রাখবেন না। App Secret শুধু Firebase Console-এর Facebook provider settings-এ রাখবেন। Login button-এর জন্য কোনো নতুন frontend secret বা Vercel variable লাগবে না।

## References

[1]: https://firebase.google.com/docs/auth/web/facebook-login — Firebase, “Authenticate Using Facebook Login with JavaScript”

[2]: https://developers.facebook.com/blog/post/2017/12/18/strict-uri-matching/ — Meta for Developers, “Strict URI Matching”
