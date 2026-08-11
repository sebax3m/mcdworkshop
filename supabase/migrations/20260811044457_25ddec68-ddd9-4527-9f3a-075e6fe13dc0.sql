
DROP POLICY IF EXISTS "Tech update tasks on assigned job" ON public.job_tasks;
DROP POLICY IF EXISTS "Admins manage tasks" ON public.job_tasks;
CREATE POLICY "Staff manage tasks" ON public.job_tasks FOR ALL TO authenticated
USING (private.is_staff(auth.uid())) WITH CHECK (private.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Admins update bikes" ON public.motorcycles;
CREATE POLICY "Staff update bikes" ON public.motorcycles FOR UPDATE TO authenticated
USING (private.is_staff(auth.uid())) WITH CHECK (private.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Admins update any finding" ON public.job_inspection_findings;
CREATE POLICY "Staff update findings" ON public.job_inspection_findings FOR UPDATE TO authenticated
USING (private.is_staff(auth.uid())) WITH CHECK (private.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff create findings" ON public.job_inspection_findings;
CREATE POLICY "Staff create findings" ON public.job_inspection_findings FOR INSERT TO authenticated
WITH CHECK (private.is_staff(auth.uid()) AND created_by = auth.uid());

DROP POLICY IF EXISTS "Admins delete any finding" ON public.job_inspection_findings;
CREATE POLICY "Staff delete findings" ON public.job_inspection_findings FOR DELETE TO authenticated
USING (private.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Admins resolve approval requests" ON public.job_approval_requests;
CREATE POLICY "Staff resolve approval requests" ON public.job_approval_requests FOR UPDATE TO authenticated
USING (private.is_staff(auth.uid())) WITH CHECK (private.is_staff(auth.uid()));
