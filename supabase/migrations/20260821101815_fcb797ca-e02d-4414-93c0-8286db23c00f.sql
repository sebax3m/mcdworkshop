REVOKE INSERT, UPDATE, DELETE ON public.mcd_tech_settings FROM authenticated;
GRANT INSERT, UPDATE ON public.mcd_tech_settings TO authenticated;

DROP POLICY IF EXISTS "mcd_tech_settings_admin_insert" ON public.mcd_tech_settings;
CREATE POLICY "mcd_tech_settings_admin_insert" ON public.mcd_tech_settings
  FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role) AND id = true);

DROP POLICY IF EXISTS "mcd_tech_settings_admin_write" ON public.mcd_tech_settings;
CREATE POLICY "mcd_tech_settings_admin_update" ON public.mcd_tech_settings
  FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));