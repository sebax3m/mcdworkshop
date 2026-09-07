ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS google_event_id text,
  ADD COLUMN IF NOT EXISTS google_event_owner uuid,
  ADD COLUMN IF NOT EXISTS google_invite_email text,
  ADD COLUMN IF NOT EXISTS google_include_end boolean NOT NULL DEFAULT false;