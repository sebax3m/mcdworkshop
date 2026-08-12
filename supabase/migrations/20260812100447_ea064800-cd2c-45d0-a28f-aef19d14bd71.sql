
CREATE TABLE public.bike_library_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  make text NOT NULL,
  model text NOT NULL,
  year_from integer,
  year_to integer,
  cylinders integer NOT NULL DEFAULT 4,
  engine_oil_type text,
  engine_oil_qty_l numeric,
  oil_filter text,
  air_filter text,
  spark_plug text,
  spark_plug_qty integer,
  coolant_type text,
  coolant_qty_l numeric,
  brake_fluid text,
  fork_oil text,
  front_tyre text,
  rear_tyre text,
  chain_spec text,
  front_sprocket text,
  rear_sprocket text,
  battery text,
  valve_intake_min numeric,
  valve_intake_max numeric,
  valve_exhaust_min numeric,
  valve_exhaust_max numeric,
  service_interval_km integer,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX bike_library_models_key
  ON public.bike_library_models (lower(make), lower(model), COALESCE(year_from, 0));

CREATE TABLE public.bike_library_parts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id uuid NOT NULL REFERENCES public.bike_library_models(id) ON DELETE CASCADE,
  name text NOT NULL,
  part_number text,
  supplier text,
  price numeric,
  qty numeric NOT NULL DEFAULT 1,
  notes text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX bike_library_parts_key ON public.bike_library_parts (model_id, lower(name));

CREATE TABLE public.bike_library_labour (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id uuid NOT NULL REFERENCES public.bike_library_models(id) ON DELETE CASCADE,
  task text NOT NULL,
  hours numeric,
  parts_cost numeric,
  notes text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX bike_library_labour_key ON public.bike_library_labour (model_id, lower(task));

CREATE TABLE public.bike_library_torque (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id uuid NOT NULL REFERENCES public.bike_library_models(id) ON DELETE CASCADE,
  fastener text NOT NULL,
  torque_nm numeric,
  notes text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX bike_library_torque_key ON public.bike_library_torque (model_id, lower(fastener));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bike_library_models TO authenticated;
GRANT ALL ON public.bike_library_models TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bike_library_parts TO authenticated;
GRANT ALL ON public.bike_library_parts TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bike_library_labour TO authenticated;
GRANT ALL ON public.bike_library_labour TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bike_library_torque TO authenticated;
GRANT ALL ON public.bike_library_torque TO service_role;

ALTER TABLE public.bike_library_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bike_library_parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bike_library_labour ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bike_library_torque ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff manage bike library models" ON public.bike_library_models
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "staff manage bike library parts" ON public.bike_library_parts
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "staff manage bike library labour" ON public.bike_library_labour
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "staff manage bike library torque" ON public.bike_library_torque
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE TRIGGER bike_library_models_touch BEFORE UPDATE ON public.bike_library_models
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER bike_library_parts_touch BEFORE UPDATE ON public.bike_library_parts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER bike_library_labour_touch BEFORE UPDATE ON public.bike_library_labour
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER bike_library_torque_touch BEFORE UPDATE ON public.bike_library_torque
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
