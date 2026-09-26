begin;

create or replace function public.customer_commission_amount(p_base numeric, p_rate numeric)
returns numeric as $$
begin
  if coalesce(p_rate, 0) <= 0 then return 0; end if;
  return round(greatest(coalesce(p_base, 0) * p_rate / 100, 2), 2);
end;
$$ language plpgsql immutable;

commit;
