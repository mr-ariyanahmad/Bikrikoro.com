-- Correct readable usernames generated from names with uppercase letters.
do $$
declare
  rec record;
  v_base text;
  v_candidate text;
  v_suffix integer;
begin
  for rec in select id, name, shop_name from public.profiles order by created_at loop
    v_base := lower(regexp_replace(coalesce(nullif(trim(rec.shop_name), ''), nullif(trim(rec.name), ''), 'shop'), '[^a-z0-9]+', '-', 'g'));
    v_base := trim(both '-' from v_base);
    if v_base = '' then
      v_base := 'shop-' || lower(substr(regexp_replace(rec.id, '[^a-zA-Z0-9]', '', 'g'), 1, 20));
    end if;
    v_base := left(v_base, 34);
    v_candidate := v_base;
    v_suffix := 1;
    while exists (select 1 from public.profiles p where lower(p.shop_username) = v_candidate and p.id <> rec.id) loop
      v_suffix := v_suffix + 1;
      v_candidate := left(v_base, 40 - length(v_suffix::text) - 1) || '-' || v_suffix::text;
    end loop;
    update public.profiles set shop_username = v_candidate where id = rec.id;
  end loop;
end;
$$;
