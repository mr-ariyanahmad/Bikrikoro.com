-- Server-side validation for category-specific digital listing options.
-- This closes the gap between the Bengali form's required fields and direct
-- gateway requests, while preserving the existing RPC signatures.

CREATE OR REPLACE FUNCTION public.seller_upsert_digital_listing_options(
  p_seller_id text,
  p_product_id uuid,
  p_specifications jsonb DEFAULT '{}'::jsonb,
  p_auto_delivery_enabled boolean DEFAULT true,
  p_deactivate_when_out_of_stock boolean DEFAULT false,
  p_stock_mode text DEFAULT 'UNLIMITED',
  p_stock_quantity integer DEFAULT 0,
  p_fulfillment_window_minutes integer DEFAULT 0,
  p_region_code text DEFAULT 'GLOBAL',
  p_subscription_period text DEFAULT '',
  p_warranty_period text DEFAULT '',
  p_delivery_note text DEFAULT ''
) RETURNS void AS $$
DECLARE
  v_category_id text;
  v_template_fields jsonb;
  v_field jsonb;
  v_field_key text;
BEGIN
  SELECT p.category_id
  INTO v_category_id
  FROM public.products p
  WHERE p.id = p_product_id
    AND p.seller_id = p_seller_id
    AND p.is_digital = true;

  IF v_category_id IS NULL THEN
    RAISE EXCEPTION 'Digital listing not found or not yours';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.seller_registrations
    WHERE user_id = p_seller_id
      AND listing_mode = 'DIGITAL'
      AND status = 'APPROVED'
  ) THEN
    RAISE EXCEPTION 'Digital listing requires an approved digital seller verification';
  END IF;

  IF jsonb_typeof(coalesce(p_specifications, '{}'::jsonb)) <> 'object' THEN
    RAISE EXCEPTION 'Digital specifications must be a JSON object';
  END IF;

  IF coalesce(p_stock_mode, 'UNLIMITED') NOT IN ('UNLIMITED', 'QUANTITY', 'KEY_POOL') THEN
    RAISE EXCEPTION 'Invalid digital stock mode';
  END IF;

  IF coalesce(p_stock_quantity, 0) < 0 OR coalesce(p_fulfillment_window_minutes, 0) < 0 THEN
    RAISE EXCEPTION 'Digital stock and fulfillment values cannot be negative';
  END IF;

  IF coalesce(p_stock_mode, 'UNLIMITED') = 'QUANTITY' AND coalesce(p_stock_quantity, 0) < 1 THEN
    RAISE EXCEPTION 'Quantity stock must be greater than zero';
  END IF;

  IF coalesce(p_stock_mode, 'UNLIMITED') = 'KEY_POOL'
     AND NOT EXISTS (
       SELECT 1
       FROM public.digital_product_contents c
       WHERE c.product_id = p_product_id
         AND c.delivery_type = 'LICENSE_KEY'
     ) THEN
    RAISE EXCEPTION 'Key pool stock requires LICENSE_KEY delivery';
  END IF;

  SELECT t.fields
  INTO v_template_fields
  FROM public.digital_category_templates t
  WHERE t.category_id = v_category_id
    AND t.is_active = true;

  FOR v_field IN
    SELECT value
    FROM jsonb_array_elements(coalesce(v_template_fields, '[]'::jsonb))
  LOOP
    IF coalesce((v_field ->> 'required')::boolean, false) THEN
      v_field_key := v_field ->> 'key';
      IF coalesce(nullif(trim(p_specifications ->> v_field_key), ''), '') = '' THEN
        RAISE EXCEPTION 'Required digital specification is missing: %', v_field_key;
      END IF;
    END IF;
  END LOOP;

  INSERT INTO public.product_digital_specs(
    product_id, seller_id, specifications, auto_delivery_enabled,
    deactivate_when_out_of_stock, stock_mode, stock_quantity,
    fulfillment_window_minutes, region_code, subscription_period,
    warranty_period, delivery_note, updated_at
  ) VALUES (
    p_product_id, p_seller_id, coalesce(p_specifications, '{}'::jsonb),
    coalesce(p_auto_delivery_enabled, true), coalesce(p_deactivate_when_out_of_stock, false),
    coalesce(p_stock_mode, 'UNLIMITED'), coalesce(p_stock_quantity, 0),
    coalesce(p_fulfillment_window_minutes, 0), coalesce(nullif(trim(p_region_code), ''), 'GLOBAL'),
    coalesce(trim(p_subscription_period), ''), coalesce(trim(p_warranty_period), ''),
    coalesce(trim(p_delivery_note), ''), now()
  )
  ON CONFLICT (product_id) DO UPDATE SET
    seller_id = excluded.seller_id,
    specifications = excluded.specifications,
    auto_delivery_enabled = excluded.auto_delivery_enabled,
    deactivate_when_out_of_stock = excluded.deactivate_when_out_of_stock,
    stock_mode = excluded.stock_mode,
    stock_quantity = excluded.stock_quantity,
    fulfillment_window_minutes = excluded.fulfillment_window_minutes,
    region_code = excluded.region_code,
    subscription_period = excluded.subscription_period,
    warranty_period = excluded.warranty_period,
    delivery_note = excluded.delivery_note,
    updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.admin_upsert_digital_category_template(
  p_admin_id text,
  p_category_id text,
  p_name_bn text,
  p_name_en text DEFAULT '',
  p_description_bn text DEFAULT '',
  p_icon_key text DEFAULT 'Package',
  p_fields jsonb DEFAULT '[]'::jsonb,
  p_sort_order integer DEFAULT 0,
  p_is_active boolean DEFAULT true
) RETURNS void AS $$
BEGIN
  PERFORM public.admin_assert(p_admin_id);
  IF NOT EXISTS (SELECT 1 FROM public.categories WHERE id = p_category_id) THEN
    RAISE EXCEPTION 'Category not found';
  END IF;
  IF coalesce(trim(p_name_bn), '') = '' THEN
    RAISE EXCEPTION 'Bengali category name is required';
  END IF;
  IF jsonb_typeof(coalesce(p_fields, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'Template fields must be an array';
  END IF;

  UPDATE public.categories
  SET name = trim(p_name_bn)
  WHERE id = p_category_id;

  INSERT INTO public.digital_category_templates(category_id, name_en, description_bn, icon_key, fields, sort_order, is_active, updated_at)
  VALUES (
    p_category_id, coalesce(trim(p_name_en), ''), coalesce(trim(p_description_bn), ''),
    coalesce(nullif(trim(p_icon_key), ''), 'Package'), coalesce(p_fields, '[]'::jsonb),
    coalesce(p_sort_order, 0), coalesce(p_is_active, true), now()
  )
  ON CONFLICT (category_id) DO UPDATE SET
    name_en = excluded.name_en,
    description_bn = excluded.description_bn,
    icon_key = excluded.icon_key,
    fields = excluded.fields,
    sort_order = excluded.sort_order,
    is_active = excluded.is_active,
    updated_at = now();

  PERFORM public.admin_log(
    p_admin_id,
    'UPSERT_DIGITAL_CATEGORY_TEMPLATE',
    'DIGITAL_CATEGORY_TEMPLATE',
    p_category_id,
    jsonb_build_object('active', p_is_active, 'field_count', jsonb_array_length(coalesce(p_fields, '[]'::jsonb)))
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
