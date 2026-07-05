-- Allow authors (and admins) to edit their own job notes
CREATE POLICY "Author or admin update note"
ON public.job_notes
FOR UPDATE
TO authenticated
USING ((author_id = auth.uid()) OR private.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK ((author_id = auth.uid()) OR private.has_role(auth.uid(), 'admin'::app_role));

-- Allow uploaders (and admins) to edit their own job photo captions/metadata
CREATE POLICY "Uploader or admin update photo"
ON public.job_photos
FOR UPDATE
TO authenticated
USING ((uploaded_by = auth.uid()) OR private.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK ((uploaded_by = auth.uid()) OR private.has_role(auth.uid(), 'admin'::app_role));