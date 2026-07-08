
UPDATE public.customers
SET last_name = NULL
WHERE last_name IS NOT NULL
  AND trim(last_name) ~ '^[0-9 +().\-]+$';
