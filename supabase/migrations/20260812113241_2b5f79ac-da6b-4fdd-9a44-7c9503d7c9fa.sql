-- ============ Phase 4: bike-specific overrides ============
CREATE TABLE public.garage_bike_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  motorcycle_id uuid NOT NULL REFERENCES public.motorcycles(id) ON DELETE CASCADE,
  model_id uuid REFERENCES public.bike_library_models(id) ON DELETE SET NULL,
  category text NOT NULL,
  subject text NOT NULL DEFAULT '',
  field text NOT NULL,
  value_text text,
  value_num numeric,
  unit text,
  reason text,
  notes text,
  source_type text NOT NULL DEFAULT 'workshop_observation',
  source_name text,
  verification text NOT NULL DEFAULT 'workshop_verified',
  is_archived boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (motorcycle_id, category, subject, field)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.garage_bike_overrides TO authenticated;
GRANT ALL ON public.garage_bike_overrides TO service_role;
ALTER TABLE public.garage_bike_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read bike overrides" ON public.garage_bike_overrides
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff add bike overrides" ON public.garage_bike_overrides
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Staff edit bike overrides" ON public.garage_bike_overrides
  FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Admins delete bike overrides" ON public.garage_bike_overrides
  FOR DELETE TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER garage_bike_overrides_touch
  BEFORE UPDATE ON public.garage_bike_overrides
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX garage_bike_overrides_bike_idx ON public.garage_bike_overrides(motorcycle_id) WHERE is_archived = false;

-- ============ Phase 5: research queue ============
CREATE TABLE public.garage_research_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id uuid NOT NULL REFERENCES public.bike_library_models(id) ON DELETE CASCADE,
  category text NOT NULL,
  subject text NOT NULL DEFAULT '',
  field text NOT NULL,
  label text NOT NULL,
  note text,
  priority integer NOT NULL DEFAULT 2,
  status text NOT NULL DEFAULT 'open',
  requested_by uuid,
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (model_id, category, subject, field)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.garage_research_requests TO authenticated;
GRANT ALL ON public.garage_research_requests TO service_role;
ALTER TABLE public.garage_research_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read research requests" ON public.garage_research_requests
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff add research requests" ON public.garage_research_requests
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Staff edit research requests" ON public.garage_research_requests
  FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Admins delete research requests" ON public.garage_research_requests
  FOR DELETE TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER garage_research_requests_touch
  BEFORE UPDATE ON public.garage_research_requests
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ Phase 5: research staging ============
CREATE TABLE public.garage_research_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid REFERENCES public.garage_research_requests(id) ON DELETE SET NULL,
  model_id uuid NOT NULL REFERENCES public.bike_library_models(id) ON DELETE CASCADE,
  category text NOT NULL,
  subject text NOT NULL DEFAULT '',
  field text NOT NULL,
  value_text text,
  value_num numeric,
  unit text,
  notes text,
  source_type text NOT NULL DEFAULT 'external_research',
  source_name text,
  source_ref text,
  source_url text,
  source_date date,
  accessed_at timestamptz NOT NULL DEFAULT now(),
  researched_by uuid,
  origin text NOT NULL DEFAULT 'manual_research',
  confidence text NOT NULL DEFAULT 'low',
  warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  model_match text NOT NULL DEFAULT 'exact',
  conflict_spec_id uuid REFERENCES public.garage_tech_specs(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'staged',
  decision_note text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  applied_spec_id uuid REFERENCES public.garage_tech_specs(id) ON DELETE SET NULL,
  import_batch text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.garage_research_results TO authenticated;
GRANT ALL ON public.garage_research_results TO service_role;
ALTER TABLE public.garage_research_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read research results" ON public.garage_research_results
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff add research results" ON public.garage_research_results
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Staff review research results" ON public.garage_research_results
  FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Admins delete research results" ON public.garage_research_results
  FOR DELETE TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER garage_research_results_touch
  BEFORE UPDATE ON public.garage_research_results
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX garage_research_results_status_idx ON public.garage_research_results(status, model_id);

-- ============ Part usage report ============
CREATE OR REPLACE FUNCTION public.garage_part_usage(p_model_id uuid)
RETURNS TABLE(key_norm text, label text, detail text, jobs bigint, last_used timestamptz, verified boolean)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT o.key_norm,
         max(o.label) AS label,
         max(o.detail) AS detail,
         count(DISTINCT o.job_id) AS jobs,
         max(o.created_at) AS last_used,
         EXISTS (
           SELECT 1 FROM public.bike_library_parts p
           WHERE p.model_id = p_model_id
             AND p.is_archived = false
             AND public.garage_norm(p.name) = o.key_norm
             AND p.verification <> 'unverified'
         ) AS verified
  FROM public.garage_observations o
  WHERE o.model_id = p_model_id AND o.kind = 'part'
  GROUP BY o.key_norm
  ORDER BY count(DISTINCT o.job_id) DESC, max(o.created_at) DESC
$$;

-- ============ Research analytics ============
CREATE OR REPLACE FUNCTION public.garage_research_analytics()
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'open_requests', (SELECT count(*) FROM public.garage_research_requests WHERE status = 'open'),
    'staged', (SELECT count(*) FROM public.garage_research_results WHERE status = 'staged'),
    'needs_more', (SELECT count(*) FROM public.garage_research_results WHERE status = 'needs_more_research'),
    'unverified_specs', (SELECT count(*) FROM public.garage_tech_specs WHERE is_archived = false AND verification = 'unverified'),
    'top_missing_models', (
      SELECT coalesce(jsonb_agg(x), '[]'::jsonb) FROM (
        SELECT r.model_id,
               m.make, m.model, m.generation, m.year_from, m.year_to,
               count(*) AS requests
        FROM public.garage_research_requests r
        JOIN public.bike_library_models m ON m.id = r.model_id
        WHERE r.status <> 'closed'
        GROUP BY r.model_id, m.make, m.model, m.generation, m.year_from, m.year_to
        ORDER BY count(*) DESC
        LIMIT 10
      ) x
    ),
    'top_missing_fields', (
      SELECT coalesce(jsonb_agg(x), '[]'::jsonb) FROM (
        SELECT category, field, count(*) AS requests
        FROM public.garage_research_requests
        WHERE status <> 'closed'
        GROUP BY category, field
        ORDER BY count(*) DESC
        LIMIT 10
      ) x
    ),
    'recently_verified', (
      SELECT coalesce(jsonb_agg(x), '[]'::jsonb) FROM (
        SELECT s.id, s.category, s.subject, s.field, s.value_text, s.value_num, s.unit,
               s.verification, s.verified_at, m.make, m.model, m.generation
        FROM public.garage_tech_specs s
        JOIN public.bike_library_models m ON m.id = s.model_id
        WHERE s.is_archived = false AND s.verified_at IS NOT NULL
        ORDER BY s.verified_at DESC
        LIMIT 10
      ) x
    )
  )
$$;

REVOKE ALL ON FUNCTION public.garage_part_usage(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.garage_research_analytics() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.garage_part_usage(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.garage_research_analytics() TO authenticated, service_role;