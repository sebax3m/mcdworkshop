
-- Loan bikes catalog
CREATE TABLE public.loan_bikes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  make text,
  model text,
  year integer,
  color text,
  rego text,
  current_km integer NOT NULL DEFAULT 0,
  service_interval_km integer NOT NULL DEFAULT 5000,
  last_service_km integer,
  last_service_date date,
  next_service_due_km integer,
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.loan_bikes TO authenticated;
GRANT ALL ON public.loan_bikes TO service_role;
ALTER TABLE public.loan_bikes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read loan_bikes" ON public.loan_bikes FOR SELECT TO authenticated USING (private.is_staff(auth.uid()));
CREATE POLICY "staff write loan_bikes" ON public.loan_bikes FOR ALL TO authenticated USING (private.is_staff(auth.uid())) WITH CHECK (private.is_staff(auth.uid()));
CREATE TRIGGER trg_loan_bikes_updated BEFORE UPDATE ON public.loan_bikes FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Service log
CREATE TABLE public.loan_bike_service_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_bike_id uuid NOT NULL REFERENCES public.loan_bikes(id) ON DELETE CASCADE,
  service_date date NOT NULL DEFAULT CURRENT_DATE,
  km integer,
  description text NOT NULL,
  cost numeric(10,2),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.loan_bike_service_logs TO authenticated;
GRANT ALL ON public.loan_bike_service_logs TO service_role;
ALTER TABLE public.loan_bike_service_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read loan_bike_service_logs" ON public.loan_bike_service_logs FOR SELECT TO authenticated USING (private.is_staff(auth.uid()));
CREATE POLICY "staff write loan_bike_service_logs" ON public.loan_bike_service_logs FOR ALL TO authenticated USING (private.is_staff(auth.uid())) WITH CHECK (private.is_staff(auth.uid()));

-- Notes
CREATE TABLE public.loan_bike_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_bike_id uuid NOT NULL REFERENCES public.loan_bikes(id) ON DELETE CASCADE,
  note text NOT NULL,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.loan_bike_notes TO authenticated;
GRANT ALL ON public.loan_bike_notes TO service_role;
ALTER TABLE public.loan_bike_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read loan_bike_notes" ON public.loan_bike_notes FOR SELECT TO authenticated USING (private.is_staff(auth.uid()));
CREATE POLICY "staff write loan_bike_notes" ON public.loan_bike_notes FOR ALL TO authenticated USING (private.is_staff(auth.uid())) WITH CHECK (private.is_staff(auth.uid()));

-- Link bookings to a specific loan bike + expected return
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS loan_bike_id uuid REFERENCES public.loan_bikes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS loan_bike_expected_return date,
  ADD COLUMN IF NOT EXISTS loan_bike_start_km integer,
  ADD COLUMN IF NOT EXISTS loan_bike_end_km integer,
  ADD COLUMN IF NOT EXISTS loan_bike_returned_at timestamptz;

CREATE INDEX IF NOT EXISTS bookings_loan_bike_id_idx ON public.bookings(loan_bike_id);

-- Seed the 3 current loan bikes
INSERT INTO public.loan_bikes (name, make, model, year, color) VALUES
  ('Yamaha MT-07', 'Yamaha', 'MT-07', NULL, NULL),
  ('Suzuki Inazuma 250 (Black)', 'Suzuki', 'Inazuma 250', NULL, 'Black'),
  ('Suzuki Inazuma 250 (Red)', 'Suzuki', 'Inazuma 250', NULL, 'Red');
