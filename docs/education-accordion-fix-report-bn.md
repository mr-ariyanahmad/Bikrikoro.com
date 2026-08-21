# BikriKoro Education Accordion Fix Report

## সমস্যার কারণ

Screenshot-এ User Education Hub-এর ০৫, ০৬, ০৭ ও ০৮ নম্বর accordion-এর title দেখা যাচ্ছিল, কিন্তু ভেতরের অংশ খালি ছিল। Live Supabase-এ User Education এবং Seller Education-এর content প্রকাশিত ছিল; সমস্যা content না থাকার নয়, বরং frontend parser-এর আচরণে ছিল। পুরোনো parser পুরো paragraph block থেকে numbered heading আলাদা করার সময় heading-এর একই লাইনে থাকা বাকি content বাদ দিচ্ছিল। ফলে chapter title তৈরি হলেও paragraph array খালি থাকত।

## কী ঠিক করা হয়েছে

`src/components/EducationHub.tsx`-এর `parseSections` নতুনভাবে লেখা হয়েছে। এখন এটি line-by-line content পড়ে numbered heading আলাদা করে, heading-এর পরের text ধরে রাখে, blank line-এ paragraph flush করে এবং প্রতিটি chapter-এর content সঠিকভাবে accordion-এর ভেতরে render করে। Live content বা database structure পরিবর্তন করা হয়নি; বিদ্যমান published Bengali education content-ই সঠিকভাবে দেখানো হচ্ছে।

## Live content যাচাই

| Education Hub | Chapter | Blank chapter |
|---|---:|---:|
| User Education | ৮টি | ০টি |
| Seller Education | ১০টি | ০টি |

অর্থাৎ ১৮টি chapter-এর সবগুলোতেই content আছে। Delivery, dispute, review ও rating, wallet ও reward, নিরাপত্তা, account, product purchase এবং seller fulfillment-এর মতো section খুললে এখন সংশ্লিষ্ট লেখা দেখা যাবে।

## যাচাইয়ের ফল

`npm run build` সফল হয়েছে। `npm run lint`-এ ০ error এবং আগের `AuthContext` Fast Refresh warning রয়েছে। Education parser regression check-এ `USER_EDU: 8 chapters, 0 blank chapters` এবং `SELLER_EDU: 10 chapters, 0 blank chapters` পাওয়া গেছে। `git diff --check`-ও সফল হয়েছে।

## পরিবর্তিত ফাইল

`src/components/EducationHub.tsx` এবং এই রিপোর্ট ফাইল।

## References

[1]: https://github.com/mrariyanahmad-eng/Bikrikoro.com "BikriKoro.com GitHub repository"

[2]: https://bikrikoro.com/user-education "BikriKoro User Education Hub"
