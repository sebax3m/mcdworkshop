ALTER TABLE public.bookings ALTER COLUMN color DROP DEFAULT;
UPDATE public.bookings SET color = CASE
  WHEN lower(service_type) ~ 'collision|insurance|crash' THEN '#ef4444'
  WHEN lower(service_type) ~ 'dyno'      THEN '#a855f7'
  WHEN lower(service_type) ~ 'wof'       THEN '#6366f1'
  WHEN lower(service_type) ~ 'full'      THEN '#f59e0b'
  WHEN lower(service_type) ~ 'diag'      THEN '#14b8a6'
  WHEN lower(service_type) ~ 'basic'     THEN '#22c55e'
  WHEN lower(service_type) ~ 'pick.?up|pickup' THEN '#f97316'
  WHEN lower(service_type) ~ 'tyre|tire' THEN '#ec4899'
  ELSE '#3b82f6'
END;