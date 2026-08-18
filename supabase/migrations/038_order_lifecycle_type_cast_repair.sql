-- =====================================================================
-- BikriKoro — optional repair for migration 033 type mismatch
-- =====================================================================
-- Use this only when migration 033 was previously applied except for the
-- notification trigger, or when the existing trigger must be repaired.
-- It is safe to run more than once.
--
-- IMPORTANT: If migration 033 failed before creating its lifecycle RPCs,
-- run the corrected 033_order_lifecycle_hardening.sql first. This file only
-- repairs the order notification trigger from migration 005/033.
-- =====================================================================

create or replace function public.notify_order_change() returns trigger as $$
declare
  v_buyer_title text;
  v_seller_title text;
  v_body text := 'অর্ডার: ' || new.product_title;
  v_link text := '/orders/' || new.id::text;
begin
  if tg_op = 'INSERT' or old.status is distinct from new.status then
    v_buyer_title := case new.status
      when 'PENDING_PAYMENT' then 'পেমেন্ট সম্পন্ন করুন'
      when 'ESCROW_HELD' then 'পেমেন্ট সফল হয়েছে'
      when 'PREPARING' then 'Seller অর্ডার প্রস্তুত করছেন'
      when 'SHIPPED' then 'আপনার অর্ডার পাঠানো হয়েছে'
      when 'DELIVERED' then 'অর্ডারটি পৌঁছেছে — গ্রহণ নিশ্চিত করুন'
      when 'COMPLETED' then 'অর্ডার সম্পন্ন হয়েছে'
      when 'CANCELLED' then 'অর্ডার বাতিল হয়েছে'
      else 'অর্ডারে নতুন আপডেট'
    end;

    v_seller_title := case new.status
      when 'PENDING_PAYMENT' then 'নতুন checkout শুরু হয়েছে'
      when 'ESCROW_HELD' then 'নতুন অর্ডার পেয়েছেন'
      when 'PREPARING' then 'অর্ডার প্রস্তুত করুন'
      when 'SHIPPED' then 'অর্ডার শিপড হয়েছে'
      when 'DELIVERED' then 'অর্ডার পৌঁছেছে — buyer confirmation অপেক্ষায়'
      when 'COMPLETED' then 'বিক্রয় সম্পন্ন হয়েছে'
      when 'CANCELLED' then 'অর্ডার বাতিল হয়েছে'
      else 'অর্ডারে নতুন আপডেট'
    end;

    insert into public.notifications(user_id, type, title, body, link)
    values (new.buyer_id, 'ORDER', v_buyer_title, v_body, v_link);

    if new.seller_id::text <> new.buyer_id::text then
      insert into public.notifications(user_id, type, title, body, link)
      values (new.seller_id, 'ORDER', v_seller_title, v_body, v_link);
    end if;
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_notify_order_change on public.orders;
create trigger trg_notify_order_change
after insert or update of status on public.orders
for each row execute function public.notify_order_change();

select '038 order lifecycle type-cast repair applied' as result;

-- Optional verification:
-- select pg_get_functiondef('public.notify_order_change()'::regprocedure);
