begin;

create or replace function public.get_public_customer_commission_rate()
returns numeric
as $$
begin
  return public.commission_rate('commission_customer_rate', 1);
end;
$$ language plpgsql security definer stable set search_path = public, pg_temp;

revoke all on function public.get_public_customer_commission_rate() from public;
grant execute on function public.get_public_customer_commission_rate() to anon, authenticated, service_role;

commit;
