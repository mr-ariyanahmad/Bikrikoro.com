# Search Ranking and Mobile Search Verification

## 2026-08-27

The deployed `/products?q=YouTube` page defaults to **“জনপ্রিয় ও প্রাসঙ্গিক আগে”** and presents the updated compact search control, filter action, and query-specific result count. Matching results are ordered locally by the viewer’s recent real product opens and category interest before aggregate public popularity; non-personalized visitors receive popularity and recency ordering.

The live shared header search returned matching suggestions in the same local-interest and public-popularity order. The standard desktop treatment remains a concise grouped list; the compact mobile treatment uses the new two-column image-card grid, with recent search chips, trending terms, and category browsing retained beneath the search field.

Browser inspection confirmed that the recently opened matching product was the first shared-search suggestion and that two matching suggestions were available in the live overlay. Build and lint passed with only the pre-existing Fast Refresh advisory.
