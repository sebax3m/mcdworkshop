
SET session_replication_role = replica;

CREATE TEMP TABLE bad_customers AS
SELECT id FROM public.customers
WHERE NOT (
    first_name ~ '^[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ''\.\- ]{0,40}$'
    AND last_name  ~ '^[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ''\.\- ]{0,40}$'
    AND regexp_replace(coalesce(phone,''),'[^0-9+]','','g') ~ '^(\+?64|0)[0-9]{8,10}$'
);

CREATE TEMP TABLE bad_motos AS
SELECT id FROM public.motorcycles
WHERE year IS NULL OR coalesce(make,'') = '' OR coalesce(model,'') = '';

INSERT INTO bad_motos
SELECT m.id FROM public.motorcycles m
JOIN bad_customers bc ON bc.id = m.customer_id
WHERE m.id NOT IN (SELECT id FROM bad_motos);

CREATE TEMP TABLE bad_jobs AS
SELECT id FROM public.jobs
WHERE customer_id IN (SELECT id FROM bad_customers)
   OR motorcycle_id IN (SELECT id FROM bad_motos);

CREATE TEMP TABLE bad_invoices AS
SELECT id FROM public.invoices
WHERE customer_id IN (SELECT id FROM bad_customers)
   OR job_id IN (SELECT id FROM bad_jobs);

DELETE FROM public.job_tasks    WHERE job_id IN (SELECT id FROM bad_jobs);
DELETE FROM public.job_notes    WHERE job_id IN (SELECT id FROM bad_jobs);
DELETE FROM public.job_photos   WHERE job_id IN (SELECT id FROM bad_jobs);
DELETE FROM public.time_entries WHERE job_id IN (SELECT id FROM bad_jobs);

DELETE FROM public.insurance_claim_events
WHERE claim_id IN (
  SELECT id FROM public.insurance_claims
  WHERE customer_id IN (SELECT id FROM bad_customers)
     OR motorcycle_id IN (SELECT id FROM bad_motos)
);

DELETE FROM public.insurance_claims
WHERE customer_id IN (SELECT id FROM bad_customers)
   OR motorcycle_id IN (SELECT id FROM bad_motos);

DELETE FROM public.dyno_results
WHERE motorcycle_id IN (SELECT id FROM bad_motos)
   OR job_id IN (SELECT id FROM bad_jobs);

DELETE FROM public.bookings
WHERE customer_id IN (SELECT id FROM bad_customers)
   OR motorcycle_id IN (SELECT id FROM bad_motos)
   OR job_id IN (SELECT id FROM bad_jobs);

DELETE FROM public.invoices    WHERE id IN (SELECT id FROM bad_invoices);
DELETE FROM public.jobs        WHERE id IN (SELECT id FROM bad_jobs);
DELETE FROM public.motorcycles WHERE id IN (SELECT id FROM bad_motos);
DELETE FROM public.customers   WHERE id IN (SELECT id FROM bad_customers);

SET session_replication_role = DEFAULT;
