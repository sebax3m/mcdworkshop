CREATE TABLE public.garage_tech_specs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id uuid NOT NULL REFERENCES public.bike_library_models(id) ON DELETE CASCADE,
  category text NOT NULL,
  subject text NOT NULL DEFAULT '',
  field text NOT NULL,
  value_text text,
  value_num numeric,
  unit text,
  notes text,
  source_type text NOT NULL DEFAULT 'manual_entry',
  source_name text,
  source_ref text,
  source_date date,
  verification text NOT NULL DEFAULT 'unverified' CHECK (verification IN ('unverified','workshop_verified','manufacturer_verified','supplier_verified')),
  verified_by uuid,
  verified_at timestamptz,
  is_alternative boolean NOT NULL DEFAULT false,
  review_status text NOT NULL DEFAULT 'ok' CHECK (review_status IN ('ok','needs_review','new_import')),
  import_batch text,
  is_archived boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

CREATE UNIQUE INDEX garage_tech_specs_primary_uniq
  ON public.garage_tech_specs (model_id, category, subject, field)
  WHERE is_alternative = false AND is_archived = false;

CREATE INDEX garage_tech_specs_model_idx ON public.garage_tech_specs (model_id, category);
CREATE INDEX garage_tech_specs_review_idx ON public.garage_tech_specs (review_status, verification);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.garage_tech_specs TO authenticated;
GRANT ALL ON public.garage_tech_specs TO service_role;

ALTER TABLE public.garage_tech_specs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read tech specs" ON public.garage_tech_specs
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff can add tech specs" ON public.garage_tech_specs
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Staff can edit tech specs" ON public.garage_tech_specs
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admins can delete tech specs" ON public.garage_tech_specs
  FOR DELETE TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER garage_tech_specs_touch
  BEFORE UPDATE ON public.garage_tech_specs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.garage_tech_coverage(p_model_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
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

REVOKE ALL ON FUNCTION public.garage_tech_coverage(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.garage_tech_coverage(uuid) TO authenticated, service_role;