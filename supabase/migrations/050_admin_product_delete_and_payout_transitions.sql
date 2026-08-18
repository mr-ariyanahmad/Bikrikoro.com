-- BikriKoro — hard-delete admin products and lock payout transitions.
-- Product snapshots in orders preserve history, so historical foreign keys can
-- detach safely when a product is removed from the catalogue.

alter table public.chat_threads
  drop constraint if exists chat_threads_product_id_fkey;
alter table public.chat_threads
  add constraint chat_threads_product_id_fkey
  foreign key (product_id) references public.products(id) on delete set null;

alter table public.orders
  alter column product_id drop not null;
alter table public.orders
  drop constraint if exists orders_product_id_fkey;
alter table public.orders
  add constraint orders_product_id_fkey
  foreign key (product_id) references public.products(id) on delete set null;

alter table public.digital_deliveries
  alter column product_id drop not null;
alter table public.digital_deliveries
  drop constraint if exists digital_deliveries_product_id_fkey;
alter table public.digital_deliveries
  add constraint digital_deliveries_product_id_fkey
  foreign key (product_id) references public.products(id) on delete set null;

create or replace function public.admin_delete_product(
  p_admin_id text,
  p_product_id uuid
) returns void as $$
declare
  v_title text;
begin
  perform public.admin_assert(p_admin_id);

  select title into v_title
  from public.products
  where id = p_product_id;
  if not found then
    raise exception 'Product not found';
  end if;

  delete from public.products
  where id = p_product_id;
  if not found then
    raise exception 'Product could not be deleted';
  end if;

  perform public.admin_log(
    p_admin_id,
    'DELETE_PRODUCT',
    'PRODUCT',
    p_product_id::text,
    jsonb_build_object('title', v_title)
  );
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

create or replace function public.admin_moderate_product(
  p_admin_id text,
  p_product_id uuid,
  p_action text
) returns void as $$
begin
  perform public.admin_assert(p_admin_id);
  if p_action = 'RESTORE' then
    update public.products
    set is_hidden = false, moderation_note = ''
    where id = p_product_id;
  elsif p_action = 'HIDE' then
    update public.products
    set is_hidden = true, moderation_note = p_action
    where id = p_product_id;
  else
    raise exception 'Invalid product moderation action';
  end if;
  if not found then
    raise exception 'Product not found';
  end if;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

create or replace function public.admin_review_withdrawal(
  p_admin_id text,
  p_request_id uuid,
  p_status text,
  p_admin_note text
) returns void as $$
declare
  v_current text;
  v_balance numeric;
  v_reserved numeric;
begin
  perform public.admin_assert(p_admin_id);
  if p_status not in ('APPROVED', 'REJECTED', 'PAID') then
    raise exception 'Invalid withdrawal status';
  end if;

  select status into v_current
  from public.wallet_withdrawal_requests
  where id = p_request_id
  for update;
  if v_current is null then
    raise exception 'Withdrawal request not found';
  end if;
  if v_current = 'PAID' then
    raise exception 'Withdrawal is already paid';
  end if;
  if v_current = 'REJECTED' then
    raise exception 'Rejected withdrawal cannot be changed';
  end if;
  if v_current = 'APPROVED' and p_status <> 'PAID' then
    raise exception 'Approved withdrawal can only be marked paid';
  end if;
  if v_current = 'PENDING' and p_status = 'PAID' then
    raise exception 'Withdrawal must be approved before it can be paid';
  end if;

  if p_status = 'APPROVED' then
    select b.available_balance
    into v_balance
    from public.wallet_balances b
    where b.user_id = (select wr.user_id from public.wallet_withdrawal_requests wr where wr.id = p_request_id)
    for update;

    select coalesce(sum(active.amount), 0)
    into v_reserved
    from public.wallet_withdrawal_requests active
    where active.user_id = (select wr.user_id from public.wallet_withdrawal_requests wr where wr.id = p_request_id)
      and active.status in ('PENDING', 'APPROVED');

    if v_balance is null or v_reserved > v_balance then
      raise exception 'Cannot approve payout: active payout reservations exceed available wallet balance';
    end if;
  end if;

  update public.wallet_withdrawal_requests
  set status = p_status,
      admin_note = coalesce(p_admin_note, ''),
      processed_at = case when p_status in ('APPROVED', 'REJECTED', 'PAID') then now() else processed_at end
  where id = p_request_id;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

revoke all on function public.admin_delete_product(text, uuid) from public;
grant execute on function public.admin_delete_product(text, uuid) to service_role;
revoke all on function public.admin_moderate_product(text, uuid, text) from public;
grant execute on function public.admin_moderate_product(text, uuid, text) to service_role;
revoke all on function public.admin_review_withdrawal(text, uuid, text, text) from public;
grant execute on function public.admin_review_withdrawal(text, uuid, text, text) to service_role;
