CREATE OR REPLACE FUNCTION public.detect_service_from_text(p text)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE l text; rules text[][] := ARRAY[
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
      IF l ~ rules[i][2]
         AND l !~ '\m(no|not|declined?|without|skip|skipped|cancel|cancelled|after|since|recomm\w*|suggest\w*|advis\w*)\M' THEN
        RETURN rules[i][1];
      END IF;
    END LOOP;
  END LOOP;
  RETURN NULL;
END $$;