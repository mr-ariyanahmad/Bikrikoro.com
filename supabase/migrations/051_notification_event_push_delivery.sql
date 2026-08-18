-- BikriKoro — automatic targeted push delivery for notification events
--
-- The Supabase Database Webhook on public.notifications calls
-- /api/notification-events after each INSERT. This migration adds the
-- notification linkage and an idempotent queue RPC used by that endpoint.

alter table public.notification_deliveries
  add column if not exists notification_id uuid references public.notifications(id) on delete cascade;

create index if not exists idx_notification_deliveries_notification
  on public.notification_deliveries(notification_id, channel, status);

create unique index if not exists idx_notification_push_delivery_unique
  on public.notification_deliveries(notification_id, token)
  where channel = 'PUSH' and notification_id is not null and token is not null;

create or replace function public.queue_notification_push_deliveries(p_notification_id uuid)
returns table(delivery_id uuid, user_id text, token text) as $$
begin
  if not exists (select 1 from public.notifications where id = p_notification_id) then
    return;
  end if;

  insert into public.notification_deliveries as d(notification_id, user_id, channel, token, status)
  select n.id, n.user_id, 'PUSH', t.token, 'QUEUED'
  from public.notifications n
  join public.notification_push_tokens t
    on t.user_id = n.user_id and t.enabled = true
  where n.id = p_notification_id
    and n.campaign_id is null
  on conflict (notification_id, token) where channel = 'PUSH' do update
    set status = case
          when d.status = 'DELIVERED' then d.status
          else 'QUEUED'
        end,
        error_message = case
          when d.status = 'DELIVERED' then d.error_message
          else null
        end;

  return query
  select d.id, d.user_id, d.token
  from public.notification_deliveries d
  where d.notification_id = p_notification_id
    and d.channel = 'PUSH'
    and d.status = 'QUEUED'
  order by d.created_at asc;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

revoke all on function public.queue_notification_push_deliveries(uuid) from public;
revoke all on function public.queue_notification_push_deliveries(uuid) from anon;
revoke all on function public.queue_notification_push_deliveries(uuid) from authenticated;
grant execute on function public.queue_notification_push_deliveries(uuid) to service_role;
