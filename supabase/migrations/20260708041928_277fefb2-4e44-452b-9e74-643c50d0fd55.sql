
BEGIN;
CREATE TEMP TABLE _ph ON COMMIT DROP AS
SELECT
  (SELECT id FROM public.customers WHERE first_name='Unknown' AND last_name='Customer' LIMIT 1) AS cust_id,
  (SELECT m.id FROM public.motorcycles m JOIN public.customers c ON c.id=m.customer_id
    WHERE c.first_name='Unknown' AND c.last_name='Customer' AND m.make='Unknown' LIMIT 1) AS moto_id;

CREATE TEMP TABLE _drop_c ON COMMIT DROP AS
SELECT id FROM public.customers
WHERE first_name IS NULL OR first_name='' OR first_name='Unknown' OR phone IS NULL OR phone=''
  AND id <> (SELECT cust_id FROM _ph);
-- fix precedence:
DELETE FROM _drop_c WHERE id = (SELECT cust_id FROM _ph);

CREATE TEMP TABLE _drop_m ON COMMIT DROP AS
SELECT id FROM public.motorcycles WHERE customer_id IN (SELECT id FROM _drop_c);

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
DELETE FROM public.customers WHERE id IN (SELECT id FROM _drop_c);

COMMIT;
