
-- ===== EXTEND EXISTING TABLES =====
ALTER TABLE public.motorcycles
  ADD COLUMN IF NOT EXISTS vin TEXT,
  ADD COLUMN IF NOT EXISTS wof_expiry DATE,
  ADD COLUMN IF NOT EXISTS rego_expiry DATE,
  ADD COLUMN IF NOT EXISTS photos JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS modifications TEXT,
  ADD COLUMN IF NOT EXISTS tyre_condition TEXT,
  ADD COLUMN IF NOT EXISTS brake_condition TEXT,
  ADD COLUMN IF NOT EXISTS chain_condition TEXT;

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS assigned_tech_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS estimated_hours NUMERIC(6,2),
  ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS color TEXT;

-- ===== BOOKINGS =====
CREATE TABLE IF NOT EXISTS public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  motorcycle_id UUID NOT NULL REFERENCES public.motorcycles(id) ON DELETE CASCADE,
  service_template_id UUID REFERENCES public.service_templates(id) ON DELETE SET NULL,
  assigned_tech_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
  service_type TEXT NOT NULL,
  scheduled_date DATE NOT NULL,
  drop_off_time TIME,
  estimated_hours NUMERIC(6,2) DEFAULT 1,
  mileage INTEGER,
  wof_expiry DATE,
  rego TEXT,
  vin TEXT,
  complaints TEXT,
  notes TEXT,
  arrival_photos JSONB NOT NULL DEFAULT '[]'::jsonb,
  damage_photos JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'booked',
  color TEXT DEFAULT '#d4a017',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bookings TO authenticated;
GRANT ALL ON public.bookings TO service_role;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read bookings" ON public.bookings FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "staff write bookings" ON public.bookings FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE TRIGGER touch_bookings BEFORE UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX IF NOT EXISTS bookings_scheduled_date_idx ON public.bookings(scheduled_date);

-- ===== PARTS =====
CREATE TABLE IF NOT EXISTS public.parts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  quantity NUMERIC(8,2) NOT NULL DEFAULT 1,
  supplier TEXT,
  cost NUMERIC(10,2) DEFAULT 0,
  retail NUMERIC(10,2) DEFAULT 0,
  on_invoice BOOLEAN NOT NULL DEFAULT true,
  added_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.parts TO authenticated;
GRANT ALL ON public.parts TO service_role;
ALTER TABLE public.parts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read parts" ON public.parts FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "staff write parts" ON public.parts FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- ===== DYNO RESULTS =====
CREATE TABLE IF NOT EXISTS public.dyno_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  motorcycle_id UUID NOT NULL REFERENCES public.motorcycles(id) ON DELETE CASCADE,
  job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
  run_date DATE NOT NULL DEFAULT CURRENT_DATE,
  run_type TEXT NOT NULL DEFAULT 'baseline',
  max_power NUMERIC(8,2),
  max_torque NUMERIC(8,2),
  max_power_rpm INTEGER,
  max_torque_rpm INTEGER,
  notes TEXT,
  graph_url TEXT,
  before_url TEXT,
  after_url TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dyno_results TO authenticated;
GRANT ALL ON public.dyno_results TO service_role;
ALTER TABLE public.dyno_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read dyno" ON public.dyno_results FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "staff write dyno" ON public.dyno_results FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- ===== INVOICES =====
CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT NOT NULL UNIQUE,
  job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  motorcycle_id UUID REFERENCES public.motorcycles(id) ON DELETE SET NULL,
  labour_total NUMERIC(10,2) NOT NULL DEFAULT 0,
  parts_total NUMERIC(10,2) NOT NULL DEFAULT 0,
  gst NUMERIC(10,2) NOT NULL DEFAULT 0,
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  notes TEXT,
  snapshot JSONB,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read invoices" ON public.invoices FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "staff write invoices" ON public.invoices FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE TRIGGER touch_invoices BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Auto-generated invoice numbers
CREATE SEQUENCE IF NOT EXISTS public.invoice_number_seq START 1001;
CREATE OR REPLACE FUNCTION public.set_invoice_number()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.invoice_number IS NULL OR NEW.invoice_number = '' THEN
    NEW.invoice_number := 'APX-' || to_char(now(),'YYYY') || '-' || lpad(nextval('public.invoice_number_seq')::text, 5, '0');
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS set_invoice_number_trg ON public.invoices;
CREATE TRIGGER set_invoice_number_trg BEFORE INSERT ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.set_invoice_number();
