CREATE OR REPLACE FUNCTION public.release_loan_bike_on_job_completed()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF lower(coalesce(NEW.status::text, '')) = 'completed'
     AND lower(coalesce(OLD.status::text, '')) <> 'completed' THEN
    UPDATE public.bookings
       SET loan_bike_returned_at = now()
     WHERE job_id = NEW.id
       AND loan_bike_id IS NOT NULL
       AND loan_bike_returned_at IS NULL;
  END IF;
  RETURN NEW;
END;
$function$;