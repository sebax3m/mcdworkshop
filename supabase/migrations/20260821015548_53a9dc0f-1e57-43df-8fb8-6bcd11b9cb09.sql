ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS post_bike_id uuid REFERENCES public.post_bikes(id) ON DELETE SET NULL,
  ALTER COLUMN customer_id DROP NOT NULL,
  ALTER COLUMN motorcycle_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_jobs_post_bike_id ON public.jobs(post_bike_id);