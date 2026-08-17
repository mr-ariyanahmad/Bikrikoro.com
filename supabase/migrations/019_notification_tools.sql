create or replace function public.mark_all_notifications_read(p_user_id text)
returns integer as $$
declare v_count integer;
begin
  update public.notifications set is_read = true where user_id = p_user_id and is_read = false;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$ language plpgsql security definer;
