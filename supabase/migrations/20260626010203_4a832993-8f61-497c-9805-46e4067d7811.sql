
-- Insurance claim pipeline
CREATE TYPE public.insurance_claim_status AS ENUM (
  'intake',
  'assessing',
  'quote_in_progress',
  'quote_sent',
  'approved',
  'declined',
  'waiting_parts',
  'in_repair',
  'ready_for_pickup',
  'closed'
);

CREATE SEQUENCE IF NOT EXISTS public.insurance_claim_number_seq;

-- Main claims table
CREATE TABLE public.insurance_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_number text UNIQUE,
  insurer_name text,
  insurer_claim_ref text,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  motorcycle_id uuid REFERENCES public.motorcycles(id) ON DELETE SET NULL,
  job_id uuid REFERENCES public.jobs(id) ON DELETE SET NULL,
  status public.insurance_claim_status NOT NULL DEFAULT 'intake',
  date_received date NOT NULL DEFAULT current_date,
  quote_started_at timestamptz,
  quote_sent_at timestamptz,
  approved_at timestamptz,
  declined_at timestamptz,
  parts_ordered_at timestamptz,
  parts_received_at timestamptz,
  repair_started_at timestamptz,
  ready_for_pickup_at timestamptz,
  closed_at timestamptz,
  bike_with_customer boolean NOT NULL DEFAULT false,
  expected_return_date date,
  quote_amount numeric(10,2),
  approved_amount numeric(10,2),
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.insurance_claims TO authenticated;
GRANT ALL ON public.insurance_claims TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.insurance_claim_number_seq TO authenticated, service_role;

ALTER TABLE public.insurance_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read insurance_claims"
  ON public.insurance_claims FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can write insurance_claims"
  ON public.insurance_claims FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Timeline / event log
CREATE TABLE public.insurance_claim_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id uuid NOT NULL REFERENCES public.insurance_claims(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  from_status public.insurance_claim_status,
  to_status public.insurance_claim_status,
  note text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.insurance_claim_events TO authenticated;
GRANT ALL ON public.insurance_claim_events TO service_role;

ALTER TABLE public.insurance_claim_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read insurance_claim_events"
  ON public.insurance_claim_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can write insurance_claim_events"
  ON public.insurance_claim_events FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_claim_events_claim ON public.insurance_claim_events(claim_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_claims_status ON public.insurance_claims(status);
CREATE INDEX IF NOT EXISTS idx_claims_customer ON public.insurance_claims(customer_id);
CREATE INDEX IF NOT EXISTS idx_claims_motorcycle ON public.insurance_claims(motorcycle_id);

-- Auto claim number + timestamp helpers
CREATE OR REPLACE FUNCTION public.set_insurance_claim_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.claim_number IS NULL OR NEW.claim_number = '' THEN
    NEW.claim_number := 'MD-INS-' || to_char(now(),'YYYY') || '-' ||
      lpad(nextval('public.insurance_claim_number_seq')::text, 5, '0');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_insurance_claim_number
BEFORE INSERT ON public.insurance_claims
FOR EACH ROW EXECUTE FUNCTION public.set_insurance_claim_number();

CREATE TRIGGER trg_touch_insurance_claims_updated
BEFORE UPDATE ON public.insurance_claims
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Stamp stage timestamps + log event whenever status changes
CREATE OR REPLACE FUNCTION public.log_insurance_claim_status_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    -- stamp date for the new stage if empty
    IF NEW.status = 'quote_in_progress' AND NEW.quote_started_at IS NULL THEN NEW.quote_started_at := now(); END IF;
    IF NEW.status = 'quote_sent'        AND NEW.quote_sent_at    IS NULL THEN NEW.quote_sent_at    := now(); END IF;
    IF NEW.status = 'approved'          AND NEW.approved_at      IS NULL THEN NEW.approved_at      := now(); END IF;
    IF NEW.status = 'declined'          AND NEW.declined_at      IS NULL THEN NEW.declined_at      := now(); END IF;
    IF NEW.status = 'in_repair'         AND NEW.repair_started_at IS NULL THEN NEW.repair_started_at := now(); END IF;
    IF NEW.status = 'ready_for_pickup'  AND NEW.ready_for_pickup_at IS NULL THEN NEW.ready_for_pickup_at := now(); END IF;
    IF NEW.status = 'closed'            AND NEW.closed_at        IS NULL THEN NEW.closed_at        := now(); END IF;

    INSERT INTO public.insurance_claim_events(claim_id, event_type, from_status, to_status, created_by)
    VALUES (NEW.id, 'status_changed', OLD.status, NEW.status, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_log_insurance_claim_status_change
BEFORE UPDATE ON public.insurance_claims
FOR EACH ROW EXECUTE FUNCTION public.log_insurance_claim_status_change();
