CREATE TABLE public.booking_part_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  motorcycle_id uuid REFERENCES public.motorcycles(id) ON DELETE SET NULL,
  description text NOT NULL,
  part_number text,
  qty_required integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'suggested',
  source text NOT NULL DEFAULT 'manual',
  booking_part_id uuid REFERENCES public.booking_parts(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT booking_part_requirements_status_chk CHECK (status IN ('suggested','check_first','required','to_order','in_stock','ordered')),
  CONSTRAINT booking_part_requirements_source_chk CHECK (source IN ('service_template','instructions','manual','history'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.booking_part_requirements TO authenticated;
GRANT ALL ON public.booking_part_requirements TO service_role;

ALTER TABLE public.booking_part_requirements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage booking part requirements"
  ON public.booking_part_requirements
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE INDEX booking_part_requirements_booking_idx ON public.booking_part_requirements(booking_id);
CREATE INDEX booking_part_requirements_open_idx ON public.booking_part_requirements(booking_id) WHERE booking_part_id IS NULL;

CREATE TRIGGER trg_booking_part_requirements_updated_at
  BEFORE UPDATE ON public.booking_part_requirements
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();