-- profiles.is_verified is displayed as the seller verified badge in the marketplace.
-- It must never be true without an APPROVED seller registration.
create or replace function public.enforce_seller_verified_badge()
returns trigger as $$
begin
  if coalesce(new.is_verified, false) and not exists (
    select 1 from public.seller_registrations sr where sr.user_id = new.id and sr.status = 'APPROVED'
  ) then
    new.is_verified := false;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

drop trigger if exists trg_enforce_seller_verified_badge on public.profiles;
create trigger trg_enforce_seller_verified_badge
before insert or update of is_verified on public.profiles
for each row execute function public.enforce_seller_verified_badge();

update public.profiles p
set is_verified = false
where p.is_verified = true
and not exists (select 1 from public.seller_registrations sr where sr.user_id = p.id and sr.status = 'APPROVED');
