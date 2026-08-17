-- =====================================================================
-- BikriKoro — Product geo-location (for the map picker / product-detail pin)
-- =====================================================================
-- Nullable on purpose: listings created before this migration, or where
-- the seller skipped the map picker and only typed a text location,
-- simply have no pin — ProductDetailScreen hides the map card in that case
-- rather than guessing coordinates from the text.
-- =====================================================================

alter table products
    add column if not exists latitude double precision,
    add column if not exists longitude double precision;
