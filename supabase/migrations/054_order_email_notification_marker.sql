-- BikriKoro — mark new-order notifications for Resend email delivery
--
-- Existing order notifications and push delivery remain unchanged. Only the
-- INSERT path receives event=ORDER_CREATED metadata; later status changes do
-- not send email.

create or replace function public.notify_order_change() returns trigger as $$
declare
  v_buyer_title text;
  v_seller_title text;
  v_body text := 'অর্ডার: ' || new.product_title;
  v_link text := '/orders/' || new.id::text;
  v_is_new_order boolean := tg_op = 'INSERT';
  v_event text := case when v_is_new_order then 'ORDER_CREATED' else 'ORDER_STATUS_CHANGED' end;
begin
  if v_is_new_order or old.status is distinct from new.status then
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

    perform public.notify_user_event(
      new.buyer_id,
      'ORDER',
      v_buyer_title,
      v_body,
      v_link,
      jsonb_build_object('event', v_event, 'order_id', new.id, 'recipient_role', 'CUSTOMER')
    );

    if new.seller_id::text <> new.buyer_id::text then
      perform public.notify_user_event(
        new.seller_id,
        'ORDER',
        v_seller_title,
        v_body,
        v_link,
        jsonb_build_object('event', v_event, 'order_id', new.id, 'recipient_role', 'SELLER')
      );
    end if;
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

drop trigger if exists trg_notify_order_change on public.orders;
create trigger trg_notify_order_change
after insert or update of status on public.orders
for each row execute function public.notify_order_change();
