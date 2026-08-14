-- garage_observations
DROP POLICY IF EXISTS "Staff read observations" ON public.garage_observations;
DROP POLICY IF EXISTS "Staff add observations" ON public.garage_observations;
CREATE POLICY "Staff read observations" ON public.garage_observations FOR SELECT TO authenticated USING (private.is_staff(auth.uid()));
CREATE POLICY "Staff add observations" ON public.garage_observations FOR INSERT TO authenticated WITH CHECK (private.is_staff(auth.uid()));

-- motorcycle_knowledge
DROP POLICY IF EXISTS "Staff read bike knowledge" ON public.motorcycle_knowledge;
DROP POLICY IF EXISTS "Staff add bike knowledge" ON public.motorcycle_knowledge;
DROP POLICY IF EXISTS "Staff update bike knowledge" ON public.motorcycle_knowledge;
CREATE POLICY "Staff read bike knowledge" ON public.motorcycle_knowledge FOR SELECT TO authenticated USING (private.is_staff(auth.uid()));
CREATE POLICY "Staff add bike knowledge" ON public.motorcycle_knowledge FOR INSERT TO authenticated WITH CHECK (private.is_staff(auth.uid()));
CREATE POLICY "Staff update bike knowledge" ON public.motorcycle_knowledge FOR UPDATE TO authenticated USING (private.is_staff(auth.uid())) WITH CHECK (private.is_staff(auth.uid()));

-- garage_research_requests
DROP POLICY IF EXISTS "Staff read research requests" ON public.garage_research_requests;
DROP POLICY IF EXISTS "Staff add research requests" ON public.garage_research_requests;
DROP POLICY IF EXISTS "Staff edit research requests" ON public.garage_research_requests;
CREATE POLICY "Staff read research requests" ON public.garage_research_requests FOR SELECT TO authenticated USING (private.is_staff(auth.uid()));
CREATE POLICY "Staff add research requests" ON public.garage_research_requests FOR INSERT TO authenticated WITH CHECK (private.is_staff(auth.uid()));
CREATE POLICY "Staff edit research requests" ON public.garage_research_requests FOR UPDATE TO authenticated USING (private.is_staff(auth.uid())) WITH CHECK (private.is_staff(auth.uid()));

-- garage_research_results
DROP POLICY IF EXISTS "Staff read research results" ON public.garage_research_results;
DROP POLICY IF EXISTS "Staff add research results" ON public.garage_research_results;
DROP POLICY IF EXISTS "Staff review research results" ON public.garage_research_results;
CREATE POLICY "Staff read research results" ON public.garage_research_results FOR SELECT TO authenticated USING (private.is_staff(auth.uid()));
CREATE POLICY "Staff add research results" ON public.garage_research_results FOR INSERT TO authenticated WITH CHECK (private.is_staff(auth.uid()));
CREATE POLICY "Staff review research results" ON public.garage_research_results FOR UPDATE TO authenticated USING (private.is_staff(auth.uid())) WITH CHECK (private.is_staff(auth.uid()));

-- garage_bike_overrides
DROP POLICY IF EXISTS "Staff read bike overrides" ON public.garage_bike_overrides;
DROP POLICY IF EXISTS "Staff add bike overrides" ON public.garage_bike_overrides;
DROP POLICY IF EXISTS "Staff edit bike overrides" ON public.garage_bike_overrides;
CREATE POLICY "Staff read bike overrides" ON public.garage_bike_overrides FOR SELECT TO authenticated USING (private.is_staff(auth.uid()));
CREATE POLICY "Staff add bike overrides" ON public.garage_bike_overrides FOR INSERT TO authenticated WITH CHECK (private.is_staff(auth.uid()));
CREATE POLICY "Staff edit bike overrides" ON public.garage_bike_overrides FOR UPDATE TO authenticated USING (private.is_staff(auth.uid())) WITH CHECK (private.is_staff(auth.uid()));

-- motorcycle_model_links
DROP POLICY IF EXISTS "links readable by staff" ON public.motorcycle_model_links;
DROP POLICY IF EXISTS "links writable by staff" ON public.motorcycle_model_links;
CREATE POLICY "links readable by staff" ON public.motorcycle_model_links FOR SELECT TO authenticated USING (private.is_staff(auth.uid()));
CREATE POLICY "links writable by staff" ON public.motorcycle_model_links FOR ALL TO authenticated USING (private.is_staff(auth.uid())) WITH CHECK (private.is_staff(auth.uid()));

-- garage_update_proposals
DROP POLICY IF EXISTS "staff read proposals" ON public.garage_update_proposals;
DROP POLICY IF EXISTS "staff submit proposals" ON public.garage_update_proposals;
CREATE POLICY "staff read proposals" ON public.garage_update_proposals FOR SELECT TO authenticated USING (private.is_staff(auth.uid()));
CREATE POLICY "staff submit proposals" ON public.garage_update_proposals FOR INSERT TO authenticated WITH CHECK (private.is_staff(auth.uid()) AND auth.uid() = proposed_by);

-- garage_revisions
DROP POLICY IF EXISTS "staff read revisions" ON public.garage_revisions;
DROP POLICY IF EXISTS "staff insert revisions" ON public.garage_revisions;
CREATE POLICY "staff read revisions" ON public.garage_revisions FOR SELECT TO authenticated USING (private.is_staff(auth.uid()));
CREATE POLICY "staff insert revisions" ON public.garage_revisions FOR INSERT TO authenticated WITH CHECK (private.is_staff(auth.uid()));

-- garage_queries
DROP POLICY IF EXISTS "staff read queries" ON public.garage_queries;
DROP POLICY IF EXISTS "staff log queries" ON public.garage_queries;
CREATE POLICY "staff read queries" ON public.garage_queries FOR SELECT TO authenticated USING (private.is_staff(auth.uid()));
CREATE POLICY "staff log queries" ON public.garage_queries FOR INSERT TO authenticated WITH CHECK (private.is_staff(auth.uid()) AND asked_by = auth.uid());

-- garage_answer_feedback
DROP POLICY IF EXISTS "staff read feedback" ON public.garage_answer_feedback;
DROP POLICY IF EXISTS "staff give feedback" ON public.garage_answer_feedback;
CREATE POLICY "staff read feedback" ON public.garage_answer_feedback FOR SELECT TO authenticated USING (private.is_staff(auth.uid()));
CREATE POLICY "staff give feedback" ON public.garage_answer_feedback FOR INSERT TO authenticated WITH CHECK (private.is_staff(auth.uid()) AND created_by = auth.uid());

-- garage_notes
DROP POLICY IF EXISTS "staff read garage notes" ON public.garage_notes;
DROP POLICY IF EXISTS "staff add garage notes" ON public.garage_notes;
CREATE POLICY "staff read garage notes" ON public.garage_notes FOR SELECT TO authenticated USING (private.is_staff(auth.uid()));
CREATE POLICY "staff add garage notes" ON public.garage_notes FOR INSERT TO authenticated WITH CHECK (private.is_staff(auth.uid()) AND auth.uid() = created_by);

-- garage_tech_specs
DROP POLICY IF EXISTS "Staff can read tech specs" ON public.garage_tech_specs;
DROP POLICY IF EXISTS "Staff can add tech specs" ON public.garage_tech_specs;
DROP POLICY IF EXISTS "Staff can edit tech specs" ON public.garage_tech_specs;
CREATE POLICY "Staff can read tech specs" ON public.garage_tech_specs FOR SELECT TO authenticated USING (private.is_staff(auth.uid()));
CREATE POLICY "Staff can add tech specs" ON public.garage_tech_specs FOR INSERT TO authenticated WITH CHECK (private.is_staff(auth.uid()));
CREATE POLICY "Staff can edit tech specs" ON public.garage_tech_specs FOR UPDATE TO authenticated USING (private.is_staff(auth.uid())) WITH CHECK (private.is_staff(auth.uid()));

-- job_invoice_drafts
DROP POLICY IF EXISTS "Staff can read invoice drafts" ON public.job_invoice_drafts;
DROP POLICY IF EXISTS "Staff can create invoice drafts" ON public.job_invoice_drafts;
DROP POLICY IF EXISTS "Staff can update invoice drafts" ON public.job_invoice_drafts;
CREATE POLICY "Staff can read invoice drafts" ON public.job_invoice_drafts FOR SELECT TO authenticated USING (private.is_staff(auth.uid()));
CREATE POLICY "Staff can create invoice drafts" ON public.job_invoice_drafts FOR INSERT TO authenticated WITH CHECK (private.is_staff(auth.uid()));
CREATE POLICY "Staff can update invoice drafts" ON public.job_invoice_drafts FOR UPDATE TO authenticated USING (private.is_staff(auth.uid())) WITH CHECK (private.is_staff(auth.uid()));

-- storage: workshop docs read
DROP POLICY IF EXISTS "staff read workshop docs" ON storage.objects;
CREATE POLICY "staff read workshop docs" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'workshop-docs' AND private.is_staff(auth.uid()));