ALTER TABLE public.parts ADD COLUMN IF NOT EXISTS booking_part_id uuid REFERENCES public.booking_parts(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS parts_booking_part_id_uniq ON public.parts(booking_part_id) WHERE booking_part_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.sync_booking_part_to_job(p_bp_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE bp record; v_job uuid;
BEGIN
  SELECT * INTO bp FROM booking_parts WHERE id = p_bp_id;
  IF bp.id IS NULL OR bp.booking_id IS NULL THEN RETURN; END IF;
  SELECT job_id INTO v_job FROM bookings WHERE id = bp.booking_id;
  IF v_job IS NULL THEN RETURN; END IF;
  IF bp.status IN ('arrived','partially_received') THEN
    INSERT INTO parts (job_id, part_number, name, quantity, supplier, cost, retail, on_invoice, booking_part_id, added_by)
    VALUES (v_job, bp.description, COALESCE(NULLIF(bp.part_number,''), bp.description),
            COALESCE(NULLIF(bp.qty_received,0), bp.qty_required, 1), bp.supplier,
            bp.cost, bp.sell_price, true, bp.id, bp.created_by)
    ON CONFLICT (booking_part_id) WHERE booking_part_id IS NOT NULL DO UPDATE
      SET part_number = EXCLUDED.part_number, name = EXCLUDED.name, quantity = EXCLUDED.quantity,
          supplier = EXCLUDED.supplier,
          cost = COALESCE(EXCLUDED.cost, parts.cost), retail = COALESCE(EXCLUDED.retail, parts.retail);
  ELSIF bp.status = 'cancelled' THEN
    DELETE FROM parts WHERE booking_part_id = bp.id;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.trg_booking_parts_sync_job()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN PERFORM public.sync_booking_part_to_job(NEW.id); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS booking_parts_sync_job ON public.booking_parts;
CREATE TRIGGER booking_parts_sync_job AFTER INSERT OR UPDATE ON public.booking_parts
FOR EACH ROW EXECUTE FUNCTION public.trg_booking_parts_sync_job();

CREATE OR REPLACE FUNCTION public.trg_bookings_job_link_parts()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record;
BEGIN
  IF NEW.job_id IS NOT NULL AND NEW.job_id IS DISTINCT FROM OLD.job_id THEN
    FOR r IN SELECT id FROM booking_parts WHERE booking_id = NEW.id LOOP
      PERFORM public.sync_booking_part_to_job(r.id);
    END LOOP;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS bookings_job_link_parts ON public.bookings;
CREATE TRIGGER bookings_job_link_parts AFTER INSERT OR UPDATE OF job_id ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.trg_bookings_job_link_parts();

SELECT public.sync_booking_part_to_job(bp.id) FROM public.booking_parts bp
JOIN public.bookings b ON b.id = bp.booking_id WHERE b.job_id IS NOT NULL;