
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
SECURITY INVOKER
SET search_path = public
AS $$
  -- p_technician_id kept for backwards compatibility; ignored (global capacity).
  SELECT b.id, b.scheduled_date, b.drop_off_time,
         COALESCE(b.scheduled_end_time, (b.drop_off_time + interval '1 hour')::time) AS scheduled_end_time,
         b.service_type, b.status, b.assigned_tech_id
    FROM public.bookings b
   WHERE b.scheduled_date = p_date
     AND lower(coalesce(b.status,'')) NOT IN ('cancelled','deleted','no_show')
     AND (p_exclude_booking_id IS NULL OR b.id <> p_exclude_booking_id)
     AND b.drop_off_time IS NOT NULL
     AND b.drop_off_time < p_end
     AND COALESCE(b.scheduled_end_time, (b.drop_off_time + interval '1 hour')::time) > p_start
   ORDER BY b.drop_off_time;
$$;

REVOKE ALL ON FUNCTION public.find_booking_conflicts(date,time,time,uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.find_booking_conflicts(date,time,time,uuid,uuid) TO authenticated, service_role;
