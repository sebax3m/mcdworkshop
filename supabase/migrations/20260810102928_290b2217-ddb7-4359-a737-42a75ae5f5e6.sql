-- Only the trusted server backend (service_role) may call these privileged helpers.
REVOKE EXECUTE ON FUNCTION public.delete_customer_safe(uuid) FROM authenticated, anon, public;
REVOKE EXECUTE ON FUNCTION public.delete_motorcycle_safe(uuid) FROM authenticated, anon, public;
REVOKE EXECUTE ON FUNCTION public.merge_customers(uuid, uuid) FROM authenticated, anon, public;
REVOKE EXECUTE ON FUNCTION public.merge_motorcycles(uuid, uuid) FROM authenticated, anon, public;

GRANT EXECUTE ON FUNCTION public.delete_customer_safe(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_motorcycle_safe(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.merge_customers(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.merge_motorcycles(uuid, uuid) TO service_role;

-- When invoked by the server backend there is no auth.uid(); the caller's admin
-- role is verified in the server function before the call. Keep the in-database
-- admin check for any session-based caller.
CREATE OR REPLACE FUNCTION public.delete_customer_safe(p_customer_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE c jsonb; total int;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT private.has_role(auth.uid(), 'admin') THEN
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
$function$;

CREATE OR REPLACE FUNCTION public.delete_motorcycle_safe(p_motorcycle_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE c jsonb; total int;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT private.has_role(auth.uid(), 'admin') THEN
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
$function$;

CREATE OR REPLACE FUNCTION public.merge_customers(p_keep_id uuid, p_merge_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  moved jsonb;
  n_moto int; n_book int; n_job int; n_inv int; n_claim int;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT private.has_role(auth.uid(), 'admin') THEN
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
$function$;

CREATE OR REPLACE FUNCTION public.merge_motorcycles(p_keep_id uuid, p_merge_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  n_book int; n_job int; n_inv int; n_dyno int; n_claim int;
  k public.motorcycles%ROWTYPE;
  m public.motorcycles%ROWTYPE;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT private.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can merge motorcycles';
  END IF;
  IF p_keep_id IS NULL OR p_merge_id IS NULL OR p_keep_id = p_merge_id THEN
    RAISE EXCEPTION 'Invalid merge parameters';
  END IF;

  SELECT * INTO k FROM public.motorcycles WHERE id = p_keep_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Motorcycle to keep not found'; END IF;
  SELECT * INTO m FROM public.motorcycles WHERE id = p_merge_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Motorcycle to merge not found'; END IF;

  UPDATE public.bookings SET motorcycle_id = p_keep_id WHERE motorcycle_id = p_merge_id;
  GET DIAGNOSTICS n_book = ROW_COUNT;
  UPDATE public.jobs SET motorcycle_id = p_keep_id WHERE motorcycle_id = p_merge_id;
  GET DIAGNOSTICS n_job = ROW_COUNT;
  UPDATE public.invoices SET motorcycle_id = p_keep_id WHERE motorcycle_id = p_merge_id;
  GET DIAGNOSTICS n_inv = ROW_COUNT;
  UPDATE public.dyno_results SET motorcycle_id = p_keep_id WHERE motorcycle_id = p_merge_id;
  GET DIAGNOSTICS n_dyno = ROW_COUNT;
  UPDATE public.insurance_claims SET motorcycle_id = p_keep_id WHERE motorcycle_id = p_merge_id;
  GET DIAGNOSTICS n_claim = ROW_COUNT;

  UPDATE public.motorcycles SET
    customer_id = COALESCE(k.customer_id, m.customer_id),
    year        = COALESCE(k.year, m.year),
    vin         = COALESCE(NULLIF(btrim(k.vin,''), ''), m.vin),
    rego        = COALESCE(NULLIF(btrim(k.rego,''), ''), m.rego),
    mileage     = GREATEST(COALESCE(k.mileage, 0), COALESCE(m.mileage, 0)),
    ecu_info    = COALESCE(NULLIF(btrim(k.ecu_info,''), ''), m.ecu_info),
    modifications = COALESCE(NULLIF(btrim(k.modifications,''), ''), m.modifications),
    notes       = COALESCE(NULLIF(btrim(k.notes,''), ''), m.notes),
    wof_expiry  = COALESCE(k.wof_expiry, m.wof_expiry),
    rego_expiry = COALESCE(k.rego_expiry, m.rego_expiry),
    photos      = CASE WHEN jsonb_array_length(COALESCE(k.photos,'[]'::jsonb)) > 0
                       THEN k.photos ELSE COALESCE(m.photos,'[]'::jsonb) END
  WHERE id = p_keep_id;

  DELETE FROM public.motorcycles WHERE id = p_merge_id;

  RETURN jsonb_build_object('ok', true, 'kept', p_keep_id, 'merged', p_merge_id,
    'moved', jsonb_build_object('bookings', n_book, 'jobs', n_job, 'invoices', n_inv,
      'dyno_results', n_dyno, 'insurance_claims', n_claim));
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.delete_customer_safe(uuid) FROM authenticated, anon, public;
REVOKE EXECUTE ON FUNCTION public.delete_motorcycle_safe(uuid) FROM authenticated, anon, public;
REVOKE EXECUTE ON FUNCTION public.merge_customers(uuid, uuid) FROM authenticated, anon, public;
REVOKE EXECUTE ON FUNCTION public.merge_motorcycles(uuid, uuid) FROM authenticated, anon, public;
GRANT EXECUTE ON FUNCTION public.delete_customer_safe(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_motorcycle_safe(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.merge_customers(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.merge_motorcycles(uuid, uuid) TO service_role;