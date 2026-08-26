# Marketplace Test / Demo Listing Verification

## 2026-08-26

The representative public listing **TEST / Demo only — Creative Tool Showcase** loaded successfully after its data request completed. Its original cover, ৳1 test price, explicit TEST / Demo-only title and description, and manual-delivery badge rendered on the product page.

The unauthenticated product page still displays the normal login-to-order link. The demo records were configured with `stock_mode = QUANTITY`, `stock_quantity = 0`, `deactivate_when_out_of_stock = true`, and `auto_delivery_enabled = false`; the next verification step must confirm that the application prevents an authenticated checkout for this zero-stock test data.
