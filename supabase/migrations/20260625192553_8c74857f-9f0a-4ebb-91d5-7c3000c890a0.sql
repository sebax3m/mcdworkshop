ALTER TABLE public.bookings ADD COLUMN priority text NOT NULL DEFAULT 'normal';

COMMENT ON COLUMN public.bookings.priority IS 'Booking urgency: low, normal, high';
