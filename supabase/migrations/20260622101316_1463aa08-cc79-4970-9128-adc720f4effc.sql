CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION private.is_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
  )
$$;

GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_staff(uuid) TO authenticated;

ALTER POLICY "staff read bookings" ON public.bookings USING (private.is_staff(auth.uid()));
ALTER POLICY "staff write bookings" ON public.bookings USING (private.is_staff(auth.uid())) WITH CHECK (private.is_staff(auth.uid()));

ALTER POLICY "Admins manage clock" ON public.clock_events USING (private.has_role(auth.uid(), 'admin')) WITH CHECK (private.has_role(auth.uid(), 'admin'));
ALTER POLICY "Staff view clock" ON public.clock_events USING (private.is_staff(auth.uid()));

ALTER POLICY "Admins delete customers" ON public.customers USING (private.has_role(auth.uid(), 'admin'));
ALTER POLICY "Admins update customers" ON public.customers USING (private.has_role(auth.uid(), 'admin'));
ALTER POLICY "Staff create customers" ON public.customers WITH CHECK (private.is_staff(auth.uid()));
ALTER POLICY "Staff view customers" ON public.customers USING (private.is_staff(auth.uid()));

ALTER POLICY "staff read dyno" ON public.dyno_results USING (private.is_staff(auth.uid()));
ALTER POLICY "staff write dyno" ON public.dyno_results USING (private.is_staff(auth.uid())) WITH CHECK (private.is_staff(auth.uid()));

ALTER POLICY "staff read invoices" ON public.invoices USING (private.is_staff(auth.uid()));
ALTER POLICY "staff write invoices" ON public.invoices USING (private.is_staff(auth.uid())) WITH CHECK (private.is_staff(auth.uid()));

ALTER POLICY "Author or admin delete note" ON public.job_notes USING (author_id = auth.uid() OR private.has_role(auth.uid(), 'admin'));
ALTER POLICY "Staff add notes" ON public.job_notes WITH CHECK (private.is_staff(auth.uid()) AND author_id = auth.uid());
ALTER POLICY "Staff view notes" ON public.job_notes USING (private.is_staff(auth.uid()));

ALTER POLICY "Staff add photos" ON public.job_photos WITH CHECK (private.is_staff(auth.uid()) AND uploaded_by = auth.uid());
ALTER POLICY "Staff view photos" ON public.job_photos USING (private.is_staff(auth.uid()));
ALTER POLICY "Uploader or admin delete photo" ON public.job_photos USING (uploaded_by = auth.uid() OR private.has_role(auth.uid(), 'admin'));

ALTER POLICY "Admins manage tasks" ON public.job_tasks USING (private.has_role(auth.uid(), 'admin')) WITH CHECK (private.has_role(auth.uid(), 'admin'));
ALTER POLICY "Staff view tasks" ON public.job_tasks USING (private.is_staff(auth.uid()));

ALTER POLICY "Admins create jobs" ON public.jobs WITH CHECK (private.has_role(auth.uid(), 'admin'));
ALTER POLICY "Admins delete jobs" ON public.jobs USING (private.has_role(auth.uid(), 'admin'));
ALTER POLICY "Admins update any job" ON public.jobs USING (private.has_role(auth.uid(), 'admin'));
ALTER POLICY "Staff view jobs" ON public.jobs USING (private.is_staff(auth.uid()));

ALTER POLICY "Admins delete bikes" ON public.motorcycles USING (private.has_role(auth.uid(), 'admin'));
ALTER POLICY "Admins update bikes" ON public.motorcycles USING (private.has_role(auth.uid(), 'admin'));
ALTER POLICY "Staff create bikes" ON public.motorcycles WITH CHECK (private.is_staff(auth.uid()));
ALTER POLICY "Staff view bikes" ON public.motorcycles USING (private.is_staff(auth.uid()));

ALTER POLICY "staff read parts" ON public.parts USING (private.is_staff(auth.uid()));
ALTER POLICY "staff write parts" ON public.parts USING (private.is_staff(auth.uid())) WITH CHECK (private.is_staff(auth.uid()));

ALTER POLICY "Admins can update any profile" ON public.profiles USING (private.has_role(auth.uid(), 'admin'));
ALTER POLICY "Staff can view all profiles" ON public.profiles USING (private.is_staff(auth.uid()));

ALTER POLICY "Admins manage templates" ON public.service_templates USING (private.has_role(auth.uid(), 'admin')) WITH CHECK (private.has_role(auth.uid(), 'admin'));
ALTER POLICY "Staff view templates" ON public.service_templates USING (private.is_staff(auth.uid()));

ALTER POLICY "Admins manage all time" ON public.time_entries USING (private.has_role(auth.uid(), 'admin')) WITH CHECK (private.has_role(auth.uid(), 'admin'));
ALTER POLICY "Staff view time" ON public.time_entries USING (private.is_staff(auth.uid()));

ALTER POLICY "Admins manage roles" ON public.user_roles USING (private.has_role(auth.uid(), 'admin')) WITH CHECK (private.has_role(auth.uid(), 'admin'));
ALTER POLICY "Staff can view roles" ON public.user_roles USING (private.is_staff(auth.uid()));

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_staff(uuid) FROM PUBLIC, anon, authenticated;