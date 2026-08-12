CREATE TABLE public.valve_clearance_specs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  make text NOT NULL,
  model text NOT NULL,
  year_from integer,
  year_to integer,
  intake_min numeric NOT NULL DEFAULT 0,
  intake_max numeric NOT NULL DEFAULT 0,
  exhaust_min numeric NOT NULL DEFAULT 0,
  exhaust_max numeric NOT NULL DEFAULT 0,
  cylinders integer NOT NULL DEFAULT 4,
  intake_on_top boolean NOT NULL DEFAULT true,
  note text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX valve_clearance_specs_make_model_key
  ON public.valve_clearance_specs (lower(btrim(make)), lower(btrim(model)));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.valve_clearance_specs TO authenticated;
GRANT ALL ON public.valve_clearance_specs TO service_role;

ALTER TABLE public.valve_clearance_specs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff read valve_clearance_specs" ON public.valve_clearance_specs
  FOR SELECT TO authenticated USING (private.is_staff(auth.uid()));
CREATE POLICY "staff write valve_clearance_specs" ON public.valve_clearance_specs
  FOR ALL TO authenticated USING (private.is_staff(auth.uid())) WITH CHECK (private.is_staff(auth.uid()));

CREATE TRIGGER trg_valve_clearance_specs_updated BEFORE UPDATE ON public.valve_clearance_specs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();