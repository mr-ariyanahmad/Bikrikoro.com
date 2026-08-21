-- BikriKoro — chat RPC and table access hardening
--
-- BikriKoro authenticates users with Firebase. The server gateway verifies the
-- Firebase ID token, derives token.uid, and calls these RPCs with service_role.
-- Browser roles must not be able to supply p_user_id or p_sender_id directly.
--
-- This migration preserves the existing function signatures and chat schema.
-- It removes the legacy permissive table policies and direct browser execution.

begin;

-- Chat rows are no longer read or written directly from the browser. All chat
-- access goes through the Firebase-verified /api/chat gateway.
drop policy if exists "Chat threads are publicly readable" on public.chat_threads;
drop policy if exists "Users can create chat threads" on public.chat_threads;
drop policy if exists "Chat messages are publicly readable" on public.chat_messages;
drop policy if exists "Users can send chat messages" on public.chat_messages;

revoke all on table public.chat_threads from public, anon, authenticated;
revoke all on table public.chat_messages from public, anon, authenticated;
grant select, insert, update, delete on table public.chat_threads to service_role;
grant select, insert, update, delete on table public.chat_messages to service_role;

do $$
declare
  item record;
  protected_names text[] := array[
    'find_or_create_chat_thread',
    'list_my_chat_threads',
    'get_my_chat_thread',
    'list_my_chat_messages',
    'mark_my_chat_thread_read',
    'send_chat_message'
  ];
begin
  for item in
    select
      n.nspname as schema_name,
      p.proname as function_name,
      pg_get_function_identity_arguments(p.oid) as identity_args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and p.proname = any(protected_names)
  loop
    execute format(
      'alter function %I.%I(%s) set search_path = public, pg_temp',
      item.schema_name,
      item.function_name,
      item.identity_args
    );

    execute format(
      'revoke all on function %I.%I(%s) from public, anon, authenticated',
      item.schema_name,
      item.function_name,
      item.identity_args
    );

    execute format(
      'grant execute on function %I.%I(%s) to service_role',
      item.schema_name,
      item.function_name,
      item.identity_args
    );
  end loop;
end;
$$;

commit;
