# BikriKoro-তে Agent Router সংযোগের নির্দেশনা

## কী যোগ করা হয়েছে

BikriKoro-এর browser থেকে সরাসরি Agent Router API call করা হবে না। `api/agent-router.ts` একটি server-side proxy হিসেবে কাজ করে। Browser শুধু `/api/agent-router`-এ Bengali question পাঠাবে; server-side function `AGENT_ROUTER_API_KEY` ব্যবহার করে upstream Agent Router-এ request পাঠাবে। এতে secret browser bundle, localStorage বা public GitHub code-এ যাবে না।

## Vercel Environment Variables

Vercel Project Settings → Environment Variables-এ নিচের variable যোগ করুন। Production, Preview এবং Development—যে environment-এ ব্যবহার করবেন সেখানে সেট করুন।

```text
AGENT_ROUTER_BASE_URL=https://আপনার-agent-router-host
AGENT_ROUTER_API_KEY=আপনার-গোপন-api-key
AGENT_ROUTER_MODEL=আপনার-default-model
AGENT_ROUTER_CHAT_PATH=/v1/chat/completions
```

`AGENT_ROUTER_CHAT_PATH` কেবল তখন পরিবর্তন করবেন যখন আপনার provider-এর chat endpoint `/v1/chat/completions` নয়। বর্তমান proxy OpenAI-compatible JSON contract ধরে পাঠায়:

```json
{
  "model": "your-model",
  "messages": [
    { "role": "system", "content": "আপনি BikriKoro-এর Bengali help assistant..." },
    { "role": "user", "content": "আমার order এখনো আসেনি, কী করব?" }
  ],
  "temperature": 0.2,
  "max_tokens": 600
}
```

যদি আপনার Agent Router-এর request body বা response shape আলাদা হয়, তাহলে `api/agent-router.ts`-এ শুধু upstream body mapping এবং response mapping পরিবর্তন করতে হবে। Browser-side code বা secret পরিবর্তন করার দরকার হবে না।

## কোথায় ব্যবহার হচ্ছে

Help Center এবং FAQ পেজে `AI Help Assistant` panel রাখা হয়েছে। Assistant Bengali marketplace প্রশ্নের সংক্ষিপ্ত উত্তর দেবে এবং OTP, password বা API key চাইতে নিষেধ করা হয়েছে। API configure না করা থাকলে Help Center বন্ধ হয়ে যাবে না; সাধারণ Bengali fallback content দেখাবে এবং AI panel একটি পরিষ্কার configuration error দেখাবে।

## নিরাপত্তা নিয়ম

Agent Router key কখনো `VITE_` prefix দিয়ে রাখবেন না, কারণ `VITE_` variable browser bundle-এ চলে যেতে পারে। GitHub-এ `.env` commit করবেন না। Prompt-এ user-এর OTP, password, full card information বা অপ্রয়োজনীয় personal data পাঠাবেন না। AI-এর উত্তরকে payment, legal বা account-security সিদ্ধান্তের একমাত্র source হিসেবে ব্যবহার করবেন না; sensitive issue হলে Order Detail, dispute এবং support workflow ব্যবহার করবেন।

## কীভাবে পরীক্ষা করবেন

Vercel redeploy-এর পর `/help` খুলে লিখুন: `order না পেলে কী করব?`। Browser Network tab-এ `/api/agent-router` request দেখতে পাবেন, কিন্তু upstream API key দেখতে পাবেন না। Configuration না থাকলে HTTP 503 আসবে—এটি expected এবং এর অর্থ হলো Vercel variables এখনো যোগ করা হয়নি।

## ভবিষ্যৎ সম্প্রসারণ

একই server-side boundary ব্যবহার করে AI search query normalization, Bengali synonym expansion, listing-quality suggestion, seller education recommendation এবং support-ticket classification যোগ করা যাবে। প্রতিটি নতুন capability-র আগে admin Feature Control Center-এ flag রাখা উচিত এবং usage limit, timeout ও fallback নির্ধারণ করা উচিত।
