-- Payment expiry reconciliation hardening.
-- A delayed provider webhook must not lose a completed payment.

-- First recover any order for which the provider payment was already recorded
-- as COMPLETED but the order had not transitioned yet.
update public.orders o
set status = 'ESCROW_HELD',
    payment_method = coalesce(o.payment_method, p.payment_method),
    updated_at = now()
from public.payments p
where p.order_id = o.id
  and p.status = 'COMPLETED'
  and o.status = 'PENDING_PAYMENT';

create or replace function public.expire_pending_payment_orders(p_limit integer default 500)
returns integer as $$
declare
  v_count integer;
begin
  with expired as (
    select o.id
    from public.orders o
    where o.status = 'PENDING_PAYMENT'
      and o.payment_expires_at is not null
      and o.payment_expires_at <= now()
      and not exists (
        select 1 from public.payments p
        where p.order_id = o.id and p.status = 'COMPLETED'
      )
    order by o.payment_expires_at asc
    limit greatest(1, least(coalesce(p_limit, 500), 2000))
    for update skip locked
  )
  update public.orders o
  set status = 'CANCELLED', updated_at = now()
  from expired e
  where o.id = e.id;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

revoke all on function public.expire_pending_payment_orders(integer) from public;
grant execute on function public.expire_pending_payment_orders(integer) to service_role;
