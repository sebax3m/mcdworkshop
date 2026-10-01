DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.conrelid::regclass AS tbl, c.conname, a.attname
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
    WHERE c.confrelid = 'auth.users'::regclass
      AND c.connamespace = 'public'::regnamespace
      AND c.contype = 'f' AND c.confdeltype = 'a'
      AND NOT a.attnotnull
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.tbl, r.conname);
    EXECUTE format('ALTER TABLE %s ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES auth.users(id) ON DELETE SET NULL', r.tbl, r.conname, r.attname);
  END LOOP;
END $$;