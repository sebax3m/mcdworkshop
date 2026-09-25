CREATE TABLE public.booking_part_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  parts text NOT NULL,
  supplier text NOT NULL,
  order_number text,
  notes text,
  ordered_at timestamptz NOT NULL DEFAULT now(),
  ordered_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.booking_part_orders(booking_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.booking_part_orders TO authenticated;
GRANT ALL ON public.booking_part_orders TO service_role;
ALTER TABLE public.booking_part_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read part orders" ON public.booking_part_orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff add part orders" ON public.booking_part_orders FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Staff edit part orders" ON public.booking_part_orders FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Staff delete part orders" ON public.booking_part_orders FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);