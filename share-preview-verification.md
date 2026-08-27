# Shared Link and Unread Control — Verification Record

## Shared shop route

After deployment, a direct request to `https://www.bikrikoro.com/seller/ariyan` returned the normal application document rather than the server-only preview document. Browser validation then completed the public shop load and rendered the **Amar nam Ariyan** shop profile with its product grid, share action, follow action, and chat action.

The earlier route conflict was removed: normal `/seller/:username` links now reach the React shop page, while `/api/seller-preview` is reserved for social crawlers and shared-message preview cards.
