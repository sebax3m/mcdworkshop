CREATE OR REPLACE FUNCTION public.sync_booking_part_to_job(p_bp_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE bp record; v_job uuid; v_item text; v_desc text;
BEGIN
  SELECT * INTO bp FROM booking_parts WHERE id = p_bp_id;
  IF bp.id IS NULL OR bp.booking_id IS NULL THEN RETURN; END IF;
  SELECT job_id INTO v_job FROM bookings WHERE id = bp.booking_id;
  IF v_job IS NULL THEN RETURN; END IF;
  IF bp.status IN ('arrived','partially_received') THEN
    v_item := public.part_item_of(bp.part_number, bp.description, bp.supplier);
    v_desc := public.part_desc_of(bp.part_number, bp.description, bp.supplier, v_item);
    INSERT INTO parts (job_id, part_number, name, quantity, supplier, cost, retail, on_invoice, booking_part_id, added_by)
    VALUES (v_job, v_item, v_desc,
            COALESCE(NULLIF(bp.qty_received,0), bp.qty_required, 1), bp.supplier,
            bp.cost, COALESCE(bp.sell_price, bp.cost), true, bp.id, bp.created_by)
    ON CONFLICT (booking_part_id) WHERE booking_part_id IS NOT NULL DO UPDATE
      SET part_number = EXCLUDED.part_number, name = EXCLUDED.name, quantity = EXCLUDED.quantity,
          supplier = EXCLUDED.supplier,
          cost = COALESCE(EXCLUDED.cost, parts.cost), retail = COALESCE(EXCLUDED.retail, parts.retail);
  ELSIF bp.status = 'cancelled' THEN
    DELETE FROM parts WHERE booking_part_id = bp.id;
  END IF;
END $$;

UPDATE public.parts p
SET part_number = public.part_item_of(bp.part_number, bp.description, bp.supplier),
    name = public.part_desc_of(bp.part_number, bp.description, bp.supplier,
           public.part_item_of(bp.part_number, bp.description, bp.supplier)),
    retail = COALESCE(p.retail, bp.sell_price, bp.cost)
FROM public.booking_parts bp
WHERE p.booking_part_id = bp.id;