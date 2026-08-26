# Marketplace Relevance Ranking Verification

## 2026-08-26

The production marketplace default sort is now **“জনপ্রিয় ও প্রাসঙ্গিক আগে.”** A live `/products` check showed the catalog item with the highest aggregate completed-purchase and view signal in the first position, ahead of newer zero-engagement test fixtures.

The production ranking fields expose only aggregate `view_count`, completed-order count, and a bounded public relevance score. No buyer details, order histories, payment details, messages, or view-token values are exposed to public product queries.

The live product-search page now defaults to the same **“জনপ্রিয় ও প্রাসঙ্গিক আগে”** order. The shared search suggestion query and full marketplace search query both use aggregate relevance before recency, with a title-trigram index supporting scale beyond the current catalog.

A real public product was opened through the live search result page to exercise the deployed view-count path. The event is designed to count at most once per product, per browser-generated random token, per Bangladesh calendar day; the token is hashed before database storage and never appears in public product data.

The production aggregate check confirmed the opened product received `view_count: 1`, `completed_order_count: 0`, and `popularity_score: 1`. This validates that a legitimate public detail view updates ranking without exposing any visitor data.
