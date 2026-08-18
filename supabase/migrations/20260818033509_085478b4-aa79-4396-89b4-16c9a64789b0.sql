CREATE POLICY "Staff can delete invoice drafts" ON public.job_invoice_drafts FOR DELETE TO authenticated USING (private.is_staff(auth.uid()));

DROP POLICY IF EXISTS "mcd_tech_settings_read" ON public.mcd_tech_settings;
CREATE POLICY "mcd_tech_settings_read" ON public.mcd_tech_settings FOR SELECT TO authenticated USING (private.is_staff(auth.uid()));