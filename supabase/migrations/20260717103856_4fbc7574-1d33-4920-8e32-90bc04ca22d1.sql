ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS bike_arrived boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bike_arrived_at timestamptz;