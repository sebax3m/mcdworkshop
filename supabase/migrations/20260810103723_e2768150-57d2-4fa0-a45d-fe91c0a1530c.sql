CREATE TABLE public.post_bike_branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.post_bike_branches TO authenticated;
GRANT ALL ON public.post_bike_branches TO service_role;
ALTER TABLE public.post_bike_branches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view post bike branches" ON public.post_bike_branches FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff can insert post bike branches" ON public.post_bike_branches FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Staff can update post bike branches" ON public.post_bike_branches FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Staff can delete post bike branches" ON public.post_bike_branches FOR DELETE TO authenticated USING (true);

CREATE TABLE public.post_bikes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid REFERENCES public.post_bike_branches(id) ON DELETE SET NULL,
  name text,
  rego text,
  make text,
  model text,
  year integer,
  color text,
  current_km integer,
  service_interval_km integer NOT NULL DEFAULT 5000,
  last_service_date date,
  last_service_km integer,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.post_bikes TO authenticated;
GRANT ALL ON public.post_bikes TO service_role;
ALTER TABLE public.post_bikes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view post bikes" ON public.post_bikes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff can insert post bikes" ON public.post_bikes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Staff can update post bikes" ON public.post_bikes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Staff can delete post bikes" ON public.post_bikes FOR DELETE TO authenticated USING (true);

CREATE TABLE public.post_bike_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_bike_id uuid NOT NULL REFERENCES public.post_bikes(id) ON DELETE CASCADE,
  service_date date NOT NULL DEFAULT current_date,
  km integer,
  service_type text,
  description text NOT NULL,
  cost numeric,
  performed_by text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_post_bike_services_bike ON public.post_bike_services(post_bike_id, service_date DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.post_bike_services TO authenticated;
GRANT ALL ON public.post_bike_services TO service_role;
ALTER TABLE public.post_bike_services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view post bike services" ON public.post_bike_services FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff can insert post bike services" ON public.post_bike_services FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Staff can update post bike services" ON public.post_bike_services FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Staff can delete post bike services" ON public.post_bike_services FOR DELETE TO authenticated USING (true);

CREATE TRIGGER trg_post_bike_branches_updated BEFORE UPDATE ON public.post_bike_branches FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_post_bikes_updated BEFORE UPDATE ON public.post_bikes FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_post_bike_services_updated BEFORE UPDATE ON public.post_bike_services FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.post_bike_branches (name, sort_order) VALUES ('Beachlands', 1), ('Manukau', 2), ('Pukekohe', 3);