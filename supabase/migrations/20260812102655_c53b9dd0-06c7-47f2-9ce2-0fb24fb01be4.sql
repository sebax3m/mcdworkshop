CREATE OR REPLACE FUNCTION public.garage_norm(p text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $$
  SELECT regexp_replace(lower(coalesce(p,'')), '[^a-z0-9]', '', 'g');
$$;