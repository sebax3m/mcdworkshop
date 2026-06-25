
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS invoice_date date NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS due_date date,
  ADD COLUMN IF NOT EXISTS subtotal_excl_gst numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paid_amount numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paid_on date,
  ADD COLUMN IF NOT EXISTS xero_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS customer_name_snapshot text,
  ADD COLUMN IF NOT EXISTS bike_snapshot text;

-- Backfill subtotal_excl_gst for existing rows where total > 0 (NZ 15% GST)
UPDATE public.invoices
   SET subtotal_excl_gst = ROUND(total / 1.15, 2),
       gst = ROUND(total - (total / 1.15), 2)
 WHERE subtotal_excl_gst = 0 AND total > 0;

CREATE INDEX IF NOT EXISTS invoices_invoice_date_idx ON public.invoices(invoice_date);
CREATE INDEX IF NOT EXISTS invoices_paid_on_idx ON public.invoices(paid_on);
