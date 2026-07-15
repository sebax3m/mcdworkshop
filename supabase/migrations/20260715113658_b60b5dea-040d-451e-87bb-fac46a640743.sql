
-- ============================================================
-- Phase 1: Booking types, daily notes, slot end time, reminders, conflict RPC
-- ============================================================

-- 1) BOOKING TYPES ------------------------------------------------
CREATE TABLE IF NOT EXISTS public.booking_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 100,
  color text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.booking_types TO authenticated;
GRANT ALL ON public.booking_types TO service_role;

ALTER TABLE public.booking_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff read booking_types" ON public.booking_types
  FOR SELECT TO authenticated USING (private.is_staff(auth.uid()));

CREATE POLICY "admins manage booking_types" ON public.booking_types
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'))
  WITH CHECK (private.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_booking_types_updated_at
  BEFORE UPDATE ON public.booking_types
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Seed the union of current SERVICE_TYPES constants (all active by default)
INSERT INTO public.booking_types (name, sort_order) VALUES
  ('Basic Service', 10),
  ('Standard Service', 20),
  ('Annual Service', 30),
  ('Full Service', 40),
  ('Tuning', 50),
  ('Diagnostic', 60),
  ('Insurance / Crash', 70),
  ('Collision Repair (Insurance)', 80),
  ('Post Bike', 90),
  ('Tyre Change', 100),
  ('Brake Service', 110),
  ('Chain & Sprocket', 120),
  ('Suspension', 130),
  ('Helmet Fitting', 140),
  ('Other', 999)
ON CONFLICT (name) DO NOTHING;

-- 2) DAILY NOTES --------------------------------------------------
CREATE TABLE IF NOT EXISTS public.daily_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  note_date date NOT NULL,
  title text NOT NULL,
  body text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_daily_notes_date ON public.daily_notes(note_date);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_notes TO authenticated;
GRANT ALL ON public.daily_notes TO service_role;

ALTER TABLE public.daily_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff read daily_notes" ON public.daily_notes
  FOR SELECT TO authenticated USING (private.is_staff(auth.uid()));

CREATE POLICY "staff insert daily_notes" ON public.daily_notes
  FOR INSERT TO authenticated
  WITH CHECK (private.is_staff(auth.uid()) AND created_by = auth.uid());

CREATE POLICY "staff update own or admin daily_notes" ON public.daily_notes
  FOR UPDATE TO authenticated
  USING (private.is_staff(auth.uid()) AND (created_by = auth.uid() OR private.has_role(auth.uid(),'admin')))
  WITH CHECK (private.is_staff(auth.uid()));

CREATE POLICY "staff delete own or admin daily_notes" ON public.daily_notes
  FOR DELETE TO authenticated
  USING (private.is_staff(auth.uid()) AND (created_by = auth.uid() OR private.has_role(auth.uid(),'admin')));

CREATE TRIGGER trg_daily_notes_updated_at
  BEFORE UPDATE ON public.daily_notes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 3) BOOKINGS: separate slot end from estimated job time + reminder idempotency
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS scheduled_end_time time without time zone,
  ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz;

-- Backfill scheduled_end_time = drop_off_time + 1 hour for existing rows
UPDATE public.bookings
   SET scheduled_end_time = (drop_off_time + interval '1 hour')::time
 WHERE scheduled_end_time IS NULL AND drop_off_time IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_date_time
  ON public.bookings (scheduled_date, drop_off_time)
  WHERE status NOT IN ('cancelled','deleted');

CREATE INDEX IF NOT EXISTS idx_bookings_tech_date
  ON public.bookings (assigned_tech_id, scheduled_date)
  WHERE status NOT IN ('cancelled','deleted');

-- 4) CONFLICT DETECTION RPC (server-side, per-technician) ---------
CREATE OR REPLACE FUNCTION public.find_booking_conflicts(
  p_date date,
  p_start time,
  p_end time,
  p_technician_id uuid,
  p_exclude_booking_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  scheduled_date date,
  drop_off_time time,
  scheduled_end_time time,
  service_type text,
  status text,
  assigned_tech_id uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT b.id, b.scheduled_date, b.drop_off_time,
         COALESCE(b.scheduled_end_time, (b.drop_off_time + interval '1 hour')::time) AS scheduled_end_time,
         b.service_type, b.status, b.assigned_tech_id
    FROM public.bookings b
   WHERE b.scheduled_date = p_date
     AND lower(coalesce(b.status,'')) NOT IN ('cancelled','deleted','no_show')
     AND (p_exclude_booking_id IS NULL OR b.id <> p_exclude_booking_id)
     AND p_technician_id IS NOT NULL
     AND b.assigned_tech_id IS NOT NULL
     AND b.assigned_tech_id = p_technician_id
     AND b.drop_off_time IS NOT NULL
     AND b.drop_off_time < p_end
     AND COALESCE(b.scheduled_end_time, (b.drop_off_time + interval '1 hour')::time) > p_start
   ORDER BY b.drop_off_time;
$$;

REVOKE ALL ON FUNCTION public.find_booking_conflicts(date,time,time,uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.find_booking_conflicts(date,time,time,uuid,uuid) TO authenticated, service_role;
