ALTER TABLE public.insurance_claims
  ADD COLUMN IF NOT EXISTS quote_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS quote_labour_rate numeric;