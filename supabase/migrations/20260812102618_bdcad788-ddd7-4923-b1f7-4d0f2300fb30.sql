-- ============ Phase 2: workshop learning ============

CREATE TABLE public.garage_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id uuid REFERENCES public.bike_library_models(id) ON DELETE SET NULL,
  motorcycle_id uuid REFERENCES public.motorcycles(id) ON DELETE SET NULL,
  kind text NOT NULL CHECK (kind IN ('labour','part','fluid','operation')),
  key_norm text NOT NULL,
  label text NOT NULL,
  detail text,
  value_num numeric,
  unit text,
  job_id uuid REFERENCES public.jobs(id) ON DELETE CASCADE,
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  source text NOT NULL DEFAULT 'completed_job',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.garage_observations TO authenticated;
GRANT ALL ON public.garage_observations TO service_role;
ALTER TABLE public.garage_observations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read observations" ON public.garage_observations
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff add observations" ON public.garage_observations
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Admins update observations" ON public.garage_observations
  FOR UPDATE TO authenticated USING (private.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins delete observations" ON public.garage_observations
  FOR DELETE TO authenticated USING (private.has_role(auth.uid(),'admin'));

CREATE UNIQUE INDEX garage_observations_unique_source
  ON public.garage_observations (job_id, kind, key_norm)
  WHERE job_id IS NOT NULL;
CREATE INDEX garage_observations_model_kind ON public.garage_observations (model_id, kind, key_norm);
CREATE INDEX garage_observations_bike ON public.garage_observations (motorcycle_id);

-- Individual bike knowledge (mods, performance, tuning) — never generalised to the model
CREATE TABLE public.motorcycle_knowledge (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  motorcycle_id uuid NOT NULL REFERENCES public.motorcycles(id) ON DELETE CASCADE,
  category text NOT NULL DEFAULT 'modification',
  label text NOT NULL,
  value text,
  unit text,
  notes text,
  job_id uuid REFERENCES public.jobs(id) ON DELETE SET NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.motorcycle_knowledge TO authenticated;
GRANT ALL ON public.motorcycle_knowledge TO service_role;
ALTER TABLE public.motorcycle_knowledge ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read bike knowledge" ON public.motorcycle_knowledge
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff add bike knowledge" ON public.motorcycle_knowledge
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Staff update bike knowledge" ON public.motorcycle_knowledge
  FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins delete bike knowledge" ON public.motorcycle_knowledge
  FOR DELETE TO authenticated USING (private.has_role(auth.uid(),'admin'));

CREATE TRIGGER motorcycle_knowledge_touch BEFORE UPDATE ON public.motorcycle_knowledge
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX motorcycle_knowledge_bike ON public.motorcycle_knowledge (motorcycle_id);

-- Approval queue gains category + evidence
ALTER TABLE public.garage_update_proposals
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'other',
  ADD COLUMN IF NOT EXISTS evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS evidence_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS job_id uuid REFERENCES public.jobs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS unit text;

-- ============ model matching ============
CREATE OR REPLACE FUNCTION public.garage_norm(p text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT regexp_replace(lower(coalesce(p,'')), '[^a-z0-9]', '', 'g');
$$;

CREATE INDEX IF NOT EXISTS bike_library_models_norm
  ON public.bike_library_models (public.garage_norm(make), public.garage_norm(model));
CREATE INDEX IF NOT EXISTS motorcycles_norm
  ON public.motorcycles (public.garage_norm(make), public.garage_norm(model));

CREATE OR REPLACE FUNCTION public.garage_match_model(p_make text, p_model text, p_year integer DEFAULT NULL)
RETURNS uuid LANGUAGE sql STABLE SET search_path TO 'public' AS $$
  SELECT m.id
    FROM public.bike_library_models m
   WHERE m.is_archived = false
     AND public.garage_norm(m.make) = public.garage_norm(p_make)
     AND public.garage_norm(m.model) = public.garage_norm(p_model)
   ORDER BY
     CASE WHEN p_year IS NOT NULL
            AND coalesce(m.year_from, -99999) <= p_year
            AND coalesce(m.year_to, 99999) >= p_year THEN 0 ELSE 1 END,
     abs(coalesce(m.year_from, 0) - coalesce(p_year, coalesce(m.year_from,0)))
   LIMIT 1;
$$;

-- ============ aggregation ============
CREATE OR REPLACE FUNCTION public.garage_observation_summary(p_model_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SET search_path TO 'public' AS $$
  SELECT jsonb_build_object(
    'labour', coalesce((
      SELECT jsonb_agg(x ORDER BY x->>'label')
      FROM (
        SELECT jsonb_build_object(
                 'key', key_norm, 'label', min(label), 'jobs', count(*),
                 'avg', round(avg(value_num)::numeric, 2),
                 'min', min(value_num), 'max', max(value_num),
                 'last_at', max(created_at)
               ) AS x
          FROM public.garage_observations
         WHERE model_id = p_model_id AND kind = 'labour' AND value_num IS NOT NULL
         GROUP BY key_norm
      ) s), '[]'::jsonb),
    'parts', coalesce((
      SELECT jsonb_agg(x ORDER BY (x->>'jobs')::int DESC)
      FROM (
        SELECT jsonb_build_object(
                 'key', key_norm, 'label', min(label), 'jobs', count(*),
                 'detail', max(detail), 'last_at', max(created_at)
               ) AS x
          FROM public.garage_observations
         WHERE model_id = p_model_id AND kind = 'part'
         GROUP BY key_norm
      ) s), '[]'::jsonb),
    'fluids', coalesce((
      SELECT jsonb_agg(x ORDER BY x->>'label')
      FROM (
        SELECT jsonb_build_object(
                 'key', key_norm, 'label', min(label), 'jobs', count(*),
                 'avg', round(avg(value_num)::numeric, 2),
                 'unit', max(unit), 'detail', max(detail), 'last_at', max(created_at)
               ) AS x
          FROM public.garage_observations
         WHERE model_id = p_model_id AND kind = 'fluid'
         GROUP BY key_norm
      ) s), '[]'::jsonb)
  );
$$;

CREATE OR REPLACE FUNCTION public.garage_model_experience(p_model_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path TO 'public' AS $$
DECLARE m public.bike_library_models%ROWTYPE; res jsonb;
BEGIN
  SELECT * INTO m FROM public.bike_library_models WHERE id = p_model_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('bikes',0,'jobs',0,'operations','[]'::jsonb,'last_worked',NULL); END IF;

  WITH bikes AS (
    SELECT mc.id FROM public.motorcycles mc
     WHERE public.garage_norm(mc.make) = public.garage_norm(m.make)
       AND public.garage_norm(mc.model) = public.garage_norm(m.model)
       AND (m.year_from IS NULL OR coalesce(mc.year, m.year_from) >= m.year_from)
       AND (m.year_to IS NULL OR coalesce(mc.year, m.year_to) <= m.year_to)
  ), done AS (
    SELECT j.* FROM public.jobs j JOIN bikes b ON b.id = j.motorcycle_id
     WHERE j.status = 'completed'
  )
  SELECT jsonb_build_object(
    'bikes', (SELECT count(*) FROM bikes),
    'jobs', (SELECT count(*) FROM done),
    'last_worked', (SELECT max(coalesce(completed_at, updated_at)) FROM done),
    'operations', coalesce((
      SELECT jsonb_agg(x ORDER BY (x->>'count')::int DESC)
      FROM (SELECT jsonb_build_object('title', title, 'count', count(*)) AS x
              FROM done GROUP BY title ORDER BY count(*) DESC LIMIT 8) t), '[]'::jsonb)
  ) INTO res;
  RETURN res;
END; $$;

CREATE OR REPLACE FUNCTION public.garage_model_jobs(p_model_id uuid, p_limit integer DEFAULT 20)
RETURNS TABLE(job_id uuid, job_number integer, title text, completed_at timestamptz, estimated_hours numeric, tracked_minutes integer, bike text)
LANGUAGE sql STABLE SET search_path TO 'public' AS $$
  SELECT j.id, j.job_number, j.title, j.completed_at, j.estimated_hours,
         (SELECT coalesce(sum(te.minutes),0)::int FROM public.time_entries te WHERE te.job_id = j.id),
         concat_ws(' ', mc.year::text, mc.make, mc.model)
    FROM public.jobs j
    JOIN public.motorcycles mc ON mc.id = j.motorcycle_id
    JOIN public.bike_library_models m ON m.id = p_model_id
   WHERE j.status = 'completed'
     AND public.garage_norm(mc.make) = public.garage_norm(m.make)
     AND public.garage_norm(mc.model) = public.garage_norm(m.model)
   ORDER BY j.completed_at DESC NULLS LAST
   LIMIT p_limit;
$$;
