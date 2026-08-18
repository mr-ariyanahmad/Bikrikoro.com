# BikriKoro-তে Agent Router AI API সেটআপ

এই guide অনুযায়ী BikriKoro-এর Help Center-এর Bengali AI Assistant চালু করা যাবে। বর্তমান implementation-এ browser সরাসরি Agent Router API-তে যায় না। Browser শুধু `/api/agent-router`-এ প্রশ্ন পাঠায়; Vercel server function secret ব্যবহার করে আপনার Agent Router provider-এ request পাঠায়। ফলে API key browser bundle, localStorage বা GitHub source code-এ যায় না।

> গুরুত্বপূর্ণ: Agent Router provider-এর API অবশ্যই OpenAI-compatible chat completion contract সমর্থন করলে বর্তমান code সরাসরি কাজ করবে। Provider-এর request বা response format আলাদা হলে `api/agent-router.ts`-এর mapping সামান্য পরিবর্তন করতে হবে।

## কী কী তথ্য আগে সংগ্রহ করবেন

আপনার Agent Router provider বা dashboard থেকে চারটি তথ্য নিন:

| তথ্য | উদাহরণ | কোথায় ব্যবহার হবে |
|---|---|---|
| Base URL | `https://agentrouter.org` | Agent Router server host; keep `/v1` out of this value because the path is configured separately |
| API key | `sk-...` বা provider-এর secret | শুধু Vercel server-side |
| Model name | `router-default` বা `gpt-4o-mini` | AI উত্তর তৈরির model |
| Chat endpoint path | `/v1/chat/completions` | Base URL-এর পরে যুক্ত হবে |

Base URL-এর শেষে `/` থাকলে proxy নিজে সেটি সরিয়ে দেয়। Chat path না দিলে default `/v1/chat/completions` ব্যবহার করা হয়।

## Vercel-এ variables যোগ করার ধাপ

Vercel dashboard-এ BikriKoro project খুলে **Settings → Environment Variables → Add New** নির্বাচন করুন। প্রতিটি variable-এর জন্য Production, Preview এবং Development environment প্রয়োজন অনুযায়ী select করুন।

```text
AGENT_ROUTER_BASE_URL=https://agentrouter.org
AGENT_ROUTER_API_KEY=আপনার-তৈরি-করা-token
AGENT_ROUTER_MODEL=Agent Router model catalog থেকে exact model ID
AGENT_ROUTER_CHAT_PATH=/v1/chat/completions
```

`AGENT_ROUTER_API_KEY` কখনো `VITE_AGENT_ROUTER_API_KEY` নামে রাখবেন না। `VITE_` prefix হলে সেটি browser JavaScript bundle-এ চলে যেতে পারে। API key chat message, screenshot, GitHub commit বা public `.env` file-এও দেবেন না।

## Provider-এর request contract

বর্তমান proxy provider-এ এই ধরনের request পাঠায়:

```json
{
  "model": "আপনার-default-model",
  "messages": [
    {
      "role": "system",
      "content": "আপনি BikriKoro-এর Bengali help assistant..."
    },
    {
      "role": "user",
      "content": "আমার order এখনো আসেনি, কী করব?"
    }
  ],
  "temperature": 0.2,
  "max_tokens": 600
}
```

Browser request-এ `messages` array থাকতে হবে এবং ১ থেকে ২০টি message-এর মধ্যে থাকতে হবে। `temperature` সর্বোচ্চ ১ এবং `max_tokens` সর্বোচ্চ ১২০০-তে সীমাবদ্ধ করা হয়েছে।

## Provider-এর response contract

বর্তমান client এই response shape পড়ে:

```json
{
  "choices": [
    {
      "message": {
        "content": "আপনার order detail page থেকে shipment status দেখুন..."
      }
    }
  ]
}
```

অর্থাৎ provider-এর final Bengali answer `choices[0].message.content`-এর মধ্যে থাকতে হবে। Provider যদি `{ answer: "..." }`, `{ output: "..." }` বা অন্য format দেয়, তাহলে response mapping পরিবর্তন করতে হবে।

## Deploy ও test করার ধাপ

প্রথমে Vercel variables save করুন এবং **Redeploy** দিন। GitHub-এর `main` branch থেকে auto-deploy হলে নতুন deployment সম্পূর্ণ হওয়া পর্যন্ত অপেক্ষা করুন। এরপর website-এর `/help` পেজ খুলে AI Help Assistant-এ Bengali প্রশ্ন লিখুন, যেমন:

```text
order না পেলে কী করব?
```

সফল হলে browser Network tab-এ `/api/agent-router` request দেখা যাবে এবং response-এ Bengali answer আসবে। Browser Network tab-এ upstream API key দেখা যাবে না—এটাই সঠিক নিরাপত্তা আচরণ।

Configuration না থাকলে `/api/agent-router` HTTP `503` দিতে পারে। এর অর্থ provider-এর Base URL বা API key Vercel-এ নেই; এটি frontend code ভেঙে যাওয়ার অর্থ নয়।

## Provider OpenAI-compatible না হলে

Agent Router-এর জন্য এই exact combination ব্যবহার করুন: `AGENT_ROUTER_BASE_URL=https://agentrouter.org` এবং `AGENT_ROUTER_CHAT_PATH=/v1/chat/completions`। Base URL-এ `/v1` লিখে আবার path-এ `/v1/chat/completions` দিলে URL দ্বিগুণ হয়ে যাবে এবং request ব্যর্থ হবে।

যদি provider OpenAI-compatible না হয়, তাহলে সাধারণত দুইটি mapping বদলাতে হবে:

প্রথমত, `api/agent-router.ts`-এ upstream request body provider-এর format অনুযায়ী পাঠাতে হবে। দ্বিতীয়ত, provider-এর response থেকে answer বের করে client-এর প্রত্যাশিত `{ choices: [{ message: { content } }] }` shape-এ ফেরত দিতে হবে, অথবা `src/lib/agentRouter.ts`-এর response parser পরিবর্তন করতে হবে। API key browser-side code-এ নেওয়া যাবে না।

## নিরাপত্তা ও ব্যবহারনীতি

AI assistant-কে OTP, password, full card information, Firebase token, API key বা অপ্রয়োজনীয় personal data পাঠানো যাবে না। AI-এর উত্তর payment, legal বা account-security সিদ্ধান্তের একমাত্র source নয়; sensitive issue হলে Order Detail, dispute এবং support workflow ব্যবহার করতে হবে। Admin Feature Control Center-এ `ai-help-assistant` feature flag রাখা আছে; provider চালু করার আগে feature flag, usage limit, timeout এবং fallback পরীক্ষা করুন।

## দ্রুত checklist

```text
[ ] AGENT_ROUTER_BASE_URL যোগ করা হয়েছে
[ ] AGENT_ROUTER_API_KEY server-side যোগ করা হয়েছে
[ ] AGENT_ROUTER_MODEL সঠিক model name দিয়ে বসানো হয়েছে
[ ] AGENT_ROUTER_CHAT_PATH provider endpoint অনুযায়ী বসানো হয়েছে
[ ] Vercel Redeploy করা হয়েছে
[ ] /help পেজে Bengali প্রশ্ন দিয়ে test করা হয়েছে
[ ] Browser bundle বা Network response-এ API key দেখা যাচ্ছে না
[ ] Provider response-এ choices[0].message.content আছে
```
