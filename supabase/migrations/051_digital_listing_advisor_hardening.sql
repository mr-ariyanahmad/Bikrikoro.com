-- Digital listing advisor hardening.
-- Keep approved public specs readable, but do not express blocked writes as a
-- permissive FOR ALL policy because that creates policy overlap on SELECT.
DROP POLICY IF EXISTS "Digital specs are server-only for writes" ON public.product_digital_specs;

DROP POLICY IF EXISTS "Digital specs inserts are server-only" ON public.product_digital_specs;
CREATE POLICY "Digital specs inserts are server-only"
  ON public.product_digital_specs FOR INSERT
  WITH CHECK (false);

DROP POLICY IF EXISTS "Digital specs updates are server-only" ON public.product_digital_specs;
CREATE POLICY "Digital specs updates are server-only"
  ON public.product_digital_specs FOR UPDATE
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS "Digital specs deletes are server-only" ON public.product_digital_specs;
CREATE POLICY "Digital specs deletes are server-only"
  ON public.product_digital_specs FOR DELETE
  USING (false);

CREATE INDEX IF NOT EXISTS idx_digital_category_templates_parent
  ON public.digital_category_templates(parent_category_id);

CREATE INDEX IF NOT EXISTS idx_digital_license_inventory_order
  ON public.digital_license_inventory(order_id);

CREATE INDEX IF NOT EXISTS idx_digital_license_inventory_seller
  ON public.digital_license_inventory(seller_id);
