CREATE TABLE IF NOT EXISTS public.job_invoice_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL UNIQUE REFERENCES public.jobs(id) ON DELETE CASCADE,
  lines jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  customer_report text,
  report_generated_at timestamptz,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_invoice_drafts TO authenticated;
GRANT ALL ON public.job_invoice_drafts TO service_role;

ALTER TABLE public.job_invoice_drafts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can read invoice drafts" ON public.job_invoice_drafts;
CREATE POLICY "Staff can read invoice drafts" ON public.job_invoice_drafts
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Staff can create invoice drafts" ON public.job_invoice_drafts;
CREATE POLICY "Staff can create invoice drafts" ON public.job_invoice_drafts
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Staff can update invoice drafts" ON public.job_invoice_drafts;
CREATE POLICY "Staff can update invoice drafts" ON public.job_invoice_drafts
  FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Admins can delete invoice drafts" ON public.job_invoice_drafts;
CREATE POLICY "Admins can delete invoice drafts" ON public.job_invoice_drafts
  FOR DELETE TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE OR REPLACE FUNCTION public.touch_job_invoice_draft()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS job_invoice_drafts_updated_at ON public.job_invoice_drafts;
CREATE TRIGGER job_invoice_drafts_updated_at
  BEFORE UPDATE ON public.job_invoice_drafts
  FOR EACH ROW EXECUTE FUNCTION public.touch_job_invoice_draft();

ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS customer_report text;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS customer_report_at timestamptz;