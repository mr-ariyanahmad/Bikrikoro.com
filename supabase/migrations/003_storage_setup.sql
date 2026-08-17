-- =====================================================================
-- BikriKoro — Storage bucket for product images
-- =====================================================================
-- Creates the bucket SupabaseStorageHelper.kt uploads Create Listing
-- photos into. Public read (anyone can view a listing's photos), writes
-- restricted to authenticated-style access at the application layer since
-- this project uses Firebase Auth rather than Supabase Auth (see the note
-- in 001_init.sql about RLS and auth.uid()).
-- =====================================================================

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

create policy "Product images are publicly readable"
    on storage.objects for select
    using (bucket_id = 'product-images');

create policy "Anyone can upload product images"
    on storage.objects for insert
    with check (bucket_id = 'product-images');
