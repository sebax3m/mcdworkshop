-- 1. Extra sourcing fields on the single source of truth for part requirements
ALTER TABLE public.booking_parts
  ADD COLUMN IF NOT EXISTS brand text,
  ADD COLUMN IF NOT EXISTS supplier_sku text,
  ADD COLUMN IF NOT EXISTS supplier_url text,
  ADD COLUMN IF NOT EXISTS freight numeric(10,2),
  ADD COLUMN IF NOT EXISTS catalog_id uuid;

-- 2. Reusable master parts database
CREATE TABLE IF NOT EXISTS public.parts_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key_norm text NOT NULL UNIQUE,
  part_number text,
  description text NOT NULL,
  item text,
  brand text,
  last_supplier text,
  supplier_sku text,
  supplier_url text,
  last_cost numeric(10,2),
  last_sell numeric(10,2),
  avg_cost numeric(10,2),
  times_purchased integer NOT NULL DEFAULT 0,
  bikes jsonb NOT NULL DEFAULT '[]'::jsonb,
  suppliers jsonb NOT NULL DEFAULT '[]'::jsonb,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_purchased_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.parts_catalog TO authenticated;
GRANT ALL ON public.parts_catalog TO service_role;
ALTER TABLE public.parts_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read parts catalog" ON public.parts_catalog FOR SELECT TO authenticated USING (true);
CREATE POLICY "staff write parts catalog" ON public.parts_catalog FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE INDEX IF NOT EXISTS parts_catalog_part_number_idx ON public.parts_catalog (lower(part_number));
CREATE INDEX IF NOT EXISTS parts_catalog_desc_idx ON public.parts_catalog (lower(description));

CREATE TRIGGER parts_catalog_touch BEFORE UPDATE ON public.parts_catalog
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 3. Immutable purchase history that feeds supplier learning
CREATE TABLE IF NOT EXISTS public.parts_purchase_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_id uuid REFERENCES public.parts_catalog(id) ON DELETE CASCADE,
  booking_part_id uuid REFERENCES public.booking_parts(id) ON DELETE SET NULL,
  booking_id uuid,
  claim_id uuid,
  job_id uuid,
  part_number text,
  description text,
  brand text,
  supplier text,
  supplier_sku text,
  supplier_url text,
  qty numeric(10,2),
  cost numeric(10,2),
  sell_price numeric(10,2),
  freight numeric(10,2),
  ordered_at date,
  received_at date,
  lead_days integer,
  bike_make text,
  bike_model text,
  bike_year integer,
  rego text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS parts_purchase_history_bp_uniq
  ON public.parts_purchase_history (booking_part_id) WHERE booking_part_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS parts_purchase_history_catalog_idx ON public.parts_purchase_history (catalog_id);
CREATE INDEX IF NOT EXISTS parts_purchase_history_supplier_idx ON public.parts_purchase_history (lower(supplier));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.parts_purchase_history TO authenticated;
GRANT ALL ON public.parts_purchase_history TO service_role;
ALTER TABLE public.parts_purchase_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read parts history" ON public.parts_purchase_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "staff write parts history" ON public.parts_purchase_history FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

ALTER TABLE public.booking_parts
  ADD CONSTRAINT booking_parts_catalog_fk FOREIGN KEY (catalog_id)
  REFERENCES public.parts_catalog(id) ON DELETE SET NULL;

-- 4. Learn from every ordered / received part
CREATE OR REPLACE FUNCTION public.parts_catalog_learn(p_bp_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  bp record; v_key text; v_cat uuid;
  v_bike record; v_job uuid; v_lead int;
BEGIN
  SELECT * INTO bp FROM booking_parts WHERE id = p_bp_id;
  IF bp.id IS NULL THEN RETURN NULL; END IF;
  IF bp.status NOT IN ('ordered','partially_shipped','shipped','ready_for_collection','partially_received','arrived') THEN
    RETURN bp.catalog_id;
  END IF;

  v_key := coalesce(nullif(public.garage_norm(bp.part_number), ''), public.garage_norm(bp.description));
  IF v_key IS NULL OR v_key = '' THEN RETURN NULL; END IF;

  SELECT mc.make, mc.model, mc.year, mc.rego INTO v_bike
    FROM bookings b JOIN motorcycles mc ON mc.id = b.motorcycle_id
   WHERE b.id = bp.booking_id;
  IF v_bike IS NULL THEN
    SELECT mc.make, mc.model, mc.year, mc.rego INTO v_bike
      FROM insurance_claims c JOIN motorcycles mc ON mc.id = c.motorcycle_id
     WHERE c.id = bp.claim_id;
  END IF;
  SELECT job_id INTO v_job FROM bookings WHERE id = bp.booking_id;

  INSERT INTO parts_catalog (key_norm, part_number, description, item, brand, last_supplier,
                             supplier_sku, supplier_url, last_cost, last_sell, avg_cost,
                             times_purchased, last_purchased_at)
  VALUES (v_key, nullif(bp.part_number,''), bp.description,
          public.part_item_of(bp.part_number, bp.description, bp.supplier),
          bp.brand, nullif(bp.supplier,''), nullif(bp.supplier_sku,''), nullif(bp.supplier_url,''),
          bp.cost, bp.sell_price, bp.cost, 1, coalesce(bp.received_at, bp.ordered_at, current_date))
  ON CONFLICT (key_norm) DO UPDATE SET
    part_number = coalesce(EXCLUDED.part_number, parts_catalog.part_number),
    description = coalesce(nullif(EXCLUDED.description,''), parts_catalog.description),
    brand = coalesce(EXCLUDED.brand, parts_catalog.brand),
    last_supplier = coalesce(EXCLUDED.last_supplier, parts_catalog.last_supplier),
    supplier_sku = coalesce(EXCLUDED.supplier_sku, parts_catalog.supplier_sku),
    supplier_url = coalesce(EXCLUDED.supplier_url, parts_catalog.supplier_url),
    last_cost = coalesce(EXCLUDED.last_cost, parts_catalog.last_cost),
    last_sell = coalesce(EXCLUDED.last_sell, parts_catalog.last_sell),
    last_purchased_at = greatest(coalesce(EXCLUDED.last_purchased_at, now()), coalesce(parts_catalog.last_purchased_at, '-infinity'::timestamptz)),
    updated_at = now()
  RETURNING id INTO v_cat;

  IF v_bike.make IS NOT NULL THEN
    UPDATE parts_catalog SET bikes = (
      SELECT jsonb_agg(DISTINCT x) FROM jsonb_array_elements(
        bikes || jsonb_build_array(trim(concat_ws(' ', v_bike.make, v_bike.model)))) t(x)
    ) WHERE id = v_cat;
  END IF;
  IF nullif(bp.supplier,'') IS NOT NULL THEN
    UPDATE parts_catalog SET suppliers = (
      SELECT jsonb_agg(DISTINCT x) FROM jsonb_array_elements(suppliers || jsonb_build_array(bp.supplier)) t(x)
    ) WHERE id = v_cat;
  END IF;

  v_lead := CASE WHEN bp.ordered_at IS NOT NULL AND bp.received_at IS NOT NULL
                 THEN (bp.received_at - bp.ordered_at) ELSE NULL END;

  INSERT INTO parts_purchase_history (catalog_id, booking_part_id, booking_id, claim_id, job_id,
    part_number, description, brand, supplier, supplier_sku, supplier_url, qty, cost, sell_price,
    freight, ordered_at, received_at, lead_days, bike_make, bike_model, bike_year, rego)
  VALUES (v_cat, bp.id, bp.booking_id, bp.claim_id, v_job,
    nullif(bp.part_number,''), bp.description, bp.brand, nullif(bp.supplier,''), nullif(bp.supplier_sku,''),
    nullif(bp.supplier_url,''), coalesce(nullif(bp.qty_received,0), bp.qty_required), bp.cost, bp.sell_price,
    bp.freight, bp.ordered_at, bp.received_at, v_lead,
    v_bike.make, v_bike.model, v_bike.year, v_bike.rego)
  ON CONFLICT (booking_part_id) WHERE booking_part_id IS NOT NULL DO UPDATE SET
    catalog_id = EXCLUDED.catalog_id, part_number = EXCLUDED.part_number,
    description = EXCLUDED.description, brand = EXCLUDED.brand, supplier = EXCLUDED.supplier,
    supplier_sku = EXCLUDED.supplier_sku, supplier_url = EXCLUDED.supplier_url,
    qty = EXCLUDED.qty, cost = EXCLUDED.cost, sell_price = EXCLUDED.sell_price,
    freight = EXCLUDED.freight, ordered_at = EXCLUDED.ordered_at, received_at = EXCLUDED.received_at,
    lead_days = EXCLUDED.lead_days, job_id = EXCLUDED.job_id;

  UPDATE parts_catalog c SET
    times_purchased = (SELECT count(*) FROM parts_purchase_history h WHERE h.catalog_id = c.id),
    avg_cost = (SELECT round(avg(h.cost)::numeric, 2) FROM parts_purchase_history h WHERE h.catalog_id = c.id AND h.cost IS NOT NULL)
  WHERE c.id = v_cat;

  UPDATE booking_parts SET catalog_id = v_cat WHERE id = bp.id AND catalog_id IS DISTINCT FROM v_cat;
  RETURN v_cat;
END $$;

CREATE OR REPLACE FUNCTION public.trg_booking_parts_learn()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN PERFORM public.parts_catalog_learn(NEW.id); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS booking_parts_learn ON public.booking_parts;
CREATE TRIGGER booking_parts_learn AFTER INSERT OR UPDATE ON public.booking_parts
  FOR EACH ROW EXECUTE FUNCTION public.trg_booking_parts_learn();

-- 5. Suggestion search over the learned catalogue
CREATE OR REPLACE FUNCTION public.parts_catalog_suggest(p_query text, p_make text DEFAULT NULL, p_model text DEFAULT NULL, p_limit integer DEFAULT 8)
RETURNS TABLE(id uuid, part_number text, description text, brand text, item text,
              last_supplier text, supplier_sku text, supplier_url text,
              last_cost numeric, last_sell numeric, avg_cost numeric,
              times_purchased integer, bikes jsonb, suppliers jsonb, last_purchased_at timestamptz, score integer)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  WITH q AS (SELECT public.garage_norm(coalesce(p_query,'')) AS qn, lower(btrim(coalesce(p_query,''))) AS ql)
  SELECT c.id, c.part_number, c.description, c.brand, c.item, c.last_supplier, c.supplier_sku,
         c.supplier_url, c.last_cost, c.last_sell, c.avg_cost, c.times_purchased, c.bikes,
         c.suppliers, c.last_purchased_at,
         (CASE WHEN public.garage_norm(c.part_number) = q.qn AND q.qn <> '' THEN 100 ELSE 0 END
        + CASE WHEN q.qn <> '' AND public.garage_norm(c.part_number) LIKE '%' || q.qn || '%' THEN 40 ELSE 0 END
        + CASE WHEN q.qn <> '' AND public.garage_norm(c.description) LIKE '%' || q.qn || '%' THEN 30 ELSE 0 END
        + CASE WHEN p_make IS NOT NULL AND c.bikes::text ILIKE '%' || p_make || '%' THEN 20 ELSE 0 END
        + CASE WHEN p_model IS NOT NULL AND c.bikes::text ILIKE '%' || p_model || '%' THEN 15 ELSE 0 END
        + least(c.times_purchased, 10))::int AS score
    FROM parts_catalog c, q
   WHERE q.qn = '' OR public.garage_norm(c.part_number) LIKE '%' || q.qn || '%'
      OR public.garage_norm(c.description) LIKE '%' || q.qn || '%'
      OR public.garage_norm(coalesce(c.brand,'')) LIKE '%' || q.qn || '%'
   ORDER BY score DESC, c.last_purchased_at DESC NULLS LAST
   LIMIT greatest(1, coalesce(p_limit, 8));
$$;

-- 6. Supplier learning summary
CREATE OR REPLACE FUNCTION public.parts_supplier_stats()
RETURNS TABLE(supplier text, orders bigint, parts bigint, last_order date, avg_lead_days numeric, avg_cost numeric)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT h.supplier, count(*) AS orders, count(DISTINCT h.catalog_id) AS parts,
         max(coalesce(h.ordered_at, h.received_at)) AS last_order,
         round(avg(h.lead_days)::numeric, 1) AS avg_lead_days,
         round(avg(h.cost)::numeric, 2) AS avg_cost
    FROM parts_purchase_history h
   WHERE h.supplier IS NOT NULL AND h.supplier <> ''
   GROUP BY h.supplier
   ORDER BY count(*) DESC;
$$;

-- 7. Backfill the catalogue from parts already ordered/received
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM booking_parts
            WHERE status IN ('ordered','partially_shipped','shipped','ready_for_collection','partially_received','arrived')
  LOOP PERFORM public.parts_catalog_learn(r.id); END LOOP;
END $$;
