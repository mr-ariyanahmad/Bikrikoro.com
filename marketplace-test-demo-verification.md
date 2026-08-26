# Marketplace Test / Demo Listing Verification

## 2026-08-26

The representative public listing **TEST / Demo only — Creative Tool Showcase** loaded successfully after its data request completed. Its original cover, ৳1 test price, explicit TEST / Demo-only title and description, and manual-delivery badge rendered on the product page.

The first unauthenticated check still displayed the normal login-to-order link. The demo records were configured with `stock_mode = QUANTITY`, `stock_quantity = 0`, `deactivate_when_out_of_stock = true`, and `auto_delivery_enabled = false`; a product-detail checkout guard was therefore added before the test data was treated as ready.

After deployment, the same public page visibly showed the amber **“TEST / Demo only — বিক্রির জন্য নয়”** notice and replaced the normal order action with **“TEST / Demo only — অর্ডার বন্ধ”**. The demo description, original cover, and manual-delivery badge also rendered correctly. Production verification confirmed all 34 categories now have at least one visible product and all 27 demo listings meet the zero-stock, manual-delivery, test-labelled requirements.
