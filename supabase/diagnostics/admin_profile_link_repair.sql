-- Replace only the two UID placeholders with the full Firebase UIDs.
-- Copy them using Firebase Console's copy icon; do not use truncated text.

insert into public.profiles (id, name, email)
values
  ('PASTE_FULL_UID_FOR_MR_ARIYANAHMAD', '', lower('mr.ariyanahmad@gmail.com')),
  ('PASTE_FULL_UID_FOR_SMSHAHZADAHMMED', '', lower('smshahzadaahmmed@gmail.com'))
on conflict (id) do update
set email = excluded.email;

-- After this succeeds, rerun the read-only admin_identity_check.sql query.
-- Expected: both rows have is_admin = true and role_key = SUPER_ADMIN.
