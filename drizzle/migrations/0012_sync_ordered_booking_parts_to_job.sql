CREATE OR REPLACE FUNCTION public.sync_booking_part_to_job(p_bp_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE bp record; v_job uuid; v_item text; v_desc text;
BEGIN
  SELECT * INTO bp FROM booking_parts WHERE id = p_bp_id;
  IF bp.id IS NULL OR bp.booking_id IS NULL THEN RETURN; END IF;
  SELECT job_id INTO v_job FROM bookings WHERE id = bp.booking_id;
  IF v_job IS NULL THEN RETURN; END IF;
  IF bp.status = 'cancelled' THEN
    DELETE FROM parts WHERE booking_part_id = bp.id;
  ELSIF bp.status <> 'needs_ordering' THEN
    v_item := public.part_item_of(bp.part_number, bp.description, NULL);
    v_desc := CASE
      WHEN bp.description IS NOT NULL AND btrim(bp.description) <> ''
        THEN btrim(bp.description)
      ELSE public.part_desc_of(bp.part_number, bp.description, bp.supplier, v_item)
    END;
    INSERT INTO parts (job_id, part_number, name, quantity, supplier, cost, retail, on_invoice, booking_part_id, added_by)
    VALUES (v_job, v_item, v_desc,
            COALESCE(NULLIF(bp.qty_received,0), bp.qty_required, 1), bp.supplier,
            bp.cost, COALESCE(bp.sell_price, bp.cost), true, bp.id, bp.created_by)
    ON CONFLICT (booking_part_id) WHERE booking_part_id IS NOT NULL DO UPDATE
      SET part_number = EXCLUDED.part_number, name = EXCLUDED.name, quantity = EXCLUDED.quantity,
          supplier = EXCLUDED.supplier,
          cost = COALESCE(EXCLUDED.cost, parts.cost), retail = COALESCE(EXCLUDED.retail, parts.retail);
  END IF;
END $function$;

DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT bp.id FROM booking_parts bp JOIN bookings b ON b.id = bp.booking_id
           WHERE b.job_id IS NOT NULL AND bp.status NOT IN ('needs_ordering','cancelled')
             AND b.status NOT IN ('completed','invoiced','cancelled')
  LOOP PERFORM public.sync_booking_part_to_job(r.id); END LOOP;
END $$;