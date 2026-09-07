ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS insurer_name text,
  ADD COLUMN IF NOT EXISTS insurer_claim_ref text,
  ADD COLUMN IF NOT EXISTS is_insurance boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_invoices_insurance ON public.invoices(is_insurance) WHERE is_insurance = true;