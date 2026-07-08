ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS google_uid text;
CREATE UNIQUE INDEX IF NOT EXISTS bookings_google_uid_key ON public.bookings(google_uid) WHERE google_uid IS NOT NULL;