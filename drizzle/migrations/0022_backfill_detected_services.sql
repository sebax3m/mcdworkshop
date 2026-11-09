UPDATE public.bookings SET notes = notes
WHERE lower(trim(coalesce(service_type,''))) IN ('diagnostic','')
  AND public.detect_service_from_text(concat_ws(E'\n', instructions, notes)) IS NOT NULL;