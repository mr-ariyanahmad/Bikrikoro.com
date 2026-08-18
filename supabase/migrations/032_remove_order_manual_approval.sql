-- BikriKoro — remove order-level manual approval
-- Product approval remains active. Orders return to the original automatic flow.

-- Remove the order-review trigger, functions, index, history table, and status
-- metadata introduced by migration 031.
drop trigger if exists trg_notify_order_admin_review on public.orders;
drop function if exists public.notify_order_admin_review();
drop function if exists public.admin_list_order_approval_history(text, uuid);
drop function if exists public.admin_review_order(text, uuid, text, text);
drop table if exists public.order_admin_approval_history;
drop index if exists public.idx_orders_admin_review_status;

alter table public.orders drop column if exists admin_review_status;
alter table public.orders drop column if exists admin_reviewed_by;
alter table public.orders drop column if exists admin_reviewed_email;
alter table public.orders drop column if exists admin_reviewed_at;
alter table public.orders drop column if exists admin_review_note;

-- Migration 031 added this unused alias while tightening the buyer lifecycle.
-- The original application function is confirm_order_delivery(), which remains
-- unchanged from migration 009.
drop function if exists public.buyer_confirm_delivery(uuid, text);

-- Restore the original seller fulfillment condition: escrow-held orders can be
-- shipped by the seller without a separate admin order decision.
create or replace function public.seller_mark_shipped(p_order_id uuid, p_seller_id text) returns void as $$
begin
  update public.orders
  set status = 'SHIPPED', updated_at = now()
  where id = p_order_id
    and seller_id = p_seller_id
    and status = 'ESCROW_HELD';
  if not found then raise exception 'Order not found, not yours, or not in a shippable state'; end if;
end;
$$ language plpgsql security definer set search_path = public;
