-- Read-only diagnostic: Firebase email -> Supabase profile -> Super Admin access
-- Run this in the same Supabase project used by Vercel.
select
  ae.email as allowlisted_email,
  p.id as firebase_uid,
  p.email as profile_email,
  coalesce(a.is_admin, false) as is_admin,
  a.role_key,
  a.permissions
from public.admin_emails ae
left join public.profiles p
  on lower(p.email) = lower(ae.email)
left join lateral public.admin_access(p.id) a
  on true
where lower(ae.email) in (
  lower('mr.ariyanahmad@gmail.com'),
  lower('smshahzadaahmmed@gmail.com')
)
order by ae.email;

-- Expected for every Super Admin email:
-- firebase_uid: not null
-- profile_email: matching Gmail
-- is_admin: true
-- role_key: SUPER_ADMIN
-- permissions: ["*"]
