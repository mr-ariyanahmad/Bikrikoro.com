-- BikriKoro — payout review notifications
--
-- APPROVED and REJECTED are emitted by the withdrawal status transition. PAID
-- is emitted by the existing wallet-ledger trigger so the wallet debit and
-- payout completion remain one notification.

create or replace function public.notify_wallet_event() returns trigger as $$
declare
  v_is_paid_payout boolean := upper(coalesce(new.type, '')) = 'WITHDRAWAL' and new.amount < 0;
begin
  perform public.notify_user_event(
    new.user_id,
    case when v_is_paid_payout then 'PAYOUT' else 'WALLET' end,
    case when v_is_paid_payout then 'আপনার payout paid হয়েছে' when new.amount >= 0 then 'ওয়ালেটে টাকা যোগ হয়েছে' else 'ওয়ালেট থেকে টাকা কাটা হয়েছে' end,
    case when v_is_paid_payout then 'আপনার payout সফলভাবে paid হয়েছে এবং wallet balance থেকে সমন্বয় করা হয়েছে।' else coalesce(new.description, 'Wallet ledger-এ নতুন update হয়েছে।') end,
    '/wallet',
    jsonb_build_object('ledger_id', new.id, 'amount', new.amount, 'type', new.type, 'payout_paid', v_is_paid_payout)
  );
  return new;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

create or replace function public.notify_withdrawal_review_event() returns trigger as $$
declare
  v_title text;
  v_body text;
begin
  if old.status is distinct from new.status and new.status in ('APPROVED', 'REJECTED') then
    v_title := case when new.status = 'APPROVED' then 'আপনার payout অনুমোদিত হয়েছে' else 'আপনার payout request বাতিল হয়েছে' end;
    v_body := case
      when new.status = 'APPROVED' then 'আপনার ৳' || new.amount::text || ' payout request অনুমোদিত হয়েছে।'
      else coalesce(nullif(trim(new.admin_note), ''), 'আপনার payout request অনুমোদিত হয়নি।')
    end;
    perform public.notify_user_event(
      new.user_id,
      'PAYOUT',
      v_title,
      v_body,
      '/wallet',
      jsonb_build_object('withdrawal_id', new.id, 'status', new.status, 'amount', new.amount)
    );
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

drop trigger if exists trg_notify_withdrawal_review_event on public.wallet_withdrawal_requests;
create trigger trg_notify_withdrawal_review_event
after update of status on public.wallet_withdrawal_requests
for each row execute function public.notify_withdrawal_review_event();
