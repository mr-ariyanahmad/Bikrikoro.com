-- =====================================================================
-- BikriKoro — digital products (no shipping address, no location)
-- =====================================================================
-- The seller marks a listing as digital at post time. Digital listings
-- skip the "location" requirement in Sell.tsx and skip the delivery
-- address step in BuyModal — checkout for them is payment-only via
-- UddoktaPay (bKash/Nagad/Rocket), same as every order already is; this
-- project has never supported Cash on Delivery, so no COD flag is needed
-- here — just making the address step itself optional for digital goods.
-- =====================================================================

alter table products add column if not exists is_digital boolean not null default false;

-- location was `not null default ''` for physical goods; digital listings
-- can leave it empty, so drop the not-null constraint and keep the
-- default. Application code still requires a location for physical
-- listings (see src/pages/Sell.tsx), this is just the DB-level relaxation
-- to match.
alter table products alter column location drop not null;
