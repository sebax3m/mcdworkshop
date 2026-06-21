
-- =========================================================
-- ENUMS
-- =========================================================
CREATE TYPE public.app_role AS ENUM ('admin', 'technician');
CREATE TYPE public.job_status AS ENUM ('new','assigned','in_progress','waiting_parts','ready_for_pickup','completed');
CREATE TYPE public.clock_event_type AS ENUM ('clock_in','clock_out','break_start','break_end');

-- =========================================================
-- PROFILES
-- =========================================================
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  email text,
  phone text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- USER ROLES (separate table; never on profiles)
-- =========================================================
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id)
$$;

-- updated_at helper
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- auto-create profile on signup; first user becomes admin, rest technicians
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  user_count int;
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name',''), NEW.email);

  SELECT count(*) INTO user_count FROM auth.users;
  IF user_count <= 1 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'technician');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- profiles policies
CREATE POLICY "Staff can view all profiles" ON public.profiles
FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Users can update own profile" ON public.profiles
FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Admins can update any profile" ON public.profiles
FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- user_roles policies
CREATE POLICY "Staff can view roles" ON public.user_roles
FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Admins manage roles" ON public.user_roles
FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin'))
WITH CHECK (public.has_role(auth.uid(),'admin'));

-- =========================================================
-- CUSTOMERS
-- =========================================================
CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name text NOT NULL,
  last_name text NOT NULL DEFAULT '',
  phone text,
  email text,
  address text,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER customers_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE POLICY "Staff view customers" ON public.customers FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff create customers" ON public.customers FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Admins update customers" ON public.customers FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins delete customers" ON public.customers FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- =========================================================
-- MOTORCYCLES
-- =========================================================
CREATE TABLE public.motorcycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  make text NOT NULL,
  model text NOT NULL,
  year int,
  vin text,
  rego text,
  mileage int,
  ecu_info text,
  modifications text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.motorcycles TO authenticated;
GRANT ALL ON public.motorcycles TO service_role;
ALTER TABLE public.motorcycles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER motorcycles_updated_at BEFORE UPDATE ON public.motorcycles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX motorcycles_customer_idx ON public.motorcycles(customer_id);

CREATE POLICY "Staff view bikes" ON public.motorcycles FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff create bikes" ON public.motorcycles FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Admins update bikes" ON public.motorcycles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins delete bikes" ON public.motorcycles FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- =========================================================
-- SERVICE TEMPLATES
-- =========================================================
CREATE TABLE public.service_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  estimated_hours numeric(5,2) DEFAULT 1,
  tasks jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_templates TO authenticated;
GRANT ALL ON public.service_templates TO service_role;
ALTER TABLE public.service_templates ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER service_templates_updated_at BEFORE UPDATE ON public.service_templates FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE POLICY "Staff view templates" ON public.service_templates FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Admins manage templates" ON public.service_templates FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Seed templates
INSERT INTO public.service_templates (name, description, estimated_hours, sort_order, tasks) VALUES
('Basic Service','Quick maintenance — fluids and safety checks',1.5,1,
 '[{"label":"Engine Oil"},{"label":"Oil Filter"},{"label":"Chain Inspection"},{"label":"Tyre Pressure Check"},{"label":"Brake Inspection"},{"label":"Battery Check"}]'::jsonb),
('Standard Service','Basic service plus filters, plugs and suspension',2.5,2,
 '[{"label":"Engine Oil"},{"label":"Oil Filter"},{"label":"Chain Inspection"},{"label":"Tyre Pressure Check"},{"label":"Brake Inspection"},{"label":"Battery Check"},{"label":"Air Filter Inspection"},{"label":"Spark Plug Inspection"},{"label":"Suspension Inspection"},{"label":"Cooling System Inspection"}]'::jsonb),
('Full Service','Comprehensive service including valves and diagnostics',4,3,
 '[{"label":"Engine Oil"},{"label":"Oil Filter"},{"label":"Chain Inspection"},{"label":"Tyre Pressure Check"},{"label":"Brake Inspection"},{"label":"Battery Check"},{"label":"Air Filter Inspection"},{"label":"Spark Plug Inspection"},{"label":"Suspension Inspection"},{"label":"Cooling System Inspection"},{"label":"Valve Clearance Check"},{"label":"Throttle Body Synchronisation"},{"label":"Fuel System Inspection"},{"label":"Full Diagnostic Scan"}]'::jsonb),
('Dyno Tune','Performance tuning on the dyno',3,4,
 '[{"label":"Baseline Dyno Run"},{"label":"ECU Read"},{"label":"Custom Mapping"},{"label":"AFR Verification"},{"label":"Final Dyno Run"},{"label":"Power Report"}]'::jsonb);

-- =========================================================
-- JOBS
-- =========================================================
CREATE TABLE public.jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_number serial UNIQUE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  motorcycle_id uuid NOT NULL REFERENCES public.motorcycles(id) ON DELETE RESTRICT,
  template_id uuid REFERENCES public.service_templates(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  complaint text,
  technician_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status public.job_status NOT NULL DEFAULT 'new',
  odometer int,
  estimated_hours numeric(5,2),
  scheduled_for date,
  started_at timestamptz,
  completed_at timestamptz,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jobs TO authenticated;
GRANT ALL ON public.jobs TO service_role;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER jobs_updated_at BEFORE UPDATE ON public.jobs FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX jobs_status_idx ON public.jobs(status);
CREATE INDEX jobs_tech_idx ON public.jobs(technician_id);

CREATE POLICY "Staff view jobs" ON public.jobs FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Admins create jobs" ON public.jobs FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins update any job" ON public.jobs FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Tech update assigned job" ON public.jobs FOR UPDATE TO authenticated
USING (technician_id = auth.uid()) WITH CHECK (technician_id = auth.uid());
CREATE POLICY "Admins delete jobs" ON public.jobs FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- =========================================================
-- JOB TASKS
-- =========================================================
CREATE TABLE public.job_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  label text NOT NULL,
  is_done boolean NOT NULL DEFAULT false,
  done_by uuid REFERENCES auth.users(id),
  done_at timestamptz,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_tasks TO authenticated;
GRANT ALL ON public.job_tasks TO service_role;
ALTER TABLE public.job_tasks ENABLE ROW LEVEL SECURITY;
CREATE INDEX job_tasks_job_idx ON public.job_tasks(job_id);

CREATE POLICY "Staff view tasks" ON public.job_tasks FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Admins manage tasks" ON public.job_tasks FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Tech update tasks on assigned job" ON public.job_tasks FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = job_id AND j.technician_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = job_id AND j.technician_id = auth.uid()));

-- =========================================================
-- JOB NOTES
-- =========================================================
CREATE TABLE public.job_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id),
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_notes TO authenticated;
GRANT ALL ON public.job_notes TO service_role;
ALTER TABLE public.job_notes ENABLE ROW LEVEL SECURITY;
CREATE INDEX job_notes_job_idx ON public.job_notes(job_id);

CREATE POLICY "Staff view notes" ON public.job_notes FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff add notes" ON public.job_notes FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()) AND author_id = auth.uid());
CREATE POLICY "Author or admin delete note" ON public.job_notes FOR DELETE TO authenticated USING (author_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- =========================================================
-- JOB PHOTOS
-- =========================================================
CREATE TABLE public.job_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  uploaded_by uuid NOT NULL REFERENCES auth.users(id),
  storage_path text NOT NULL,
  caption text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_photos TO authenticated;
GRANT ALL ON public.job_photos TO service_role;
ALTER TABLE public.job_photos ENABLE ROW LEVEL SECURITY;
CREATE INDEX job_photos_job_idx ON public.job_photos(job_id);

CREATE POLICY "Staff view photos" ON public.job_photos FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff add photos" ON public.job_photos FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()) AND uploaded_by = auth.uid());
CREATE POLICY "Uploader or admin delete photo" ON public.job_photos FOR DELETE TO authenticated USING (uploaded_by = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- =========================================================
-- TIME ENTRIES (per-job labour timer)
-- =========================================================
CREATE TABLE public.time_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  technician_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  minutes int,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.time_entries TO authenticated;
GRANT ALL ON public.time_entries TO service_role;
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;
CREATE INDEX time_entries_job_idx ON public.time_entries(job_id);
CREATE INDEX time_entries_tech_idx ON public.time_entries(technician_id);

CREATE POLICY "Staff view time" ON public.time_entries FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Tech manage own time" ON public.time_entries FOR ALL TO authenticated
USING (technician_id = auth.uid()) WITH CHECK (technician_id = auth.uid());
CREATE POLICY "Admins manage all time" ON public.time_entries FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- =========================================================
-- CLOCK EVENTS
-- =========================================================
CREATE TABLE public.clock_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type public.clock_event_type NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  note text
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clock_events TO authenticated;
GRANT ALL ON public.clock_events TO service_role;
ALTER TABLE public.clock_events ENABLE ROW LEVEL SECURITY;
CREATE INDEX clock_events_user_idx ON public.clock_events(user_id, occurred_at DESC);

CREATE POLICY "Staff view clock" ON public.clock_events FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "User insert own clock" ON public.clock_events FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins manage clock" ON public.clock_events FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
