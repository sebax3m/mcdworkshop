CREATE TABLE public.invoice_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  method text NOT NULL DEFAULT 'cash',
  paid_on date NOT NULL DEFAULT CURRENT_DATE,
  reference text,
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoice_payments TO authenticated;
GRANT ALL ON public.invoice_payments TO service_role;

ALTER TABLE public.invoice_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view payments" ON public.invoice_payments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff can add payments" ON public.invoice_payments FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Staff can update payments" ON public.invoice_payments FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Staff can delete payments" ON public.invoice_payments FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

CREATE INDEX invoice_payments_invoice_idx ON public.invoice_payments(invoice_id);

CREATE OR REPLACE FUNCTION public.sync_invoice_payment_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_invoice uuid; v_paid numeric; v_total numeric; v_last date;
BEGIN
  v_invoice := COALESCE(NEW.invoice_id, OLD.invoice_id);
  SELECT COALESCE(sum(amount),0), max(paid_on) INTO v_paid, v_last
    FROM public.invoice_payments WHERE invoice_id = v_invoice;
  SELECT total INTO v_total FROM public.invoices WHERE id = v_invoice;
  UPDATE public.invoices
     SET paid_amount = v_paid,
         paid_on = CASE WHEN v_paid >= COALESCE(v_total,0) AND v_paid > 0 THEN v_last ELSE NULL END,
         status = CASE
           WHEN v_paid <= 0 THEN 'unpaid'
           WHEN v_paid >= COALESCE(v_total,0) THEN 'paid'
           ELSE 'part_paid' END
   WHERE id = v_invoice;
  RETURN NULL;
END; $$;

CREATE TRIGGER invoice_payments_sync
AFTER INSERT OR UPDATE OR DELETE ON public.invoice_payments
FOR EACH ROW EXECUTE FUNCTION public.sync_invoice_payment_status();

UPDATE public.invoices SET status = 'unpaid' WHERE lower(status) = 'draft';
ALTER TABLE public.invoices ALTER COLUMN status SET DEFAULT 'unpaid';