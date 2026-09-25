CREATE TABLE public.carjam_vehicle_cache (
  rego TEXT PRIMARY KEY,
  vehicle_data JSONB NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.carjam_vehicle_cache TO authenticated;
GRANT ALL ON public.carjam_vehicle_cache TO service_role;

ALTER TABLE public.carjam_vehicle_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read CarJam vehicle cache"
ON public.carjam_vehicle_cache
FOR SELECT TO authenticated
USING (private.is_staff(auth.uid()));

CREATE POLICY "Staff can create CarJam vehicle cache"
ON public.carjam_vehicle_cache
FOR INSERT TO authenticated
WITH CHECK (private.is_staff(auth.uid()));

CREATE POLICY "Staff can update CarJam vehicle cache"
ON public.carjam_vehicle_cache
FOR UPDATE TO authenticated
USING (private.is_staff(auth.uid()))
WITH CHECK (private.is_staff(auth.uid()));