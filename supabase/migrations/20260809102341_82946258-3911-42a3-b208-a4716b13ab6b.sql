CREATE TABLE IF NOT EXISTS public.workshop_capacity (
  weekday smallint PRIMARY KEY CHECK (weekday BETWEEN 0 AND 6),
  max_bookins integer NOT NULL DEFAULT 8 CHECK (max_bookins >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workshop_capacity TO authenticated;
GRANT ALL ON public.workshop_capacity TO service_role;

ALTER TABLE public.workshop_capacity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view workshop capacity"
ON public.workshop_capacity FOR SELECT TO authenticated
USING (private.is_staff(auth.uid()));

CREATE POLICY "Admins manage workshop capacity"
ON public.workshop_capacity FOR ALL TO authenticated
USING (private.has_role(auth.uid(), 'admin'))
WITH CHECK (private.has_role(auth.uid(), 'admin'));

INSERT INTO public.workshop_capacity (weekday, max_bookins) VALUES
  (1, 8), (2, 8), (3, 8), (4, 8), (5, 6), (6, 3), (0, 0)
ON CONFLICT (weekday) DO NOTHING;