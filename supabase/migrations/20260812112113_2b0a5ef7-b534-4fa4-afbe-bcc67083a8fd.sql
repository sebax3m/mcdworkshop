CREATE OR REPLACE FUNCTION public.garage_tech_coverage(p_model_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'total', count(*),
    'verified', count(*) FILTER (WHERE verification <> 'unverified'),
    'unverified', count(*) FILTER (WHERE verification = 'unverified'),
    'needs_review', count(*) FILTER (WHERE review_status <> 'ok'),
    'missing_source', count(*) FILTER (WHERE source_name IS NULL OR source_name = '')
  )
  FROM public.garage_tech_specs
  WHERE model_id = p_model_id AND is_archived = false;
$$;
REVOKE ALL ON FUNCTION public.garage_tech_coverage(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.garage_tech_coverage(uuid) TO authenticated, service_role;