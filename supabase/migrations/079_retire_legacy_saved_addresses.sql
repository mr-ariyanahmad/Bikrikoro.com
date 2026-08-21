-- BikriKoro — Issue 6: retire the obsolete Saved Addresses surface
--
-- The marketplace is digital-only. Saved addresses are no longer used by the
-- checkout or any current UI. Keep the table for controlled service-side data
-- retention/cleanup, but remove the legacy PostgREST RPC entry points.

begin;

-- These functions are no longer called by the application. Dropping them is
-- safer than leaving a dormant identity-bearing RPC in the schema.
drop function if exists public.list_saved_addresses(text);
drop function if exists public.upsert_saved_address(text, uuid, text, text, text, text, text, text, text, boolean);
drop function if exists public.delete_saved_address(text, uuid);

-- Keep any retained historical address rows inaccessible to browser roles.
do $$
begin
  if to_regclass('public.saved_addresses') is not null then
    execute 'alter table public.saved_addresses enable row level security';
    execute 'drop policy if exists "Saved addresses readable" on public.saved_addresses';
    execute 'drop policy if exists "Saved addresses writable through functions" on public.saved_addresses';
    execute 'revoke all on table public.saved_addresses from public, anon, authenticated';
    execute 'grant select, insert, update, delete on table public.saved_addresses to service_role';
    execute 'comment on table public.saved_addresses is ''Retired digital-only legacy data; service-side retention or cleanup only.''';
  end if;
end;
$$;

commit;
