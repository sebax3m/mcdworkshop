
CREATE POLICY "staff read workshop photos" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'workshop-photos' AND public.is_staff(auth.uid()));
CREATE POLICY "staff upload workshop photos" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'workshop-photos' AND public.is_staff(auth.uid()));
CREATE POLICY "staff update workshop photos" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'workshop-photos' AND public.is_staff(auth.uid()));
CREATE POLICY "staff delete workshop photos" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'workshop-photos' AND public.is_staff(auth.uid()));
