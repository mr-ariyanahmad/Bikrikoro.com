-- Complete the encrypted delivery flow after 123_encrypt_delivery_at_rest.sql.

create or replace function public.ensure_digital_delivery(p_order_id uuid, p_force boolean)
returns public.digital_deliveries as $$
declare
  o public.orders%rowtype; p public.products%rowtype; c public.digital_product_contents%rowtype; k public.digital_license_inventory%rowtype; d public.digital_deliveries%rowtype;
  key text; typ text := 'INSTRUCTIONS'; txt text := ''; auto_on boolean := true; ready boolean := false;
begin
  key := public.delivery_crypto_key();
  select * into o from public.orders where id = p_order_id for update;
  if not found or o.status not in ('ESCROW_HELD','DIGITAL_DELIVERED','DISPUTED','COMPLETED') then raise exception 'Digital delivery is not available in current order state'; end if;
  select * into p from public.products where id = o.product_id;
  if not found or p.is_digital is not true then raise exception 'Only digital products can be delivered automatically'; end if;
  select coalesce(s.auto_delivery_enabled,true) into auto_on from public.product_digital_specs s where s.product_id=o.product_id;
  if not found then auto_on := true; end if;
  select * into d from public.digital_deliveries where order_id=o.id for update;
  if found and d.status in ('READY','REVOKED') then return d; end if;
  select * into c from public.digital_product_contents where product_id=o.product_id;
  if found then typ := coalesce(nullif(c.delivery_type,''),'INSTRUCTIONS'); end if;
  if not (coalesce(p_force,false) or auto_on) then
    insert into public.digital_deliveries(order_id,product_id,buyer_id,seller_id,delivery_type,delivery_text,delivery_ciphertext,status,updated_at)
    values(o.id,o.product_id,o.buyer_id,o.seller_id,typ,'',null,'PENDING',now())
    on conflict(order_id) do update set delivery_type=excluded.delivery_type,updated_at=now()
    returning * into d;
    return d;
  end if;
  if found and c.delivery_type='LICENSE_KEY' then
    select * into k from public.digital_license_inventory where product_id=o.product_id and seller_id::text=o.seller_id::text and status='AVAILABLE' order by created_at,id for update skip locked limit 1;
    if found then
      update public.digital_license_inventory set status='CLAIMED',order_id=o.id,claimed_at=now() where id=k.id;
      txt := coalesce(pgp_sym_decrypt(decode(k.secret_ciphertext,'base64'),key),k.secret_text,''); ready := txt <> '';
    end if;
  elsif found then
    txt := coalesce(pgp_sym_decrypt(decode(c.delivery_ciphertext,'base64'),key),c.delivery_text,''); ready := txt <> '';
  end if;
  insert into public.digital_deliveries(order_id,product_id,buyer_id,seller_id,delivery_type,delivery_text,delivery_ciphertext,status,delivered_at,updated_at)
  values(o.id,o.product_id,o.buyer_id,o.seller_id,typ,'',case when ready then encode(pgp_sym_encrypt(txt,key,'cipher-algo=aes256'),'base64') else null end,case when ready then 'READY' else 'PENDING' end,case when ready then now() else null end,now())
  on conflict(order_id) do update set delivery_type=case when public.digital_deliveries.status='PENDING' then excluded.delivery_type else public.digital_deliveries.delivery_type end, delivery_text='', delivery_ciphertext=case when public.digital_deliveries.status='PENDING' then excluded.delivery_ciphertext else public.digital_deliveries.delivery_ciphertext end, status=case when public.digital_deliveries.status='PENDING' and excluded.status='READY' then 'READY' else public.digital_deliveries.status end, delivered_at=coalesce(public.digital_deliveries.delivered_at,excluded.delivered_at),updated_at=now()
  returning * into d;
  if d.status='READY' and o.status='ESCROW_HELD' then update public.orders set status='DIGITAL_DELIVERED',digital_delivered_at=coalesce(digital_delivered_at,now()),updated_at=now() where id=o.id and status='ESCROW_HELD'; end if;
  return d;
end;
$$ language plpgsql security definer set search_path=public,pg_temp;

create or replace function public.ensure_digital_delivery(p_order_id uuid)
returns public.digital_deliveries as $$ begin return public.ensure_digital_delivery(p_order_id,false); end; $$ language plpgsql security definer set search_path=public,pg_temp;

create or replace function public.seller_upsert_digital_content(p_seller_id text,p_product_id uuid,p_delivery_type text,p_delivery_text text)
returns void as $$
declare key text; auto_on boolean := true; found_options boolean := false; o public.orders%rowtype;
begin
 key:=public.delivery_crypto_key();
 if p_delivery_type not in ('INSTRUCTIONS','LICENSE_KEY','DOWNLOAD_LINK') then raise exception 'Invalid digital delivery type'; end if;
 if not exists(select 1 from public.products where id=p_product_id and seller_id=p_seller_id and is_digital=true) then raise exception 'Digital listing not found or not yours'; end if;
 insert into public.digital_product_contents(product_id,seller_id,delivery_type,delivery_text,delivery_ciphertext) values(p_product_id,p_seller_id,p_delivery_type,'',case when coalesce(trim(p_delivery_text),'')='' then null else encode(pgp_sym_encrypt(trim(p_delivery_text),key,'cipher-algo=aes256'),'base64') end)
 on conflict(product_id) do update set seller_id=excluded.seller_id,delivery_type=excluded.delivery_type,delivery_text='',delivery_ciphertext=excluded.delivery_ciphertext,updated_at=now();
 select coalesce(s.auto_delivery_enabled,true) into auto_on from public.product_digital_specs s where s.product_id=p_product_id; found_options:=found;
 if not found_options or auto_on then for o in select * from public.orders where product_id=p_product_id and seller_id::text=p_seller_id::text and status in ('ESCROW_HELD','DIGITAL_DELIVERED','DISPUTED') order by created_at,id loop perform public.ensure_digital_delivery(o.id,false); end loop; end if;
end; $$ language plpgsql security definer set search_path=public,pg_temp;

create or replace function public.seller_add_license_keys(p_seller_id text,p_product_id uuid,p_keys text[])
returns integer as $$
declare key text; count_added integer; auto_on boolean := true; found_options boolean := false; o public.orders%rowtype;
begin
 key:=public.delivery_crypto_key();
 if not exists(select 1 from public.products where id=p_product_id and seller_id=p_seller_id and is_digital=true) then raise exception 'Digital listing not found or not yours'; end if;
 insert into public.digital_license_inventory(product_id,seller_id,secret_text,secret_ciphertext) select p_product_id,p_seller_id,'',encode(pgp_sym_encrypt(trim(v),key,'cipher-algo=aes256'),'base64') from unnest(coalesce(p_keys,'{}')) v where trim(v)<>'';
 get diagnostics count_added=row_count;
 select coalesce(s.auto_delivery_enabled,true) into auto_on from public.product_digital_specs s where s.product_id=p_product_id; found_options:=found;
 if count_added>0 and (not found_options or auto_on) then for o in select * from public.orders where product_id=p_product_id and seller_id::text=p_seller_id::text and status='ESCROW_HELD' order by created_at,id loop perform public.ensure_digital_delivery(o.id,false); end loop; end if;
 return count_added;
end; $$ language plpgsql security definer set search_path=public,pg_temp;

create or replace function public.seller_get_digital_content(p_seller_id text,p_product_id uuid)
returns table(delivery_type text,delivery_text text,updated_at timestamptz) as $$ declare key text; begin key:=public.delivery_crypto_key(); return query select c.delivery_type,coalesce(pgp_sym_decrypt(decode(c.delivery_ciphertext,'base64'),key),c.delivery_text,''),c.updated_at from public.digital_product_contents c where c.product_id=p_product_id and c.seller_id=p_seller_id; end; $$ language plpgsql security definer set search_path=public,pg_temp;

create or replace function public.buyer_get_digital_delivery(p_buyer_id text,p_order_id uuid)
returns table(order_id uuid,delivery_type text,delivery_text text,status text,delivered_at timestamptz,updated_at timestamptz) as $$ declare key text; begin key:=public.delivery_crypto_key(); return query select d.order_id,d.delivery_type,coalesce(pgp_sym_decrypt(decode(d.delivery_ciphertext,'base64'),key),d.delivery_text,''),d.status,d.delivered_at,d.updated_at from public.digital_deliveries d join public.orders o on o.id=d.order_id where d.order_id=p_order_id and o.buyer_id=p_buyer_id; end; $$ language plpgsql security definer set search_path=public,pg_temp;

create or replace function public.buyer_list_digital_deliveries(p_buyer_id text,p_order_ids uuid[])
returns table(order_id uuid,delivery_type text,delivery_text text,status text,delivered_at timestamptz,updated_at timestamptz) as $$ declare key text; begin key:=public.delivery_crypto_key(); return query select d.order_id,d.delivery_type,coalesce(pgp_sym_decrypt(decode(d.delivery_ciphertext,'base64'),key),d.delivery_text,''),d.status,d.delivered_at,d.updated_at from public.digital_deliveries d join public.orders o on o.id=d.order_id where o.buyer_id=p_buyer_id and d.order_id=any(coalesce(p_order_ids,'{}')); end; $$ language plpgsql security definer set search_path=public,pg_temp;

update public.digital_product_contents set delivery_ciphertext=encode(pgp_sym_encrypt(delivery_text,public.delivery_crypto_key(),'cipher-algo=aes256'),'base64'),delivery_text='' where coalesce(delivery_text,'')<>'' and coalesce(delivery_ciphertext,'')='';
update public.digital_license_inventory set secret_ciphertext=encode(pgp_sym_encrypt(secret_text,public.delivery_crypto_key(),'cipher-algo=aes256'),'base64'),secret_text='' where coalesce(secret_text,'')<>'' and coalesce(secret_ciphertext,'')='';
update public.digital_deliveries set delivery_ciphertext=encode(pgp_sym_encrypt(delivery_text,public.delivery_crypto_key(),'cipher-algo=aes256'),'base64'),delivery_text='' where coalesce(delivery_text,'')<>'' and coalesce(delivery_ciphertext,'')='';

revoke all on function public.delivery_crypto_key() from public,anon,authenticated;
revoke all on function public.seller_get_digital_content(text,uuid) from public,anon,authenticated;
revoke all on function public.buyer_get_digital_delivery(text,uuid) from public,anon,authenticated;
revoke all on function public.buyer_list_digital_deliveries(text,uuid[]) from public,anon,authenticated;
