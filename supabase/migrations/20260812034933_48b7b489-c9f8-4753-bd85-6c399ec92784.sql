ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS pickup_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS delivery_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS transport_address text,
  ADD COLUMN IF NOT EXISTS transport_notes text;