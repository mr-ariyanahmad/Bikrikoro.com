# Home Feed Simplification and Ranking — Verification Record

## Result

The marked mobile-only Home promotions have been removed. The compact account summary and category navigation remain, followed directly by the product feed. Desktop promotional layout remains unchanged, consistent with the earlier desktop-preservation requirement.

## Global ranking behavior

The Home feed now uses the production public ordering directly: `popularity_score`, then `view_count`, then creation time and a stable identifier for exact ties. It no longer applies the device-local category and recent-view sort ahead of the global order.

| Signal | Verified automatic behavior |
|---|---|
| New public product view | One unique browser view per product per day is recorded; the product view count and popularity score update automatically. The next Home load bypasses its stored feed cache. |
| Completed order | The order trigger recalculates completed-order count and popularity score automatically. Completed orders carry more ranking weight than views. |
| Ordinary refresh without new public activity | The stable order remains unchanged. Refresh is not treated as a new engagement signal and does not artificially shuffle listings. |
| Cache freshness | A new tracked view clears the versioned Home cache. On every Home entry, the current global order is revalidated in the background. |

## Deployment checks

The production Home page loaded successfully after deployment, and the marked mobile deal and hero modules are absent from the mobile render path. Build and lint passed with only the existing non-blocking Fast Refresh warning in `AuthContext.tsx`. A narrow production aggregate confirms 39 approved public products; 2 currently have non-zero popularity signals, with a highest score of 137 from 37 views and 1 completed order.
