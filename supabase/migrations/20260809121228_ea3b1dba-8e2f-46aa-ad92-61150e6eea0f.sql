CREATE OR REPLACE FUNCTION public.merge_motorcycles(p_keep_id uuid, p_merge_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  n_book int; n_job int; n_inv int; n_dyno int; n_claim int;
  k public.motorcycles%ROWTYPE;
  m public.motorcycles%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF NOT private.has_role(auth.uid(), 'admin') THEN
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

  -- fill gaps on the kept record from the merged one
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

REVOKE ALL ON FUNCTION public.merge_motorcycles(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merge_motorcycles(uuid, uuid) TO authenticated;