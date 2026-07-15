DO $$
DECLARE
  r record;
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='_import_stg'
  ) THEN
    FOR r IN
      SELECT policyname FROM pg_policies
      WHERE schemaname='public' AND tablename='_import_stg'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public._import_stg', r.policyname);
    END LOOP;

    EXECUTE 'ALTER TABLE public._import_stg ENABLE ROW LEVEL SECURITY';
    EXECUTE 'REVOKE ALL ON public._import_stg FROM anon';
    EXECUTE 'REVOKE ALL ON public._import_stg FROM authenticated';
    EXECUTE 'GRANT ALL ON public._import_stg TO service_role';
  END IF;
END
$$;