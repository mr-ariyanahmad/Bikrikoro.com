-- BikriKoro — SQL-triggered notification push callback
--
-- Use this when the Supabase Dashboard does not expose Database Webhooks.
-- It requires the pg_net extension, which is available from Database > Extensions.

create extension if not exists pg_net;

create table if not exists public.notification_webhook_config (
  id boolean primary key default true check (id = true),
  endpoint_url text not null default 'https://bikrikoro.com/api/notification-events',
  secret text not null,
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.notification_webhook_config enable row level security;
revoke all on table public.notification_webhook_config from public;
revoke all on table public.notification_webhook_config from anon;
revoke all on table public.notification_webhook_config from authenticated;
grant select on table public.notification_webhook_config to service_role;

create or replace function public.enqueue_notification_push_webhook()
returns trigger as $$
declare
  v_endpoint_url text;
  v_secret text;
begin
  -- Admin campaigns already have a dedicated sender and must not be duplicated.
  if new.campaign_id is not null then
    return new;
  end if;

  select c.endpoint_url, c.secret
  into v_endpoint_url, v_secret
  from public.notification_webhook_config c
  where c.id = true and c.enabled = true;

  if nullif(trim(coalesce(v_endpoint_url, '')), '') is null
     or nullif(trim(coalesce(v_secret, '')), '') is null then
    raise log 'BikriKoro notification push callback is not configured';
    return new;
  end if;

  perform net.http_post(
    url := v_endpoint_url,
    body := jsonb_build_object(
      'type', 'INSERT',
      'table', 'notifications',
      'schema', 'public',
      'record', to_jsonb(new),
      'old_record', null
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-bikrikoro-webhook-secret', v_secret
    ),
    timeout_milliseconds := 2000
  );

  return new;
exception when others then
  -- Push delivery must never roll back the in-app notification transaction.
  raise log 'BikriKoro notification push callback could not be queued: %', SQLERRM;
  return new;
end;
$$ language plpgsql security definer set search_path = public, net, pg_temp;

drop trigger if exists trg_enqueue_notification_push_webhook on public.notifications;
create trigger trg_enqueue_notification_push_webhook
after insert on public.notifications
for each row execute function public.enqueue_notification_push_webhook();

revoke all on function public.enqueue_notification_push_webhook() from public;
revoke all on function public.enqueue_notification_push_webhook() from anon;
revoke all on function public.enqueue_notification_push_webhook() from authenticated;
