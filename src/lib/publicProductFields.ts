// Public product columns only. Internal moderation, reviewer, archive and raw
// coordinate fields are intentionally excluded from browser-facing queries.
// The generated client schema knows the products row shape but not this new view.
// The runtime value remains `public_products`; the type alias preserves the
// existing Product row typing without exposing base-table access.
export const PUBLIC_PRODUCT_TABLE = 'public_products' as 'products'

export const PUBLIC_PRODUCT_FIELDS = 'id, title, description, price, original_price, images, video_url, category_id, condition, location, is_digital, seller_id, view_count, completed_order_count, popularity_score, is_escrow_protected, supports_cod, free_delivery, fast_delivery, free_return, auto_delivery_enabled, created_at' as const
