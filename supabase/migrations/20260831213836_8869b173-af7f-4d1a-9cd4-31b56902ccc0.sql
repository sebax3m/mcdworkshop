DROP POLICY IF EXISTS "Admins create jobs" ON public.jobs;
CREATE POLICY "Staff create jobs" ON public.jobs FOR INSERT TO authenticated WITH CHECK (private.is_staff(auth.uid()));