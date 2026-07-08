
-- Auto-release loan bike when invoice is paid or job is completed (customer collected)

CREATE OR REPLACE FUNCTION public.release_loan_bike_on_invoice_paid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF lower(coalesce(NEW.status,'')) = 'paid'
     AND lower(coalesce(OLD.status,'')) <> 'paid'
     AND NEW.job_id IS NOT NULL THEN
    UPDATE public.bookings
       SET loan_bike_returned_at = now()
     WHERE job_id = NEW.job_id
       AND loan_bike_id IS NOT NULL
       AND loan_bike_returned_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_release_loan_bike_on_invoice_paid ON public.invoices;
CREATE TRIGGER trg_release_loan_bike_on_invoice_paid
AFTER UPDATE OF status ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.release_loan_bike_on_invoice_paid();

CREATE OR REPLACE FUNCTION public.release_loan_bike_on_job_completed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF lower(coalesce(NEW.status,'')) = 'completed'
     AND lower(coalesce(OLD.status,'')) <> 'completed' THEN
    UPDATE public.bookings
       SET loan_bike_returned_at = now()
     WHERE job_id = NEW.id
       AND loan_bike_id IS NOT NULL
       AND loan_bike_returned_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_release_loan_bike_on_job_completed ON public.jobs;
CREATE TRIGGER trg_release_loan_bike_on_job_completed
AFTER UPDATE OF status ON public.jobs
FOR EACH ROW EXECUTE FUNCTION public.release_loan_bike_on_job_completed();
