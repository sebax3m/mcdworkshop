
DO $$
DECLARE
  keep_id uuid;
  drop_id uuid;
BEGIN
  SELECT id INTO keep_id FROM public.customers
   WHERE phone='0274439425' AND lower(first_name)='sebastian'
   ORDER BY created_at ASC LIMIT 1;
  SELECT id INTO drop_id FROM public.customers
   WHERE phone='0274439425' AND lower(first_name)='sebastian' AND id<>keep_id
   ORDER BY created_at DESC LIMIT 1;

  IF keep_id IS NOT NULL AND drop_id IS NOT NULL THEN
    UPDATE public.motorcycles      SET customer_id = keep_id WHERE customer_id = drop_id;
    UPDATE public.bookings         SET customer_id = keep_id WHERE customer_id = drop_id;
    UPDATE public.jobs             SET customer_id = keep_id WHERE customer_id = drop_id;
    UPDATE public.invoices         SET customer_id = keep_id WHERE customer_id = drop_id;
    UPDATE public.insurance_claims SET customer_id = keep_id WHERE customer_id = drop_id;
    DELETE FROM public.customers WHERE id = drop_id;
  END IF;
END $$;
