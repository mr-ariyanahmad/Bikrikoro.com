# Personalized Recommendations Verification

## 2026-08-26

The deployed homepage presents the new **“আপনার জন্য”** recommendation section and remains usable before any local preference exists. In this cold-start state, the component falls back to public popularity and recency rather than requiring account data or personal information.

The implementation stores only category identifiers, a locally computed score, and an update timestamp in the current browser’s local storage. It does not store account identifiers, product titles, search text, payment data, messages, delivery data, or credentials. It is not synchronized across browsers or devices.

| Interaction | Local score | Purpose |
|---|---:|---|
| Product detail view | 1 | Signals light category interest. |
| Product-card open or category-pill selection | 2 | Signals deliberate exploration. |
| Favorite | 5 | Signals stronger preference. |

Scores decay with a **21-day half-life**, are capped at 40 per category, and retain only the top 12 categories. A visitor with no local preference receives public popularity and recency fallback results. The Home page displays **“আপনার জন্য”**; product detail displays **“আপনার জন্য আরও পণ্য.”**

The deployed product-detail view for the selected Furniture test fixture completed its click-and-view navigation. Its **`TEST / Demo only — অর্ডার বন্ধ`** state remained visible, with the normal order action absent, preserving the existing UI protection for test records.

Browser inspection confirmed that the interaction record used only the category ID and a local decayed score. The recorded click plus view produced an approximately 3-point local category score. The implementation subsequently excludes records whose titles begin **`TEST / Demo only —`** from both interest tracking and personalized result rows so temporary UI fixtures cannot distort a real visitor’s recommendation profile.
