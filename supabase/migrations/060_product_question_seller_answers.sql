-- BikriKoro — seller answers for product questions.
-- Only the seller who owns the product may create or edit its answer.

create or replace function public.answer_product_question(
  p_seller_id text,
  p_question_id uuid,
  p_answer text
) returns void as $$
declare
  v_product_seller_id text;
  v_answer text := trim(coalesce(p_answer, ''));
begin
  if v_answer = '' then
    raise exception 'Answer is required';
  end if;

  select p.seller_id::text
    into v_product_seller_id
  from public.product_questions q
  join public.products p on p.id = q.product_id
  where q.id = p_question_id;

  if v_product_seller_id is null then
    raise exception 'Product question not found';
  end if;
  if v_product_seller_id <> p_seller_id::text then
    raise exception 'Only the listing seller can answer this question';
  end if;

  update public.product_questions
  set answer = left(v_answer, 2000),
      answered_at = now()
  where id = p_question_id;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

revoke all on function public.answer_product_question(text, uuid, text) from public, anon, authenticated;
grant execute on function public.answer_product_question(text, uuid, text) to service_role;

create or replace function public.notify_product_question_event()
returns trigger as $$
declare
  v_seller_id text;
  v_product_title text;
  v_recipient_id text;
  v_title text;
  v_body text;
  v_event text;
begin
  select p.seller_id::text, p.title
    into v_seller_id, v_product_title
  from public.products p
  where p.id = new.product_id;

  if tg_op = 'INSERT' then
    v_recipient_id := v_seller_id;
    v_title := 'আপনার product-এ নতুন প্রশ্ন এসেছে';
    v_body := left(coalesce(new.question, ''), 160);
    v_event := 'PRODUCT_QUESTION';
  elsif tg_op = 'UPDATE' and new.answer is distinct from old.answer and coalesce(new.answer, '') <> '' then
    v_recipient_id := new.asker_id::text;
    v_title := 'আপনার প্রশ্নের উত্তর এসেছে';
    v_body := left(coalesce(new.answer, ''), 160);
    v_event := 'PRODUCT_QUESTION_ANSWERED';
  else
    return new;
  end if;

  if v_recipient_id is not null and (v_event = 'PRODUCT_QUESTION_ANSWERED' or v_recipient_id <> new.asker_id::text) then
    perform public.notify_user_event(
      v_recipient_id,
      'SYSTEM',
      v_title,
      v_body,
      '/products/' || new.product_id::text,
      jsonb_build_object(
        'event', v_event,
        'question_id', new.id,
        'product_id', new.product_id,
        'product_title', v_product_title,
        'asker_id', new.asker_id,
        'seller_id', v_seller_id
      )
    );
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

drop trigger if exists trg_notify_product_question_event on public.product_questions;
create trigger trg_notify_product_question_event
after insert or update of answer on public.product_questions
for each row execute function public.notify_product_question_event();
