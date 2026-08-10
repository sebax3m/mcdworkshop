-- 1. New job status value
ALTER TYPE public.job_status ADD VALUE IF NOT EXISTS 'waiting_approval';

-- 2. Approval requests
CREATE TABLE public.job_approval_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  requested_by uuid REFERENCES auth.users(id),
  requested_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','resolved')),
  decision text CHECK (decision IN ('approved_all','partial','declined_all')),
  resolved_by uuid REFERENCES auth.users(id),
  resolved_at timestamptz,
  customer_contact_method text CHECK (customer_contact_method IN ('phone','sms','email','in_person','other')),
  resolution_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX job_approval_requests_one_pending
  ON public.job_approval_requests (job_id) WHERE status = 'pending';
CREATE INDEX job_approval_requests_job_idx ON public.job_approval_requests (job_id);

GRANT SELECT, INSERT, UPDATE ON public.job_approval_requests TO authenticated;
GRANT ALL ON public.job_approval_requests TO service_role;
ALTER TABLE public.job_approval_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff view approval requests" ON public.job_approval_requests
  FOR SELECT TO authenticated USING (private.is_staff(auth.uid()));
CREATE POLICY "Staff create approval requests" ON public.job_approval_requests
  FOR INSERT TO authenticated
  WITH CHECK (private.is_staff(auth.uid()) AND requested_by = auth.uid() AND status = 'pending');
CREATE POLICY "Admins resolve approval requests" ON public.job_approval_requests
  FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'))
  WITH CHECK (private.has_role(auth.uid(), 'admin'));

-- 3. Inspection findings
CREATE TABLE public.job_inspection_findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  approval_request_id uuid REFERENCES public.job_approval_requests(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'other',
  severity text NOT NULL DEFAULT 'recommended'
    CHECK (severity IN ('information','recommended','important','safety_critical')),
  recommended_action text,
  estimated_labour numeric,
  estimated_parts_cost numeric,
  photo_path text,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','pending_approval','approved','declined','deferred')),
  decision_note text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX job_inspection_findings_job_idx ON public.job_inspection_findings (job_id);
CREATE INDEX job_inspection_findings_req_idx ON public.job_inspection_findings (approval_request_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_inspection_findings TO authenticated;
GRANT ALL ON public.job_inspection_findings TO service_role;
ALTER TABLE public.job_inspection_findings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff view findings" ON public.job_inspection_findings
  FOR SELECT TO authenticated USING (private.is_staff(auth.uid()));
CREATE POLICY "Staff create findings" ON public.job_inspection_findings
  FOR INSERT TO authenticated
  WITH CHECK (private.is_staff(auth.uid()) AND created_by = auth.uid() AND status IN ('draft','pending_approval'));
CREATE POLICY "Authors edit own open findings" ON public.job_inspection_findings
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid() AND status IN ('draft','pending_approval'))
  WITH CHECK (created_by = auth.uid() AND status IN ('draft','pending_approval'));
CREATE POLICY "Admins update any finding" ON public.job_inspection_findings
  FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'))
  WITH CHECK (private.has_role(auth.uid(), 'admin'));
CREATE POLICY "Authors delete own draft findings" ON public.job_inspection_findings
  FOR DELETE TO authenticated
  USING (created_by = auth.uid() AND status = 'draft');
CREATE POLICY "Admins delete draft findings" ON public.job_inspection_findings
  FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(), 'admin') AND status = 'draft');

CREATE TRIGGER trg_findings_updated_at BEFORE UPDATE ON public.job_inspection_findings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_approval_requests_updated_at BEFORE UPDATE ON public.job_approval_requests
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 4. Immutable audit timeline
CREATE TABLE public.job_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  summary text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX job_events_job_idx ON public.job_events (job_id, created_at);

GRANT SELECT, INSERT ON public.job_events TO authenticated;
GRANT ALL ON public.job_events TO service_role;
ALTER TABLE public.job_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff view job events" ON public.job_events
  FOR SELECT TO authenticated USING (private.is_staff(auth.uid()));
CREATE POLICY "Staff insert job events" ON public.job_events
  FOR INSERT TO authenticated
  WITH CHECK (private.is_staff(auth.uid()) AND created_by = auth.uid());

-- 5. Extend notifications for actionable admin items
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS job_id uuid REFERENCES public.jobs(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS approval_request_id uuid REFERENCES public.job_approval_requests(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS target_role text,
  ADD COLUMN IF NOT EXISTS requires_action boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz,
  ADD COLUMN IF NOT EXISTS resolved_by uuid REFERENCES auth.users(id);

CREATE POLICY "Admins resolve notifications" ON public.notifications
  FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'))
  WITH CHECK (private.has_role(auth.uid(), 'admin'));