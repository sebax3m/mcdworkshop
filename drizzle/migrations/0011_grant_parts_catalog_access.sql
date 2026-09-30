GRANT SELECT, INSERT, UPDATE, DELETE ON public.parts_catalog TO authenticated;
GRANT ALL ON public.parts_catalog TO service_role;
GRANT SELECT ON public.parts_purchase_history TO authenticated;
GRANT ALL ON public.parts_purchase_history TO service_role;