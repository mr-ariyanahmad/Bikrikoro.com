-- Seller verification documents are private and uploaded with short-lived signed URLs.
insert into storage.buckets (id, name, public)
values ('seller-verification-docs', 'seller-verification-docs', false)
on conflict (id) do update set public = false;
