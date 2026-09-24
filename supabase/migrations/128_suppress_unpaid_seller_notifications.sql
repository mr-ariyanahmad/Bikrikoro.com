-- =====================================================================
-- BikriKoro — only notify sellers after payment succeeds
-- =====================================================================
-- A pending checkout is not a sale. Buyers may receive a reminder to
-- complete payment, but sellers must not receive a message until escrow is
-- actually held. This also prevents unpaid checkout rows from being treated
-- as seller activity by downstream notification consumers.

create or replace function public.notify_order_change() returns trigger as $$
declare
  v_buyer_title text;
  v_seller_title text;
  v_body text := 'অর্ডার: ' || new.product_title;
  v_link text := '/orders/' || new.id::text;
  v_seller_paid boolean := new.status in ('ESCROW_HELD', 'PREPARING', 'SHIPPED', 'DELIVERED', 'DIGITAL_DELIVERED', 'COMPLETED', 'DISPUTED');
begin
  if tg_op = 'INSERT' or old.status is distinct from new.status then
    -- The buyer may be reminded about an unfinished payment. No seller
    -- notification is emitted for this state.
    if new.status = 'PENDING_PAYMENT' then
      insert into public.notifications(user_id, type, title, body, link)
      values (new.buyer_id, 'ORDER', 'পেমেন্ট সম্পন্ন করুন', v_body, v_link);
      return new;
    end if;

    v_buyer_title := case new.status
      when 'ESCROW_HELD' then 'পেমেন্ট সফল হয়েছে'
      when 'PREPARING' then 'Seller অর্ডার প্রস্তুত করছেন'
      when 'SHIPPED' then 'আপনার অর্ডার পাঠানো হয়েছে'
      when 'DELIVERED' then 'অর্ডারটি পৌঁছেছে — গ্রহণ নিশ্চিত করুন'
      when 'DIGITAL_DELIVERED' then 'ডিজিটাল ডেলিভারি প্রস্তুত'
      when 'COMPLETED' then 'অর্ডার সম্পন্ন হয়েছে'
      when 'DISPUTED' then 'অর্ডার নিয়ে অভিযোগ পর্যালোচনাধীন'
      when 'CANCELLED' then 'অর্ডার বাতিল হয়েছে'
      when 'REFUNDED' then 'অর্থ ফেরত সম্পন্ন হয়েছে'
      else 'অর্ডারে নতুন আপডেট'
    end;

    v_seller_title := case new.status
      when 'ESCROW_HELD' then 'নতুন পেমেন্ট পাওয়া গেছে — অর্ডার প্রস্তুত করুন'
      when 'PREPARING' then 'অর্ডার প্রস্তুত করুন'
      when 'SHIPPED' then 'অর্ডার শিপড হয়েছে'
      when 'DELIVERED' then 'অর্ডার পৌঁছেছে — buyer confirmation অপেক্ষায়'
      when 'DIGITAL_DELIVERED' then 'ডিজিটাল ডেলিভারি পাঠানো হয়েছে'
      when 'COMPLETED' then 'বিক্রয় সম্পন্ন হয়েছে'
      when 'DISPUTED' then 'অর্ডার নিয়ে অভিযোগ এসেছে'
      else null
    end;

    insert into public.notifications(user_id, type, title, body, link)
    values (new.buyer_id, 'ORDER', v_buyer_title, v_body, v_link);

    if v_seller_paid and v_seller_title is not null and new.seller_id::text <> new.buyer_id::text then
      insert into public.notifications(user_id, type, title, body, link)
      values (new.seller_id, 'ORDER', v_seller_title, v_body, v_link);
    end if;
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

drop trigger if exists trg_notify_order_change on public.orders;
create trigger trg_notify_order_change
after insert or update of status on public.orders
for each row execute function public.notify_order_change();

select '128 seller unpaid notification suppression applied' as result;
