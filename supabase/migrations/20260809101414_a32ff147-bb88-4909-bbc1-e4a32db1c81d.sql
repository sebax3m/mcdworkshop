
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false;
ALTER TABLE public.motorcycles ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_customers_is_archived ON public.customers(is_archived);
CREATE INDEX IF NOT EXISTS idx_motorcycles_is_archived ON public.motorcycles(is_archived);
CREATE INDEX IF NOT EXISTS idx_customers_phone_norm ON public.customers ((regexp_replace(coalesce(phone,''), '[^0-9]', '', 'g')));
CREATE INDEX IF NOT EXISTS idx_motorcycles_rego_norm ON public.motorcycles ((upper(regexp_replace(coalesce(rego,''), '[^A-Za-z0-9]', '', 'g'))));
CREATE INDEX IF NOT EXISTS idx_motorcycles_vin_norm ON public.motorcycles ((upper(regexp_replace(coalesce(vin,''), '[^A-Za-z0-9]', '', 'g'))));

CREATE OR REPLACE FUNCTION public.customer_reference_counts(p_customer_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'motorcycles', (SELECT count(*) FROM public.motorcycles WHERE customer_id = p_customer_id),
    'bookings',    (SELECT count(*) FROM public.bookings WHERE customer_id = p_customer_id),
    'jobs',        (SELECT count(*) FROM public.jobs WHERE customer_id = p_customer_id),
    'invoices',    (SELECT count(*) FROM public.invoices WHERE customer_id = p_customer_id),
    'insurance_claims', (SELECT count(*) FROM public.insurance_claims WHERE customer_id = p_customer_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.motorcycle_reference_counts(p_motorcycle_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'bookings',    (SELECT count(*) FROM public.bookings WHERE motorcycle_id = p_motorcycle_id),
    'jobs',        (SELECT count(*) FROM public.jobs WHERE motorcycle_id = p_motorcycle_id),
    'invoices',    (SELECT count(*) FROM public.invoices WHERE motorcycle_id = p_motorcycle_id),
    'dyno_results',(SELECT count(*) FROM public.dyno_results WHERE motorcycle_id = p_motorcycle_id),
    'insurance_claims', (SELECT count(*) FROM public.insurance_claims WHERE motorcycle_id = p_motorcycle_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.merge_customers(p_keep_id uuid, p_merge_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  moved jsonb;
  n_moto int; n_book int; n_job int; n_inv int; n_claim int;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can merge customers';
  END IF;
  IF p_keep_id IS NULL OR p_merge_id IS NULL OR p_keep_id = p_merge_id THEN
    RAISE EXCEPTION 'Invalid merge parameters';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.customers WHERE id = p_keep_id) THEN
    RAISE EXCEPTION 'Customer to keep not found';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.customers WHERE id = p_merge_id) THEN
    RAISE EXCEPTION 'Customer to merge not found';
  END IF;

  UPDATE public.motorcycles SET customer_id = p_keep_id WHERE customer_id = p_merge_id;
  GET DIAGNOSTICS n_moto = ROW_COUNT;
  UPDATE public.bookings SET customer_id = p_keep_id WHERE customer_id = p_merge_id;
  GET DIAGNOSTICS n_book = ROW_COUNT;
  UPDATE public.jobs SET customer_id = p_keep_id WHERE customer_id = p_merge_id;
  GET DIAGNOSTICS n_job = ROW_COUNT;
  UPDATE public.invoices SET customer_id = p_keep_id WHERE customer_id = p_merge_id;
  GET DIAGNOSTICS n_inv = ROW_COUNT;
  UPDATE public.insurance_claims SET customer_id = p_keep_id WHERE customer_id = p_merge_id;
  GET DIAGNOSTICS n_claim = ROW_COUNT;

  DELETE FROM public.customers WHERE id = p_merge_id;

  moved := jsonb_build_object(
    'motorcycles', n_moto, 'bookings', n_book, 'jobs', n_job,
    'invoices', n_inv, 'insurance_claims', n_claim
  );
  RETURN jsonb_build_object('ok', true, 'kept', p_keep_id, 'merged', p_merge_id, 'moved', moved);
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_customer_safe(p_customer_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE c jsonb; total int;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can permanently delete customers';
  END IF;
  c := public.customer_reference_counts(p_customer_id);
  SELECT coalesce(sum(value::int),0) INTO total FROM jsonb_each_text(c);
  IF total > 0 THEN
    RAISE EXCEPTION 'Cannot permanently delete: customer has linked history (%)', c::text;
  END IF;
  DELETE FROM public.customers WHERE id = p_customer_id;
  RETURN jsonb_build_object('ok', true, 'deleted', p_customer_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_motorcycle_safe(p_motorcycle_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE c jsonb; total int;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can permanently delete motorcycles';
  END IF;
  c := public.motorcycle_reference_counts(p_motorcycle_id);
  SELECT coalesce(sum(value::int),0) INTO total FROM jsonb_each_text(c);
  IF total > 0 THEN
    RAISE EXCEPTION 'Cannot permanently delete: motorcycle has linked history (%)', c::text;
  END IF;
  DELETE FROM public.motorcycles WHERE id = p_motorcycle_id;
  RETURN jsonb_build_object('ok', true, 'deleted', p_motorcycle_id);
END;
$$;

REVOKE ALL ON FUNCTION public.merge_customers(uuid, uuid) FROM public, anon;
REVOKE ALL ON FUNCTION public.delete_customer_safe(uuid) FROM public, anon;
REVOKE ALL ON FUNCTION public.delete_motorcycle_safe(uuid) FROM public, anon;
REVOKE ALL ON FUNCTION public.customer_reference_counts(uuid) FROM public, anon;
REVOKE ALL ON FUNCTION public.motorcycle_reference_counts(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.merge_customers(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_customer_safe(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_motorcycle_safe(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.customer_reference_counts(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.motorcycle_reference_counts(uuid) TO authenticated;
