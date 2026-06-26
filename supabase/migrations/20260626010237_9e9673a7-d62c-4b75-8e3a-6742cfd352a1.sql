
DROP POLICY IF EXISTS "Authenticated can read insurance_claims" ON public.insurance_claims;
DROP POLICY IF EXISTS "Authenticated can write insurance_claims" ON public.insurance_claims;
DROP POLICY IF EXISTS "Authenticated can read insurance_claim_events" ON public.insurance_claim_events;
DROP POLICY IF EXISTS "Authenticated can write insurance_claim_events" ON public.insurance_claim_events;

CREATE POLICY "staff read insurance_claims"
  ON public.insurance_claims FOR SELECT TO authenticated
  USING (private.is_staff(auth.uid()));
CREATE POLICY "staff write insurance_claims"
  ON public.insurance_claims FOR ALL TO authenticated
  USING (private.is_staff(auth.uid()))
  WITH CHECK (private.is_staff(auth.uid()));

CREATE POLICY "staff read insurance_claim_events"
  ON public.insurance_claim_events FOR SELECT TO authenticated
  USING (private.is_staff(auth.uid()));
CREATE POLICY "staff write insurance_claim_events"
  ON public.insurance_claim_events FOR ALL TO authenticated
  USING (private.is_staff(auth.uid()))
  WITH CHECK (private.is_staff(auth.uid()));
