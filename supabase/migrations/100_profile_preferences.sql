alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists gender text;
alter table public.profiles add column if not exists date_of_birth date;
alter table public.profiles add column if not exists bio text not null default '';
alter table public.profiles add column if not exists preferred_category_id text references public.categories(id);
create unique index if not exists profiles_username_unique on public.profiles(lower(username)) where username is not null and length(trim(username)) > 0;
alter table public.profiles drop constraint if exists profiles_gender_check;
alter table public.profiles add constraint profiles_gender_check check (gender is null or gender in ('MALE','FEMALE','OTHER','PREFER_NOT_TO_SAY'));
