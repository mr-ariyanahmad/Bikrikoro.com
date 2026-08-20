# Z2U-style BikriKoro Digital Listing Plan

## উদ্দেশ্য

BikriKoro-এর seller form এখন শুধু title, description, price, category এবং একটি delivery text গ্রহণ করে। Z2U-এর public seller guidance পর্যালোচনা করে দেখা গেছে যে কার্যকর digital marketplace form-এর মূল কাঠামো হলো category-first listing, category-specific product specification, price ও delivery rules, stock/inventory management, automatic delivery, out-of-stock deactivation, delivery notes, delivery logs, এবং manual/risk review। BikriKoro-তে এগুলো Bengali UI, BDT currency, Firebase verification এবং existing Supabase escrow flow-এর সঙ্গে যুক্ত করা হবে।

## Z2U থেকে নেওয়া ধারণা এবং BikriKoro-তে রূপান্তর

| Z2U-style ধারণা | BikriKoro implementation |
|---|---|
| Game/product/category আগে নির্বাচন | `digital_category_templates` থেকে database-backed category ও template fields |
| Category-specific product specification | `product_digital_specs.specifications` JSONB; buyer-facing public read only for approved visible digital products |
| Game account, currency, top-up, item, service, gift card, subscription ইত্যাদি | Bengali digital category seeds; admin পরে নাম, order, active state ও fields পরিবর্তন করতে পারবেন |
| Storage category ও child category | Template fields ও category metadata; ভবিষ্যতে child taxonomy-এর জন্য `parent_category_id` extension রাখা যাবে |
| Auto-delivery enable/disable | `auto_delivery_enabled` |
| Out-of-stock হলে delist | `deactivate_when_out_of_stock` |
| Stock type | `UNLIMITED`, `QUANTITY`, `KEY_POOL` |
| License/key inventory | Existing `digital_license_inventory`; প্রতি order-এ একটি AVAILABLE key atomic claim হবে |
| Instructions/download link delivery | Existing `digital_product_contents` এবং `ensure_digital_delivery()` বজায় থাকবে |
| Auto-delivery note/tutorial | `delivery_note` ও existing delivery text; secret key কখনো public UI/table read-এ যাবে না |
| Product review/manual risk control | Existing product approval ও seller verification; category-specific risk metadata নতুন specs-এ audit করা হবে |
| Seller edit/manage listing | Existing protected `/api/seller-product` ও `/api/seller-digital-content` gateway; direct public RPC নয় |

## Initial category templates

প্রাথমিকভাবে game account, game currency/gold, game items/skins, game top-up/voucher, gift card, software/license, streaming subscription, social-media digital account, e-learning/course, design asset/template, e-book/digital file, এবং game service/boosting category দেওয়া হবে। এগুলো seed data হিসেবে থাকবে; admin panel থেকে Bengali নাম, English নাম, icon key, order, active state ও specification fields পরিবর্তন করা যাবে।

## Security boundary

Seller-এর Firebase UID client body থেকে নেওয়া হবে না; existing protected gateway verified token থেকে UID নেবে। Product create/update, structured specification save, stock option save এবং license-key inventory add server-side service-role client দিয়ে চলবে। Public buyer view কেবল approved, visible, digital product-এর non-secret specifications পড়তে পারবে। `digital_product_contents`, `digital_deliveries` এবং `digital_license_inventory` secret-bearing data হিসেবে server-only থাকবে।

## Compatibility boundary

Physical historical products মুছে ফেলা হবে না। Existing order, payment, wallet, escrow, dispute এবং Firebase authentication contract অপরিবর্তিত থাকবে। New fields optional/defaulted থাকবে, যাতে পুরনো digital product এবং পুরনো order history পড়তে বা manage করতে সমস্যা না হয়।
