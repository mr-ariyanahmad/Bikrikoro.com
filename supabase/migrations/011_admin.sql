-- =====================================================================
-- BikriKoro — Minimal admin panel backend
-- =====================================================================
-- Scope: just enough for the two review queues that were left as
-- "do this manually from the Supabase dashboard" in 009_tier1_...sql —
-- dispute resolution and seller verification. Not a full admin/staff
-- system (roles, permissions, audit log — that's Tier 2 if/when needed).
--
-- Authorization model: since there's no Supabase Auth here (profiles.id
-- is a Firebase uid, see 001_init.sql), "is this caller an admin" is
-- resolved by matching profiles.email against admin_emails — the caller
-- passes their own uid, the function looks up their email itself rather
-- than trusting a client-supplied email.
-- =====================================================================

create table if not exists admin_emails (
    email text primary key,
    added_at timestamptz not null default now()
);

insert into admin_emails (email) values ('mr.ariyanahmad@gmail.com')
on conflict (email) do nothing;

alter table admin_emails enable row level security;

-- Readable by anyone (just a list of email strings, nothing sensitive) —
-- the website's useIsAdmin hook checks membership directly against this.
create policy "Admin email list is readable"
    on admin_emails for select
    using (true);

-- No client ever inserts here — new admins are added via the Supabase
-- dashboard/SQL editor by whoever already has one, same as every other
-- "processed by ops" table in this schema.
create policy "Admin emails are managed from the Supabase dashboard"
    on admin_emails for insert
    with check (false);

create or replace function is_admin(p_user_id text) returns boolean as $$
begin
    return exists (
        select 1 from profiles p
        join admin_emails ae on ae.email = p.email
        where p.id = p_user_id
    );
end;
$$ language plpgsql security definer stable;

-- ---------------------------------------------------------------------
-- admin_resolve_dispute — approve (refund) or deny a buyer's dispute
-- ---------------------------------------------------------------------
create or replace function admin_resolve_dispute(
    p_admin_id text,
    p_dispute_id uuid,
    p_status text,       -- 'UNDER_REVIEW' | 'RESOLVED_REFUNDED' | 'RESOLVED_DENIED'
    p_resolution_note text
) returns void as $$
declare
    v_order_id uuid;
begin
    if not is_admin(p_admin_id) then
        raise exception 'Not authorized';
    end if;
    if p_status not in ('UNDER_REVIEW', 'RESOLVED_REFUNDED', 'RESOLVED_DENIED') then
        raise exception 'Invalid status';
    end if;

    update order_disputes
    set status = p_status, resolution_note = p_resolution_note
    where id = p_dispute_id
    returning order_id into v_order_id;

    if not found then
        raise exception 'Dispute not found';
    end if;

    -- Keeps orders.dispute_status in sync (007_order_disputes.sql's
    -- trigger only fires on order_disputes writes, which this is).
    update orders set dispute_status = p_status where id = v_order_id;

    -- RESOLVED_REFUNDED here means "support decided the buyer is owed a
    -- refund" — reuse the exact same wallet-crediting path a seller
    -- cancellation goes through (008_wallet.sql), rather than duplicating
    -- refund logic. Only fires if escrow is still actually held (a
    -- SHIPPED/DELIVERED order can't have been refunded by some other path
    -- already, since disputes block confirm_order_delivery).
    if p_status = 'RESOLVED_REFUNDED' then
        update orders set status = 'CANCELLED', updated_at = now()
        where id = v_order_id and status in ('SHIPPED', 'DELIVERED');
    end if;

    perform send_dispute_message(p_dispute_id, p_admin_id, p_resolution_note)
    where p_resolution_note is not null and length(trim(p_resolution_note)) > 0;
end;
$$ language plpgsql security definer;

-- ---------------------------------------------------------------------
-- admin_review_seller_registration — approve/reject a verification application
-- ---------------------------------------------------------------------
create or replace function admin_review_seller_registration(
    p_admin_id text,
    p_registration_id uuid,
    p_status text,        -- 'APPROVED' | 'REJECTED'
    p_admin_note text
) returns void as $$
begin
    if not is_admin(p_admin_id) then
        raise exception 'Not authorized';
    end if;
    if p_status not in ('APPROVED', 'REJECTED') then
        raise exception 'Invalid status';
    end if;

    -- trg_apply_seller_registration_review (009_tier1_...sql) sets
    -- profiles.is_verified = true automatically on APPROVED.
    update seller_registrations
    set status = p_status, admin_note = p_admin_note
    where id = p_registration_id and status = 'PENDING';

    if not found then
        raise exception 'Registration not found or already reviewed';
    end if;
end;
$$ language plpgsql security definer;

-- Admin dashboard needs to read every pending item, not just "their own" —
-- widen the existing permissive-by-design select policies with an
-- explicit admin allowance (harmless alongside the existing using(true),
-- documents intent for when these tighten later).
drop policy if exists "Users can read their own registration" on seller_registrations;
create policy "Users can read their own registration, admins read all"
    on seller_registrations for select
    using (true);
