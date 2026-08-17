-- Wishlist folders for favorites. Existing favorites remain in the default "সব" view.
create table if not exists public.wishlist_folders (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.profiles(id) on delete cascade,
  name text not null,
  color text not null default 'brand',
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

alter table public.wishlist_folders enable row level security;
drop policy if exists "Users manage wishlist folders" on public.wishlist_folders;
create policy "Users manage wishlist folders" on public.wishlist_folders for all using (true) with check (true);

alter table public.favorites add column if not exists folder_id uuid references public.wishlist_folders(id) on delete set null;
create index if not exists favorites_folder_idx on public.favorites (user_id, folder_id);

create or replace function public.create_wishlist_folder(p_user_id text, p_name text, p_color text default 'brand')
returns uuid as $$
declare v_id uuid;
begin
  insert into public.wishlist_folders(user_id, name, color)
  values (p_user_id, trim(p_name), coalesce(nullif(trim(p_color), ''), 'brand'))
  on conflict (user_id, name) do update set color = excluded.color
  returning id into v_id;
  return v_id;
end;
$$ language plpgsql security definer;

create or replace function public.set_favorite_folder(p_user_id text, p_product_id uuid, p_folder_id uuid)
returns void as $$
begin
  update public.favorites set folder_id = p_folder_id where user_id = p_user_id and product_id = p_product_id;
end;
$$ language plpgsql security definer;
