-- One-time welcome email delivery state for Firebase-created profiles.
-- Existing rows remain LEGACY so deploying this migration does not email old users.
alter table public.profiles
  add column if not exists welcome_email_status text not null default 'LEGACY';

alter table public.profiles
  add column if not exists welcome_email_sent_at timestamptz;

comment on column public.profiles.welcome_email_status is
  'LEGACY, PENDING, SENT or SKIPPED; controls one-time welcome email delivery';

comment on column public.profiles.welcome_email_sent_at is
  'Timestamp of the successful Resend welcome email delivery';

create index if not exists idx_profiles_welcome_email_status
  on public.profiles(welcome_email_status);
