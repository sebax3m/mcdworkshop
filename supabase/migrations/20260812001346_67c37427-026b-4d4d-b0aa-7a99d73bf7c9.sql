ALTER TABLE public.parts ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY job_id ORDER BY created_at) - 1 AS rn
  FROM public.parts
)
UPDATE public.parts p SET sort_order = ranked.rn FROM ranked WHERE ranked.id = p.id;