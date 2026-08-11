DROP POLICY IF EXISTS "Tech update assigned job" ON public.jobs;
CREATE POLICY "Staff update jobs" ON public.jobs FOR UPDATE TO authenticated
USING (private.is_staff(auth.uid())) WITH CHECK (private.is_staff(auth.uid()));