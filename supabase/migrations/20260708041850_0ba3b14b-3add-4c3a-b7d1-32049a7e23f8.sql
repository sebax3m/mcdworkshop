
BEGIN;

-- Ensure placeholder exists
DO $$
DECLARE ph_c uuid; ph_m uuid; seed uuid;
BEGIN
  SELECT id INTO ph_c FROM public.customers WHERE first_name='Unknown' AND last_name='Customer' LIMIT 1;
  IF ph_c IS NULL THEN
    seed := (SELECT created_by FROM public.customers WHERE created_by IS NOT NULL LIMIT 1);
    ph_c := gen_random_uuid();
    INSERT INTO public.customers(id,first_name,last_name,created_by) VALUES (ph_c,'Unknown','Customer',seed);
  END IF;
  SELECT id INTO ph_m FROM public.motorcycles WHERE customer_id=ph_c AND make='Unknown' LIMIT 1;
  IF ph_m IS NULL THEN
    ph_m := gen_random_uuid();
    INSERT INTO public.motorcycles(id,customer_id,make,model) VALUES (ph_m,ph_c,'Unknown','-');
  END IF;
END $$;

-- Customers to drop
CREATE TEMP TABLE _drop_c ON COMMIT DROP AS
SELECT id FROM public.customers
WHERE NOT (first_name IS NOT NULL AND first_name<>'' AND first_name<>'Unknown'
           AND phone IS NOT NULL AND phone<>'')
  AND NOT (first_name='Unknown' AND last_name='Customer');  -- keep the placeholder itself

CREATE TEMP TABLE _ph ON COMMIT DROP AS
SELECT
  (SELECT id FROM public.customers WHERE first_name='Unknown' AND last_name='Customer' LIMIT 1) AS cust_id,
  (SELECT m.id FROM public.motorcycles m JOIN public.customers c ON c.id=m.customer_id
    WHERE c.first_name='Unknown' AND c.last_name='Customer' AND m.make='Unknown' LIMIT 1) AS moto_id;

-- Motos of dropped customers → we'll delete; first move FKs referencing those motos
CREATE TEMP TABLE _drop_m ON COMMIT DROP AS
SELECT id FROM public.motorcycles
WHERE customer_id IN (SELECT id FROM _drop_c)
   OR id IN (
     SELECT m.id FROM public.motorcycles m
     WHERE customer_id NOT IN (SELECT id FROM public.customers)
   );

-- Reassign FKs on bookings/jobs/invoices/insurance_claims/dyno_results
UPDATE public.bookings SET customer_id=(SELECT cust_id FROM _ph) WHERE customer_id IN (SELECT id FROM _drop_c);
UPDATE public.bookings SET motorcycle_id=(SELECT moto_id FROM _ph) WHERE motorcycle_id IN (SELECT id FROM _drop_m);

UPDATE public.jobs SET customer_id=(SELECT cust_id FROM _ph) WHERE customer_id IN (SELECT id FROM _drop_c);
UPDATE public.jobs SET motorcycle_id=(SELECT moto_id FROM _ph) WHERE motorcycle_id IN (SELECT id FROM _drop_m);

UPDATE public.invoices SET customer_id=(SELECT cust_id FROM _ph) WHERE customer_id IN (SELECT id FROM _drop_c);
UPDATE public.invoices SET motorcycle_id=(SELECT moto_id FROM _ph) WHERE motorcycle_id IN (SELECT id FROM _drop_m);

UPDATE public.insurance_claims SET customer_id=(SELECT cust_id FROM _ph) WHERE customer_id IN (SELECT id FROM _drop_c);
UPDATE public.insurance_claims SET motorcycle_id=(SELECT moto_id FROM _ph) WHERE motorcycle_id IN (SELECT id FROM _drop_m);

UPDATE public.dyno_results SET motorcycle_id=(SELECT moto_id FROM _ph) WHERE motorcycle_id IN (SELECT id FROM _drop_m);

DELETE FROM public.motorcycles WHERE id IN (SELECT id FROM _drop_m);
DELETE FROM public.motorcycles WHERE customer_id IN (SELECT id FROM _drop_c);
DELETE FROM public.customers   WHERE id IN (SELECT id FROM _drop_c);

COMMIT;
