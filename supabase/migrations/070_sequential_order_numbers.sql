-- BikriKoro: human-readable, stable order numbers.
-- Internal UUIDs remain the primary key and continue to power routes/actions.

create sequence if not exists public.orders_order_number_seq start with 192728;

alter table public.orders
  add column if not exists order_number bigint;

do $$
begin
  update public.orders
  set order_number = nextval('public.orders_order_number_seq')
  where order_number is null;
end;
$$;

alter table public.orders
  alter column order_number set default nextval('public.orders_order_number_seq');

alter sequence public.orders_order_number_seq owned by public.orders.order_number;

alter table public.orders
  alter column order_number set not null;

create unique index if not exists orders_order_number_key
  on public.orders(order_number);
