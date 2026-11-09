CREATE OR REPLACE FUNCTION public.detect_service_from_text(p text)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE l text; svc text; rules text[][] := ARRAY[
  ARRAY['Full Service', '\m(full|major)\s+service\M'],
  ARRAY['Annual Service', '\mannual\s+service\M'],
  ARRAY['Standard Service', '\mstandard\s+service\M'],
  ARRAY['Basic Service', '\m(basic|eco|minor)\s+service\M'],
  ARRAY['Tuning', '(\mdyno\s+tun|\mcustom\s+tune\M|\mtuning\M|power\s?vision|woolich|alientech)']];
  i int;
BEGIN
  IF p IS NULL THEN RETURN NULL; END IF;
  FOR i IN 1..array_length(rules,1) LOOP
    FOREACH l IN ARRAY regexp_split_to_array(lower(p), E'\\r?\\n') LOOP
      IF l ~ rules[i][2] AND l !~ '\m(no|not|declined?|without|skip|skipped|cancel|cancelled)\M' THEN
        RETURN rules[i][1];
      END IF;
    END LOOP;
  END LOOP;
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.trg_bookings_detect_service()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE svc text;
BEGIN
  IF lower(trim(coalesce(NEW.service_type,''))) IN ('diagnostic','') THEN
    svc := public.detect_service_from_text(concat_ws(E'\n', NEW.instructions, NEW.notes));
    IF svc IS NOT NULL THEN
      NEW.service_type := svc;
      NEW.service_type_other := NULL;
      IF NEW.job_id IS NOT NULL THEN
        UPDATE public.jobs SET title = svc
         WHERE id = NEW.job_id AND lower(trim(coalesce(title,''))) IN ('diagnostic','');
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS bookings_detect_service ON public.bookings;
CREATE TRIGGER bookings_detect_service BEFORE INSERT OR UPDATE OF notes, instructions, service_type, job_id
ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.trg_bookings_detect_service();