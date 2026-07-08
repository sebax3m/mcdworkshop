
ALTER TABLE public._import_stg ENABLE ROW LEVEL SECURITY;
GRANT INSERT, SELECT, DELETE ON public._import_stg TO anon, authenticated;
CREATE POLICY "import_open" ON public._import_stg FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
