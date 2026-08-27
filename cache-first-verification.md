# Cache-First Performance Update — Verification Record

## Live public catalog check

After deployment, the public `/products` route returned a populated catalog of 39 digital products. The page completed its initial server fetch and rendered the normal catalog controls and product grid successfully.

The deployed page wrote a `bikrikoro:cache:v1:public:products:` browser-cache entry containing the public catalog response. A subsequent navigation to the same route rendered the normal full catalog interface and product grid, confirming the persisted route-keyed cache is available to the repeat-visit code path.

## Cache behavior under test

The update stores cacheable public data by route/query and stores authenticated data only under a user-specific key. The client always requests current data in the background after rendering cache, while authentication logout clears the signed-in user’s cached records.

| Data group | Cache boundary | Maximum retained age | Current-data path |
|---|---|---:|---|
| Public Home, catalog, search, product and shop data | Shared browser cache | 5–30 minutes | Public database read in background |
| Chat list and messages | Signed-in user cache | 24 hours | Protected chat gateway plus message polling |
| Orders, library, wallet, notifications, favorites and profile | Signed-in user cache | 6–24 hours | Protected request and existing realtime refresh where available |

> A first-ever visit still requires the initial network response because no prior local data exists. On every repeat visit, prior retained data is rendered first and new data follows silently. Payment, delivery, unread counts, message state, and wallet balance continue to revalidate in the background rather than being treated as permanently cached.
