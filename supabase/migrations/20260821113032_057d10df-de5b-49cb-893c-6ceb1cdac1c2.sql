CREATE TABLE IF NOT EXISTS public.labour_rate_defaults (
  service_type TEXT PRIMARY KEY,
  rate NUMERIC NOT NULL CHECK (rate >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.labour_rate_defaults TO authenticated;
GRANT ALL ON public.labour_rate_defaults TO service_role;
ALTER TABLE public.labour_rate_defaults ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staff read labour rates" ON public.labour_rate_defaults;
DROP POLICY IF EXISTS "staff write labour rates" ON public.labour_rate_defaults;
CREATE POLICY "staff read labour rates" ON public.labour_rate_defaults FOR SELECT TO authenticated USING (private.is_staff(auth.uid()));
CREATE POLICY "staff write labour rates" ON public.labour_rate_defaults FOR ALL TO authenticated USING (private.is_staff(auth.uid())) WITH CHECK (private.is_staff(auth.uid()));