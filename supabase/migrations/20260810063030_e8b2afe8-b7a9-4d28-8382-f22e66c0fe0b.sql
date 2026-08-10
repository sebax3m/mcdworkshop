ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS branch text;
CREATE INDEX IF NOT EXISTS bookings_branch_idx ON public.bookings (branch);