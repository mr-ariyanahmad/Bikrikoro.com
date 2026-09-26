-- Bikrify verified brand
-- Public Bikrify status is reserved for users whose seller verification was approved
-- as PERSONAL (NID), BUSINESS, or COMPANY. Ordinary listing users stay unbadged.

create or replace function public.is_bikrify_eligible(p_user_id text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.seller_registrations sr
    where sr.user_id = p_user_id
      and sr.status = 'APPROVED'
      and coalesce(sr.business_type, case when sr.seller_type = 'BUSINESS' then 'BUSINESS' else 'PERSONAL' end)
        in ('PERSONAL', 'BUSINESS', 'COMPANY')
  );
$$;

revoke all on function public.is_bikrify_eligible(text) from public, anon, authenticated;

create or replace function public.normalize_bikrify_badge()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.badge_key := 'bikrify_verified';
  new.badge_label := 'Bikrify';
  return new;
end;
$$;

drop trigger if exists trg_normalize_bikrify_badge on public.seller_verification_badges;
create trigger trg_normalize_bikrify_badge
before insert or update of badge_key, badge_label on public.seller_verification_badges
for each row execute function public.normalize_bikrify_badge();

create or replace function public.refresh_bikrify_profile_status()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.profiles
  set is_verified = public.is_bikrify_eligible(new.user_id)
  where id = new.user_id;
  return new;
end;
$$;

drop trigger if exists trg_refresh_bikrify_profile_status on public.seller_registrations;
create trigger trg_refresh_bikrify_profile_status
after insert or update of status, business_type, seller_type on public.seller_registrations
for each row execute function public.refresh_bikrify_profile_status();

-- Keep the existing profile flag safe even if an older client or admin path writes it.
create or replace function public.enforce_seller_verified_badge()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if coalesce(new.is_verified, false) and not public.is_bikrify_eligible(new.id) then
    new.is_verified := false;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_seller_verified_badge on public.profiles;
create trigger trg_enforce_seller_verified_badge
before insert or update of is_verified on public.profiles
for each row execute function public.enforce_seller_verified_badge();

-- Replace legacy category/mode labels with one brand badge per eligible seller.
delete from public.seller_verification_badges;
insert into public.seller_verification_badges (user_id, badge_key, badge_label)
select p.id, 'bikrify_verified', 'Bikrify'
from public.profiles p
where public.is_bikrify_eligible(p.id)
on conflict (user_id, badge_key) do update
set badge_label = excluded.badge_label, verified_at = now();

update public.profiles p
set is_verified = public.is_bikrify_eligible(p.id)
where p.is_verified is distinct from public.is_bikrify_eligible(p.id);
