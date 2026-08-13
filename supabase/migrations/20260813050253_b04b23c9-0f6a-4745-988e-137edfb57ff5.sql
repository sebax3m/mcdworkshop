ALTER TABLE public.loan_bikes
  ADD COLUMN IF NOT EXISTS rego_expiry date,
  ADD COLUMN IF NOT EXISTS wof_expiry date;