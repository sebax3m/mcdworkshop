
DO $$
DECLARE
  placeholder_customer uuid;
  placeholder_moto uuid;
BEGIN
  SELECT id INTO placeholder_customer FROM public.customers WHERE first_name='Unknown' AND last_name='Customer' LIMIT 1;
  IF placeholder_customer IS NULL THEN
    INSERT INTO public.customers (first_name, last_name) VALUES ('Unknown','Customer') RETURNING id INTO placeholder_customer;
  END IF;

  SELECT id INTO placeholder_moto FROM public.motorcycles WHERE make='Unknown' AND model='-' LIMIT 1;
  IF placeholder_moto IS NULL THEN
    INSERT INTO public.motorcycles (customer_id, make, model) VALUES (placeholder_customer,'Unknown','-') RETURNING id INTO placeholder_moto;
  END IF;

  -- Reassign references from bikes we're about to delete
  UPDATE public.bookings SET motorcycle_id = placeholder_moto
    WHERE motorcycle_id IN (SELECT id FROM public.motorcycles WHERE id<>placeholder_moto AND (make IS NULL OR make='' OR model IS NULL OR model='' OR year IS NULL));
  UPDATE public.jobs SET motorcycle_id = placeholder_moto
    WHERE motorcycle_id IN (SELECT id FROM public.motorcycles WHERE id<>placeholder_moto AND (make IS NULL OR make='' OR model IS NULL OR model='' OR year IS NULL));
  UPDATE public.invoices SET motorcycle_id = placeholder_moto
    WHERE motorcycle_id IN (SELECT id FROM public.motorcycles WHERE id<>placeholder_moto AND (make IS NULL OR make='' OR model IS NULL OR model='' OR year IS NULL));
  UPDATE public.insurance_claims SET motorcycle_id = placeholder_moto
    WHERE motorcycle_id IN (SELECT id FROM public.motorcycles WHERE id<>placeholder_moto AND (make IS NULL OR make='' OR model IS NULL OR model='' OR year IS NULL));
  UPDATE public.dyno_results SET motorcycle_id = placeholder_moto
    WHERE motorcycle_id IN (SELECT id FROM public.motorcycles WHERE id<>placeholder_moto AND (make IS NULL OR make='' OR model IS NULL OR model='' OR year IS NULL));

  DELETE FROM public.motorcycles
    WHERE id<>placeholder_moto
      AND (make IS NULL OR make='' OR model IS NULL OR model='' OR year IS NULL);
END $$;
