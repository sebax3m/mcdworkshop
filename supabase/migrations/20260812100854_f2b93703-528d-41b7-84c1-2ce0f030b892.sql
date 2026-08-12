
-- ============ Garage Library: shared enums ============
DO $$ BEGIN
  CREATE TYPE public.garage_source AS ENUM ('workshop_verified','manufacturer_manual','parts_supplier','previous_job','technician_entry','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.garage_verification AS ENUM ('unverified','workshop_verified','manufacturer_verified');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ Extend existing model library ============
ALTER TABLE public.bike_library_models
  ADD COLUMN IF NOT EXISTS variant text,
  ADD COLUMN IF NOT EXISTS engine_cc integer,
  ADD COLUMN IF NOT EXISTS photo_url text,
  ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS updated_by uuid;

ALTER TABLE public.bike_library_parts
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS brand text,
  ADD COLUMN IF NOT EXISTS alt_part_number text,
  ADD COLUMN IF NOT EXISTS retail_price numeric,
  ADD COLUMN IF NOT EXISTS source public.garage_source NOT NULL DEFAULT 'technician_entry',
  ADD COLUMN IF NOT EXISTS verification public.garage_verification NOT NULL DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS verified_by uuid,
  ADD COLUMN IF NOT EXISTS updated_by uuid,
  ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false;

ALTER TABLE public.bike_library_labour
  ADD COLUMN IF NOT EXISTS parts_required text,
  ADD COLUMN IF NOT EXISTS special_tools text,
  ADD COLUMN IF NOT EXISTS source public.garage_source NOT NULL DEFAULT 'technician_entry',
  ADD COLUMN IF NOT EXISTS verification public.garage_verification NOT NULL DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS verified_by uuid,
  ADD COLUMN IF NOT EXISTS updated_by uuid,
  ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false;

ALTER TABLE public.bike_library_torque
  ADD COLUMN IF NOT EXISTS unit text NOT NULL DEFAULT 'Nm',
  ADD COLUMN IF NOT EXISTS source public.garage_source NOT NULL DEFAULT 'technician_entry',
  ADD COLUMN IF NOT EXISTS verification public.garage_verification NOT NULL DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS verified_by uuid,
  ADD COLUMN IF NOT EXISTS updated_by uuid,
  ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false;

-- ============ Fluids ============
CREATE TABLE IF NOT EXISTS public.garage_fluid_specs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id uuid NOT NULL REFERENCES public.bike_library_models(id) ON DELETE CASCADE,
  fluid_type text NOT NULL,
  spec text,
  standard text,
  qty_without_filter numeric,
  qty_with_filter numeric,
  unit text NOT NULL DEFAULT 'L',
  filter_part_number text,
  preferred_product text,
  notes text,
  source public.garage_source NOT NULL DEFAULT 'technician_entry',
  verification public.garage_verification NOT NULL DEFAULT 'unverified',
  verified_by uuid,
  updated_by uuid,
  is_archived boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.garage_fluid_specs TO authenticated;
GRANT ALL ON public.garage_fluid_specs TO service_role;
ALTER TABLE public.garage_fluid_specs ENABLE ROW LEVEL SECURITY;

-- ============ Valve clearances ============
CREATE TABLE IF NOT EXISTS public.garage_valve_specs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id uuid NOT NULL REFERENCES public.bike_library_models(id) ON DELETE CASCADE,
  intake_min numeric,
  intake_max numeric,
  exhaust_min numeric,
  exhaust_max numeric,
  unit text NOT NULL DEFAULT 'mm',
  measurement_notes text,
  inspection_interval_km integer,
  inspection_hours numeric,
  adjustment_hours numeric,
  special_tools text,
  parts_required text,
  notes text,
  source public.garage_source NOT NULL DEFAULT 'technician_entry',
  verification public.garage_verification NOT NULL DEFAULT 'unverified',
  verified_by uuid,
  updated_by uuid,
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.garage_valve_specs TO authenticated;
GRANT ALL ON public.garage_valve_specs TO service_role;
ALTER TABLE public.garage_valve_specs ENABLE ROW LEVEL SECURITY;

-- ============ Workshop notes ============
CREATE TABLE IF NOT EXISTS public.garage_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id uuid NOT NULL REFERENCES public.bike_library_models(id) ON DELETE CASCADE,
  title text,
  body text NOT NULL,
  created_by uuid,
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.garage_notes TO authenticated;
GRANT ALL ON public.garage_notes TO service_role;
ALTER TABLE public.garage_notes ENABLE ROW LEVEL SECURITY;

-- ============ Revision history ============
CREATE TABLE IF NOT EXISTS public.garage_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id uuid REFERENCES public.bike_library_models(id) ON DELETE CASCADE,
  entity_table text NOT NULL,
  entity_id uuid,
  field text,
  label text NOT NULL,
  old_value text,
  new_value text,
  action text NOT NULL DEFAULT 'update',
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.garage_revisions TO authenticated;
GRANT ALL ON public.garage_revisions TO service_role;
ALTER TABLE public.garage_revisions ENABLE ROW LEVEL SECURITY;

-- ============ Update proposals ============
CREATE TABLE IF NOT EXISTS public.garage_update_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id uuid NOT NULL REFERENCES public.bike_library_models(id) ON DELETE CASCADE,
  entity_table text NOT NULL,
  entity_id uuid,
  label text NOT NULL,
  field text,
  current_value text,
  proposed_value text,
  note text,
  source public.garage_source NOT NULL DEFAULT 'technician_entry',
  status text NOT NULL DEFAULT 'pending',
  proposed_by uuid,
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.garage_update_proposals TO authenticated;
GRANT ALL ON public.garage_update_proposals TO service_role;
ALTER TABLE public.garage_update_proposals ENABLE ROW LEVEL SECURITY;

-- ============ Triggers ============
CREATE TRIGGER garage_fluid_specs_touch BEFORE UPDATE ON public.garage_fluid_specs FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER garage_valve_specs_touch BEFORE UPDATE ON public.garage_valve_specs FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER garage_notes_touch BEFORE UPDATE ON public.garage_notes FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER garage_update_proposals_touch BEFORE UPDATE ON public.garage_update_proposals FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ Policies: read for staff, write for admins ============
DROP POLICY IF EXISTS "staff manage bike library models" ON public.bike_library_models;
DROP POLICY IF EXISTS "staff manage bike library parts" ON public.bike_library_parts;
DROP POLICY IF EXISTS "staff manage bike library labour" ON public.bike_library_labour;
DROP POLICY IF EXISTS "staff manage bike library torque" ON public.bike_library_torque;

CREATE POLICY "staff read models" ON public.bike_library_models FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins write models" ON public.bike_library_models FOR ALL TO authenticated USING (private.has_role(auth.uid(),'admin')) WITH CHECK (private.has_role(auth.uid(),'admin'));

CREATE POLICY "staff read parts" ON public.bike_library_parts FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins write parts" ON public.bike_library_parts FOR ALL TO authenticated USING (private.has_role(auth.uid(),'admin')) WITH CHECK (private.has_role(auth.uid(),'admin'));

CREATE POLICY "staff read labour" ON public.bike_library_labour FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins write labour" ON public.bike_library_labour FOR ALL TO authenticated USING (private.has_role(auth.uid(),'admin')) WITH CHECK (private.has_role(auth.uid(),'admin'));

CREATE POLICY "staff read torque" ON public.bike_library_torque FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins write torque" ON public.bike_library_torque FOR ALL TO authenticated USING (private.has_role(auth.uid(),'admin')) WITH CHECK (private.has_role(auth.uid(),'admin'));

CREATE POLICY "staff read fluids" ON public.garage_fluid_specs FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins write fluids" ON public.garage_fluid_specs FOR ALL TO authenticated USING (private.has_role(auth.uid(),'admin')) WITH CHECK (private.has_role(auth.uid(),'admin'));

CREATE POLICY "staff read valves" ON public.garage_valve_specs FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins write valves" ON public.garage_valve_specs FOR ALL TO authenticated USING (private.has_role(auth.uid(),'admin')) WITH CHECK (private.has_role(auth.uid(),'admin'));

CREATE POLICY "staff read garage notes" ON public.garage_notes FOR SELECT TO authenticated USING (true);
CREATE POLICY "staff add garage notes" ON public.garage_notes FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "admins write garage notes" ON public.garage_notes FOR ALL TO authenticated USING (private.has_role(auth.uid(),'admin')) WITH CHECK (private.has_role(auth.uid(),'admin'));

CREATE POLICY "staff read revisions" ON public.garage_revisions FOR SELECT TO authenticated USING (true);
CREATE POLICY "staff insert revisions" ON public.garage_revisions FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "staff read proposals" ON public.garage_update_proposals FOR SELECT TO authenticated USING (true);
CREATE POLICY "staff submit proposals" ON public.garage_update_proposals FOR INSERT TO authenticated WITH CHECK (auth.uid() = proposed_by);
CREATE POLICY "admins manage proposals" ON public.garage_update_proposals FOR ALL TO authenticated USING (private.has_role(auth.uid(),'admin')) WITH CHECK (private.has_role(auth.uid(),'admin'));

CREATE INDEX IF NOT EXISTS idx_garage_fluids_model ON public.garage_fluid_specs(model_id);
CREATE INDEX IF NOT EXISTS idx_garage_valves_model ON public.garage_valve_specs(model_id);
CREATE INDEX IF NOT EXISTS idx_garage_notes_model ON public.garage_notes(model_id);
CREATE INDEX IF NOT EXISTS idx_garage_revisions_model ON public.garage_revisions(model_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_garage_proposals_status ON public.garage_update_proposals(status, created_at DESC);
