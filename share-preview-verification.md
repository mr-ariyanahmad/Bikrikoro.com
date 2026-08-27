# Shared Link and Unread Control — Verification Record

## Shared shop route

After deployment, a direct request to `https://www.bikrikoro.com/seller/ariyan` returned the normal application document rather than the server-only preview document. Browser validation then completed the public shop load and rendered the **Amar nam Ariyan** shop profile with its product grid, share action, follow action, and chat action.

The earlier route conflict was removed: normal `/seller/:username` links now reach the React shop page, while `/api/seller-preview` is reserved for social crawlers and shared-message preview cards.

## Social preview checks

The deployed product preview endpoint now exposes one complete Open Graph image tag pointing to a same-origin image proxy, which returned `200 image/png` for the checked public product. The deployed shop preview endpoint exposes one complete Open Graph image tag pointing to the shop image proxy, which returned `200 image/jpeg` for the checked public shop profile. Both preview documents use the canonical `https://www.bikrikoro.com` destination URL and include Twitter large-image metadata.

## Labeled unread controls

The chat view selector now displays `অপঠিত (সংখ্যা)` using the current total unread message count and exposes an accessible selected state. The notification selector displays `অপঠিত (সংখ্যা)` in Bangla. Product price-alert actions now visibly show whether the alert is on as `দাম সতর্কতা: চালু`; the status continues to be toggled through the existing protected user-feature operation.
