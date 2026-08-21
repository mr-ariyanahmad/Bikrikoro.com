-- BikriKoro — product question/report hardening
--
-- Browser clients may read only the public question projection. Question asks,
-- reports, direct question RPCs, and seller answers run through Firebase-
-- authenticated server gateways using service_role.

begin;

-- Public Q&A must not expose asker Firebase UID or any future private columns.
drop view if exists public.public_product_questions;
create view public.public_product_questions
with (security_barrier = true)
as
select
  q.id,
  q.product_id,
  q.question,
  q.answer,
  q.answered_at,
  q.created_at
from public.product_questions q
join public.public_products p on p.id = q.product_id;

revoke all on public.public_product_questions from public, anon, authenticated;
grant select on public.public_product_questions to anon, authenticated, service_role;

-- Browser clients no longer read or write the base question/report tables.
-- Database triggers and server gateways continue to use service_role/definer.
revoke all on table public.product_questions from public, anon, authenticated;
revoke all on table public.product_reports from public, anon, authenticated;
grant select, insert, update, delete on table public.product_questions to service_role;
grant select, insert, update, delete on table public.product_reports to service_role;

-- Keep the legacy signatures for server compatibility, but add input and
-- public-product validation so trusted callers cannot create malformed rows.
create or replace function public.ask_product_question(
  p_asker_id text,
  p_product_id uuid,
  p_question text
) returns uuid as $$
declare
  v_id uuid;
  v_question text := trim(coalesce(p_question, ''));
begin
  if nullif(trim(coalesce(p_asker_id, '')), '') is null then
    raise exception 'Question asker is required';
  end if;
  if v_question = '' or length(v_question) > 2000 then
    raise exception 'Question must be between 1 and 2000 characters';
  end if;
  if not exists (select 1 from public.public_products where id = p_product_id) then
    raise exception 'Public digital product not found';
  end if;

  insert into public.product_questions(asker_id, product_id, question)
  values (p_asker_id, p_product_id, v_question)
  returning id into v_id;
  return v_id;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

create or replace function public.report_product(
  p_reporter_id text,
  p_product_id uuid,
  p_reason text,
  p_details text
) returns uuid as $$
declare
  v_id uuid;
  v_reason text := trim(coalesce(p_reason, ''));
  v_details text := left(trim(coalesce(p_details, '')), 2000);
begin
  if nullif(trim(coalesce(p_reporter_id, '')), '') is null then
    raise exception 'Report author is required';
  end if;
  if v_reason not in ('ভুল বা বিভ্রান্তিকর তথ্য', 'নিষিদ্ধ পণ্য', 'ভুয়া বা প্রতারণামূলক তালিকা', 'অন্য কারণ') then
    raise exception 'Invalid report reason';
  end if;
  if not exists (select 1 from public.public_products where id = p_product_id) then
    raise exception 'Public digital product not found';
  end if;

  insert into public.product_reports(reporter_id, product_id, reason, details)
  values (p_reporter_id, p_product_id, v_reason, nullif(v_details, ''))
  returning id into v_id;
  return v_id;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

do $$
declare
  item record;
  protected_names text[] := array[
    'list_product_questions',
    'ask_product_question',
    'report_product',
    'answer_product_question'
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
