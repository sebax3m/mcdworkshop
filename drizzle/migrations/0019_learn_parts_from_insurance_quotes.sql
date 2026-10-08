CREATE OR REPLACE FUNCTION public.trg_insurance_quote_learn_parts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  it jsonb; v_key text; v_code text; v_name text; v_desc text; v_price numeric; v_bike text; v_cat uuid;
BEGIN
  IF NEW.quote_items IS NULL OR jsonb_typeof(NEW.quote_items::jsonb) <> 'array' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND NEW.quote_items::jsonb IS NOT DISTINCT FROM OLD.quote_items::jsonb THEN RETURN NEW; END IF;

  SELECT nullif(trim(concat_ws(' ', mc.make, mc.model)), '') INTO v_bike
    FROM motorcycles mc WHERE mc.id = NEW.motorcycle_id;

  FOR it IN SELECT * FROM jsonb_array_elements(NEW.quote_items::jsonb) LOOP
    CONTINUE WHEN coalesce(it->>'kind','part') = 'labour';
    v_code := nullif(btrim(coalesce(it->>'item_code','')), '');
    v_name := nullif(btrim(coalesce(it->>'item_name','')), '');
    v_desc := nullif(btrim(coalesce(it->>'description','')), '');
    BEGIN v_price := nullif(it->>'unit_price','')::numeric; EXCEPTION WHEN others THEN v_price := NULL; END;
    v_key := coalesce(nullif(public.garage_norm(v_code), ''), public.garage_norm(coalesce(v_name, v_desc)));
    CONTINUE WHEN v_key IS NULL OR v_key = '' OR coalesce(v_name, v_desc) IS NULL;

    INSERT INTO parts_catalog (key_norm, part_number, description, item, last_sell, times_purchased)
    VALUES (v_key, v_code, coalesce(v_desc, v_name), v_name, nullif(v_price, 0), 0)
    ON CONFLICT (key_norm) DO UPDATE SET
      part_number = coalesce(parts_catalog.part_number, EXCLUDED.part_number),
      item = coalesce(EXCLUDED.item, parts_catalog.item),
      description = coalesce(EXCLUDED.description, parts_catalog.description),
      last_sell = coalesce(EXCLUDED.last_sell, parts_catalog.last_sell),
      updated_at = now()
    RETURNING id INTO v_cat;

    IF v_bike IS NOT NULL THEN
      UPDATE parts_catalog SET bikes = (
        SELECT jsonb_agg(DISTINCT x) FROM jsonb_array_elements(bikes || jsonb_build_array(v_bike)) t(x)
      ) WHERE id = v_cat;
    END IF;
  END LOOP;
  RETURN NEW;
EXCEPTION WHEN others THEN
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS insurance_quote_learn_parts ON public.insurance_claims;
CREATE TRIGGER insurance_quote_learn_parts
AFTER INSERT OR UPDATE OF quote_items ON public.insurance_claims
FOR EACH ROW EXECUTE FUNCTION public.trg_insurance_quote_learn_parts();

UPDATE public.insurance_claims SET quote_items = quote_items WHERE quote_items IS NOT NULL;