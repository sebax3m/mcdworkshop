
BEGIN;

CREATE TEMP TABLE new_customers ON COMMIT DROP AS
SELECT gen_random_uuid() AS new_id, key, first_name, last_name, phone, email
FROM (
  SELECT DISTINCT ON (key)
    CASE WHEN telefono IS NOT NULL AND telefono<>'' THEN 'p:'||telefono
         WHEN cliente IS NOT NULL THEN 'n:'||lower(cliente)
         ELSE 'x:'||gen_random_uuid()::text END AS key,
    NULLIF(split_part(coalesce(cliente,''),' ',1),'') AS first_name,
    NULLIF(substring(cliente FROM position(' ' IN coalesce(cliente,'') )+1), '') AS last_name,
    telefono AS phone, email
  FROM public._import_stg
  ORDER BY key, email NULLS LAST
) t;

CREATE TEMP TABLE _seed_user ON COMMIT DROP AS
SELECT COALESCE(
  (SELECT created_by FROM public.customers WHERE created_by IS NOT NULL LIMIT 1),
  (SELECT id FROM auth.users LIMIT 1)) AS uid;

INSERT INTO public.customers (id, first_name, last_name, phone, email, created_by)
SELECT nc.new_id, COALESCE(NULLIF(nc.first_name,''),'Unknown'), nc.last_name, nc.phone, nc.email, (SELECT uid FROM _seed_user)
FROM new_customers nc;

CREATE TEMP TABLE _ph ON COMMIT DROP AS SELECT gen_random_uuid() AS cust_id, gen_random_uuid() AS moto_id;
INSERT INTO public.customers (id, first_name, last_name, created_by)
SELECT cust_id, 'Unknown', 'Customer', (SELECT uid FROM _seed_user) FROM _ph;
INSERT INTO public.motorcycles (id, customer_id, make, model)
SELECT moto_id, cust_id, 'Unknown', '-' FROM _ph;

CREATE TEMP TABLE new_motos ON COMMIT DROP AS
SELECT gen_random_uuid() AS new_id, nc.new_id AS customer_id, s.marca, s.modelo, s.anio, s.patente
FROM public._import_stg s
JOIN new_customers nc ON nc.key = CASE
  WHEN s.telefono IS NOT NULL AND s.telefono<>'' THEN 'p:'||s.telefono
  WHEN s.cliente  IS NOT NULL                    THEN 'n:'||lower(s.cliente)
  ELSE NULL END
WHERE s.marca IS NOT NULL OR s.modelo IS NOT NULL OR s.patente IS NOT NULL;

INSERT INTO public.motorcycles (id, customer_id, make, model, year, rego)
SELECT nm.new_id, nm.customer_id, COALESCE(nm.marca,'Unknown'), COALESCE(nm.modelo,'-'), nm.anio, nm.patente
FROM new_motos nm;

-- CTE-based relink per table (customer by phone, moto by rego)
-- Bookings
UPDATE public.bookings b SET customer_id = nc.new_id
FROM public.customers oc JOIN new_customers nc
  ON regexp_replace(coalesce(nc.phone,''),'\D','','g') = regexp_replace(coalesce(oc.phone,''),'\D','','g')
WHERE b.customer_id = oc.id AND oc.id NOT IN (SELECT new_id FROM new_customers)
  AND oc.id <> (SELECT cust_id FROM _ph)
  AND regexp_replace(coalesce(oc.phone,''),'\D','','g') <> '';
UPDATE public.bookings b SET motorcycle_id = nm.new_id
FROM public.motorcycles om JOIN new_motos nm
  ON upper(regexp_replace(coalesce(nm.patente,''),'\s','','g')) = upper(regexp_replace(coalesce(om.rego,''),'\s','','g'))
WHERE b.motorcycle_id = om.id AND om.id NOT IN (SELECT new_id FROM new_motos)
  AND om.id <> (SELECT moto_id FROM _ph) AND coalesce(om.rego,'')<>'';

-- Jobs
UPDATE public.jobs j SET customer_id = nc.new_id
FROM public.customers oc JOIN new_customers nc
  ON regexp_replace(coalesce(nc.phone,''),'\D','','g') = regexp_replace(coalesce(oc.phone,''),'\D','','g')
WHERE j.customer_id = oc.id AND oc.id NOT IN (SELECT new_id FROM new_customers)
  AND oc.id <> (SELECT cust_id FROM _ph)
  AND regexp_replace(coalesce(oc.phone,''),'\D','','g') <> '';
UPDATE public.jobs j SET motorcycle_id = nm.new_id
FROM public.motorcycles om JOIN new_motos nm
  ON upper(regexp_replace(coalesce(nm.patente,''),'\s','','g')) = upper(regexp_replace(coalesce(om.rego,''),'\s','','g'))
WHERE j.motorcycle_id = om.id AND om.id NOT IN (SELECT new_id FROM new_motos)
  AND om.id <> (SELECT moto_id FROM _ph) AND coalesce(om.rego,'')<>'';

-- Invoices
UPDATE public.invoices i SET customer_id = nc.new_id
FROM public.customers oc JOIN new_customers nc
  ON regexp_replace(coalesce(nc.phone,''),'\D','','g') = regexp_replace(coalesce(oc.phone,''),'\D','','g')
WHERE i.customer_id = oc.id AND oc.id NOT IN (SELECT new_id FROM new_customers)
  AND oc.id <> (SELECT cust_id FROM _ph)
  AND regexp_replace(coalesce(oc.phone,''),'\D','','g') <> '';
UPDATE public.invoices i SET motorcycle_id = nm.new_id
FROM public.motorcycles om JOIN new_motos nm
  ON upper(regexp_replace(coalesce(nm.patente,''),'\s','','g')) = upper(regexp_replace(coalesce(om.rego,''),'\s','','g'))
WHERE i.motorcycle_id = om.id AND om.id NOT IN (SELECT new_id FROM new_motos)
  AND om.id <> (SELECT moto_id FROM _ph) AND coalesce(om.rego,'')<>'';

-- Insurance claims
UPDATE public.insurance_claims ic SET customer_id = nc.new_id
FROM public.customers oc JOIN new_customers nc
  ON regexp_replace(coalesce(nc.phone,''),'\D','','g') = regexp_replace(coalesce(oc.phone,''),'\D','','g')
WHERE ic.customer_id = oc.id AND oc.id NOT IN (SELECT new_id FROM new_customers)
  AND oc.id <> (SELECT cust_id FROM _ph)
  AND regexp_replace(coalesce(oc.phone,''),'\D','','g') <> '';
UPDATE public.insurance_claims ic SET motorcycle_id = nm.new_id
FROM public.motorcycles om JOIN new_motos nm
  ON upper(regexp_replace(coalesce(nm.patente,''),'\s','','g')) = upper(regexp_replace(coalesce(om.rego,''),'\s','','g'))
WHERE ic.motorcycle_id = om.id AND om.id NOT IN (SELECT new_id FROM new_motos)
  AND om.id <> (SELECT moto_id FROM _ph) AND coalesce(om.rego,'')<>'';

-- Dyno results (motorcycle only)
UPDATE public.dyno_results d SET motorcycle_id = nm.new_id
FROM public.motorcycles om JOIN new_motos nm
  ON upper(regexp_replace(coalesce(nm.patente,''),'\s','','g')) = upper(regexp_replace(coalesce(om.rego,''),'\s','','g'))
WHERE d.motorcycle_id = om.id AND om.id NOT IN (SELECT new_id FROM new_motos)
  AND om.id <> (SELECT moto_id FROM _ph) AND coalesce(om.rego,'')<>'';

-- Assign remaining orphans to placeholder
UPDATE public.bookings SET customer_id=(SELECT cust_id FROM _ph)
  WHERE customer_id NOT IN (SELECT new_id FROM new_customers) AND customer_id <> (SELECT cust_id FROM _ph);
UPDATE public.bookings SET motorcycle_id=(SELECT moto_id FROM _ph)
  WHERE motorcycle_id NOT IN (SELECT new_id FROM new_motos) AND motorcycle_id <> (SELECT moto_id FROM _ph);
UPDATE public.jobs SET customer_id=(SELECT cust_id FROM _ph)
  WHERE customer_id NOT IN (SELECT new_id FROM new_customers) AND customer_id <> (SELECT cust_id FROM _ph);
UPDATE public.jobs SET motorcycle_id=(SELECT moto_id FROM _ph)
  WHERE motorcycle_id NOT IN (SELECT new_id FROM new_motos) AND motorcycle_id <> (SELECT moto_id FROM _ph);
UPDATE public.invoices SET customer_id=(SELECT cust_id FROM _ph)
  WHERE customer_id IS NOT NULL AND customer_id NOT IN (SELECT new_id FROM new_customers) AND customer_id <> (SELECT cust_id FROM _ph);
UPDATE public.invoices SET motorcycle_id=(SELECT moto_id FROM _ph)
  WHERE motorcycle_id IS NOT NULL AND motorcycle_id NOT IN (SELECT new_id FROM new_motos) AND motorcycle_id <> (SELECT moto_id FROM _ph);
UPDATE public.insurance_claims SET customer_id=(SELECT cust_id FROM _ph)
  WHERE customer_id IS NOT NULL AND customer_id NOT IN (SELECT new_id FROM new_customers) AND customer_id <> (SELECT cust_id FROM _ph);
UPDATE public.insurance_claims SET motorcycle_id=(SELECT moto_id FROM _ph)
  WHERE motorcycle_id IS NOT NULL AND motorcycle_id NOT IN (SELECT new_id FROM new_motos) AND motorcycle_id <> (SELECT moto_id FROM _ph);
UPDATE public.dyno_results SET motorcycle_id=(SELECT moto_id FROM _ph)
  WHERE motorcycle_id NOT IN (SELECT new_id FROM new_motos) AND motorcycle_id <> (SELECT moto_id FROM _ph);

DELETE FROM public.motorcycles WHERE id NOT IN (SELECT new_id FROM new_motos) AND id <> (SELECT moto_id FROM _ph);
DELETE FROM public.customers   WHERE id NOT IN (SELECT new_id FROM new_customers) AND id <> (SELECT cust_id FROM _ph);

DROP TABLE public._import_stg;

COMMIT;
