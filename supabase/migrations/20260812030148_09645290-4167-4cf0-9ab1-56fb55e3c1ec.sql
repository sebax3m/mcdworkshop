DROP POLICY IF EXISTS "Staff can view post bike branches" ON public.post_bike_branches;
DROP POLICY IF EXISTS "Staff can insert post bike branches" ON public.post_bike_branches;
DROP POLICY IF EXISTS "Staff can update post bike branches" ON public.post_bike_branches;
DROP POLICY IF EXISTS "Staff can delete post bike branches" ON public.post_bike_branches;
CREATE POLICY "staff read post_bike_branches" ON public.post_bike_branches FOR SELECT TO authenticated USING (private.is_staff(auth.uid()));
CREATE POLICY "staff write post_bike_branches" ON public.post_bike_branches FOR ALL TO authenticated USING (private.is_staff(auth.uid())) WITH CHECK (private.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff can view post bikes" ON public.post_bikes;
DROP POLICY IF EXISTS "Staff can insert post bikes" ON public.post_bikes;
DROP POLICY IF EXISTS "Staff can update post bikes" ON public.post_bikes;
DROP POLICY IF EXISTS "Staff can delete post bikes" ON public.post_bikes;
CREATE POLICY "staff read post_bikes" ON public.post_bikes FOR SELECT TO authenticated USING (private.is_staff(auth.uid()));
CREATE POLICY "staff write post_bikes" ON public.post_bikes FOR ALL TO authenticated USING (private.is_staff(auth.uid())) WITH CHECK (private.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff can view post bike services" ON public.post_bike_services;
DROP POLICY IF EXISTS "Staff can insert post bike services" ON public.post_bike_services;
DROP POLICY IF EXISTS "Staff can update post bike services" ON public.post_bike_services;
DROP POLICY IF EXISTS "Staff can delete post bike services" ON public.post_bike_services;
CREATE POLICY "staff read post_bike_services" ON public.post_bike_services FOR SELECT TO authenticated USING (private.is_staff(auth.uid()));
CREATE POLICY "staff write post_bike_services" ON public.post_bike_services FOR ALL TO authenticated USING (private.is_staff(auth.uid())) WITH CHECK (private.is_staff(auth.uid()));