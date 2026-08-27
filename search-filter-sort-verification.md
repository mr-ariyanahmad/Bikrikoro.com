# Search Filter and Sort Verification

## 2026-08-27

The deployed search page loads with **জনপ্রিয় ও প্রাসঙ্গিক আগে** as the default ordering. The live desktop selector exposes relevance, newest, oldest, discount, ascending price, and descending price options. Existing search terms and query filters remain URL-backed.

On mobile, the same result page presents sticky quick-sort tabs for **সেরা মিল**, **নতুন**, and **কম দাম**, plus a dedicated **ফিল্টার** action. The filter action opens an apply-based sheet that supports sort selection, a minimum and maximum price, product condition, reset, and a clear submit action.

Live validation selected **দাম: কম থেকে বেশি** from the desktop control. The search URL updated to `sort=price_asc` and the visible selector retained the selected sorting state, confirming the ranking selection remains shareable and persistent across reloads.
