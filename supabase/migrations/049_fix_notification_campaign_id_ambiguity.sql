-- BikriKoro — fix PostgreSQL 42702 in admin campaign creation.
-- The function's output column `campaign_id` conflicted with the
-- notification_deliveries column in the aggregate query. Qualify the table
-- column so the RPC remains safe to replace after migration 048.

create or replace function public.admin_create_notification_campaign(
  p_admin_id text,
  p_target_type text,
  p_target_user_ids text[],
  p_title text,
  p_body text,
  p_link text default null,
  p_send_push boolean default false
) returns table(campaign_id uuid, recipient_count integer) as $$
declare
  v_campaign_id uuid;
  v_recipient_count integer;
begin
  perform public.admin_assert_permission(p_admin_id, 'content.notifications');
  if p_target_type not in ('ALL', 'CUSTOMERS', 'SELLERS', 'USER_LIST') then
    raise exception 'Invalid notification target';
  end if;
  if length(trim(coalesce(p_title, ''))) < 2 or length(trim(coalesce(p_body, ''))) < 2 then
    raise exception 'Notification title and body are required';
  end if;

  insert into public.notification_campaigns(created_by, target_type, target_user_ids, title, body, link, send_push, status)
  values (
    p_admin_id,
    p_target_type,
    coalesce(p_target_user_ids, '{}'),
    trim(p_title),
    trim(p_body),
    nullif(trim(coalesce(p_link, '')), ''),
    p_send_push,
    case when p_send_push then 'PUSH_QUEUED' else 'IN_APP_SENT' end
  )
  returning id into v_campaign_id;

  with recipients as (
    select p.id as user_id
    from public.profiles p
    where p.is_blocked = false and p_target_type = 'ALL'
    union
    select p.id
    from public.profiles p
    where p.is_blocked = false
      and p_target_type = 'CUSTOMERS'
      and not exists (select 1 from public.products pr where pr.seller_id = p.id)
      and not exists (select 1 from public.seller_registrations sr where sr.user_id = p.id and sr.status = 'APPROVED')
    union
    select p.id
    from public.profiles p
    where p.is_blocked = false
      and p_target_type = 'SELLERS'
      and (
        exists (select 1 from public.products pr where pr.seller_id = p.id)
        or exists (select 1 from public.seller_registrations sr where sr.user_id = p.id and sr.status = 'APPROVED')
      )
    union
    select p.id
    from public.profiles p
    where p.is_blocked = false and p_target_type = 'USER_LIST' and p.id = any(coalesce(p_target_user_ids, '{}'))
  ), inserted as (
    insert into public.notifications(user_id, type, title, body, link, campaign_id, metadata)
    select user_id, 'CAMPAIGN', trim(p_title), trim(p_body), nullif(trim(coalesce(p_link, '')), ''), v_campaign_id, jsonb_build_object('target_type', p_target_type)
    from recipients
    returning user_id
  )
  insert into public.notification_deliveries(campaign_id, user_id, channel, status, delivered_at)
  select v_campaign_id, user_id, 'IN_APP', 'DELIVERED', now()
  from inserted;

  select count(*)
  into v_recipient_count
  from public.notification_deliveries as nd
  where nd.campaign_id = v_campaign_id
    and nd.channel = 'IN_APP';

  update public.notification_campaigns as nc
  set recipient_count = v_recipient_count,
      updated_at = now()
  where nc.id = v_campaign_id;

  perform public.admin_log(
    p_admin_id,
    'CREATE_NOTIFICATION_CAMPAIGN',
    'NOTIFICATION_CAMPAIGN',
    v_campaign_id::text,
    jsonb_build_object('target_type', p_target_type, 'recipient_count', v_recipient_count, 'send_push', p_send_push)
  );

  return query select v_campaign_id, v_recipient_count;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;
