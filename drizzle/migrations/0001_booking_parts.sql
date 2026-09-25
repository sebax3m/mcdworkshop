ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS parts_required boolean NOT NULL DEFAULT false;

CREATE TABLE public.booking_parts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  description text NOT NULL DEFAULT '',
  part_number text,
  qty_required numeric NOT NULL DEFAULT 1,
  qty_received numeric NOT NULL DEFAULT 0,
  supplier text,
  order_ref text,
  ordered_at date,
  eta date,
  received_at date,
  status text NOT NULL DEFAULT 'needs_ordering',
  notes text,
  sort_order int NOT NULL DEFAULT 0,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT booking_parts_status_chk CHECK (status IN ('needs_ordering','ordered','partially_received','arrived','backordered','cancelled'))
);
CREATE INDEX booking_parts_booking_idx ON public.booking_parts(booking_id);
CREATE INDEX booking_parts_status_idx ON public.booking_parts(status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.booking_parts TO authenticated;
GRANT ALL ON public.booking_parts TO service_role;
ALTER TABLE public.booking_parts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read booking parts" ON public.booking_parts FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Staff add booking parts" ON public.booking_parts FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Staff edit booking parts" ON public.booking_parts FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Staff delete booking parts" ON public.booking_parts FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE TRIGGER booking_parts_touch BEFORE UPDATE ON public.booking_parts FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.booking_parts (booking_id, description, supplier, order_ref, ordered_at, status, created_by)
SELECT booking_id, parts, supplier, order_number, ordered_at::date, 'ordered', ordered_by FROM public.booking_part_orders;
UPDATE public.bookings SET parts_required = true WHERE id IN (SELECT booking_id FROM public.booking_part_orders);
COMMENT ON TABLE public.booking_part_orders IS 'DEPRECATED: replaced by booking_parts';