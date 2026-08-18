-- BikriKoro — notify sellers about new product questions
-- A customer question is written to product_questions by ask_product_question().
-- This trigger creates a seller-only in-app notification; push delivery remains
-- handled by the existing notification token/API pipeline.

create or replace function public.notify_product_question_event()
returns trigger as $$
declare
  v_seller_id text;
  v_product_title text;
begin
  select p.seller_id::text, p.title
    into v_seller_id, v_product_title
  from public.products p
  where p.id = new.product_id;

  if v_seller_id is not null and v_seller_id <> new.asker_id::text then
    perform public.notify_user_event(
      v_seller_id,
      'SYSTEM',
      'আপনার product-এ নতুন প্রশ্ন এসেছে',
      left(coalesce(new.question, ''), 160),
      '/products/' || new.product_id::text,
      jsonb_build_object(
        'event', 'PRODUCT_QUESTION',
        'question_id', new.id,
        'product_id', new.product_id,
        'product_title', v_product_title,
        'asker_id', new.asker_id
      )
    );
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

drop trigger if exists trg_notify_product_question_event on public.product_questions;
create trigger trg_notify_product_question_event
after insert on public.product_questions
for each row execute function public.notify_product_question_event();
