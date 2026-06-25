CREATE OR REPLACE FUNCTION public.enforce_invoice_delete_rules()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can delete invoices';
  END IF;
  IF lower(coalesce(OLD.status, '')) <> 'draft' THEN
    RAISE EXCEPTION 'Only draft invoices can be deleted (this invoice is %)', OLD.status;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_invoice_delete_rules ON public.invoices;
CREATE TRIGGER trg_enforce_invoice_delete_rules
BEFORE DELETE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.enforce_invoice_delete_rules();