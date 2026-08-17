-- Admin customer workspace and banner deletion controls.
alter table public.profiles add column if not exists is_blocked boolean not null default false;
alter table public.profiles add column if not exists admin_note text not null default '';
create index if not exists idx_profiles_blocked_created on public.profiles(is_blocked, created_at desc);

create or replace function public.admin_delete_banner(p_admin_id text, p_banner_id text) returns void as $$
declare
  v_image_url text;
begin
  perform admin_assert_permission(p_admin_id, 'content.gallery');
  select image_url into v_image_url from public.promo_banners where id = p_banner_id;
  if not found then raise exception 'Banner not found'; end if;
  delete from public.promo_banners where id = p_banner_id;
  perform admin_log(p_admin_id, 'DELETE_BANNER', 'PROMO_BANNER', p_banner_id, jsonb_build_object('image_url', v_image_url));
end;
$$ language plpgsql security definer;

create or replace function public.admin_get_customer_overview(p_admin_id text, p_customer_id text) returns jsonb as $$
declare
  v_profile jsonb;
  v_wallet jsonb;
  v_orders jsonb;
  v_ledger jsonb;
  v_products jsonb;
  v_disputes jsonb;
  v_chats jsonb;
  v_notifications jsonb;
begin
  perform admin_assert_permission(p_admin_id, 'sales.customers');
  select to_jsonb(p) into v_profile from public.profiles p where p.id = p_customer_id;
  if v_profile is null then raise exception 'Customer not found'; end if;
  select coalesce(to_jsonb(w), '{}'::jsonb) into v_wallet from public.wallet_balances w where w.user_id = p_customer_id;
  select coalesce(jsonb_agg(to_jsonb(o) order by o.created_at desc), '[]'::jsonb) into v_orders from public.orders o where o.buyer_id = p_customer_id or o.seller_id = p_customer_id;
  select coalesce(jsonb_agg(to_jsonb(l) order by l.created_at desc), '[]'::jsonb) into v_ledger from public.wallet_ledger l where l.user_id = p_customer_id;
  select coalesce(jsonb_agg(to_jsonb(pr) order by pr.created_at desc), '[]'::jsonb) into v_products from public.products pr where pr.seller_id = p_customer_id;
  select coalesce(jsonb_agg(to_jsonb(d) order by d.created_at desc), '[]'::jsonb) into v_disputes from public.order_disputes d join public.orders o on o.id = d.order_id where o.buyer_id = p_customer_id or o.seller_id = p_customer_id;
  select coalesce(jsonb_agg(to_jsonb(c) order by c.last_message_at desc), '[]'::jsonb) into v_chats from public.chat_threads c where c.buyer_id = p_customer_id or c.seller_id = p_customer_id;
  select coalesce(jsonb_agg(to_jsonb(n) order by n.created_at desc), '[]'::jsonb) into v_notifications from public.notifications n where n.user_id = p_customer_id;
  perform admin_log(p_admin_id, 'VIEW_CUSTOMER', 'PROFILE', p_customer_id);
  return jsonb_build_object('profile', v_profile, 'wallet', coalesce(v_wallet, '{}'::jsonb), 'orders', v_orders, 'ledger', v_ledger, 'products', v_products, 'disputes', v_disputes, 'chats', v_chats, 'notifications', v_notifications);
end;
$$ language plpgsql security definer;

create or replace function public.admin_adjust_customer_wallet(p_admin_id text, p_customer_id text, p_amount numeric, p_reason text) returns void as $$
declare
  v_balance numeric;
begin
  perform admin_assert_permission(p_admin_id, 'sales.finance');
  if not exists (select 1 from public.profiles where id = p_customer_id) then raise exception 'Customer not found'; end if;
  if coalesce(p_amount, 0) = 0 or length(trim(coalesce(p_reason, ''))) < 3 then raise exception 'Amount and reason are required'; end if;
  select coalesce(available_balance, 0) into v_balance from public.wallet_balances where user_id = p_customer_id for update;
  if coalesce(v_balance, 0) + p_amount < 0 then raise exception 'Adjustment would make wallet negative'; end if;
  insert into public.wallet_ledger(user_id, type, amount, description) values (p_customer_id, 'ADJUSTMENT', p_amount, 'Admin adjustment: ' || trim(p_reason));
  perform admin_log(p_admin_id, case when p_amount > 0 then 'CREDIT_CUSTOMER_WALLET' else 'DEBIT_CUSTOMER_WALLET' end, 'PROFILE', p_customer_id, jsonb_build_object('amount', p_amount, 'reason', trim(p_reason)));
end;
$$ language plpgsql security definer;

create or replace function public.admin_set_customer_blocked(p_admin_id text, p_customer_id text, p_blocked boolean, p_reason text default '') returns void as $$
begin
  perform admin_assert_permission(p_admin_id, 'sales.customers');
  update public.profiles set is_blocked = p_blocked, admin_note = coalesce(nullif(trim(p_reason), ''), admin_note) where id = p_customer_id;
  if not found then raise exception 'Customer not found'; end if;
  perform admin_log(p_admin_id, case when p_blocked then 'BLOCK_CUSTOMER' else 'UNBLOCK_CUSTOMER' end, 'PROFILE', p_customer_id, jsonb_build_object('reason', coalesce(p_reason, '')));
end;
$$ language plpgsql security definer;

create or replace function public.admin_set_customer_note(p_admin_id text, p_customer_id text, p_note text) returns void as $$
begin
  perform admin_assert_permission(p_admin_id, 'sales.customers');
  update public.profiles set admin_note = coalesce(p_note, '') where id = p_customer_id;
  if not found then raise exception 'Customer not found'; end if;
  perform admin_log(p_admin_id, 'UPDATE_CUSTOMER_NOTE', 'PROFILE', p_customer_id, jsonb_build_object('has_note', length(trim(coalesce(p_note, ''))) > 0));
end;
$$ language plpgsql security definer;

-- Replace the legacy notification mutation with a permission-scoped, audited version.
create or replace function public.admin_send_notification(p_admin_id text, p_user_id text, p_title text, p_body text, p_link text default null) returns uuid as $$
declare v_id uuid;
begin
  perform admin_assert_permission(p_admin_id, 'content.notifications');
  insert into public.notifications(user_id, title, body, link)
  values (p_user_id, trim(p_title), trim(p_body), p_link)
  returning id into v_id;
  perform admin_log(p_admin_id, 'SEND_CUSTOMER_NOTIFICATION', 'PROFILE', p_user_id, jsonb_build_object('notification_id', v_id, 'title', trim(p_title)));
  return v_id;
end;
$$ language plpgsql security definer;

revoke all on function public.admin_send_notification(text, text, text, text, text) from public;
revoke all on function public.admin_adjust_customer_wallet(text, text, numeric, text) from public;
grant execute on function public.admin_send_notification(text, text, text, text, text) to anon, authenticated;
grant execute on function public.admin_adjust_customer_wallet(text, text, numeric, text) to anon, authenticated;
