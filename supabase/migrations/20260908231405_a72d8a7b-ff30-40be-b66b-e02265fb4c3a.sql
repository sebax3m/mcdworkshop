DROP POLICY IF EXISTS "Staff can view payments" ON public.invoice_payments;
DROP POLICY IF EXISTS "Staff can add payments" ON public.invoice_payments;
DROP POLICY IF EXISTS "Staff can update payments" ON public.invoice_payments;
DROP POLICY IF EXISTS "Staff can delete payments" ON public.invoice_payments;

CREATE POLICY "Staff can view payments" ON public.invoice_payments FOR SELECT TO authenticated USING (private.is_staff(auth.uid()));
CREATE POLICY "Staff can add payments" ON public.invoice_payments FOR INSERT TO authenticated WITH CHECK (private.is_staff(auth.uid()));
CREATE POLICY "Staff can update payments" ON public.invoice_payments FOR UPDATE TO authenticated USING (private.is_staff(auth.uid())) WITH CHECK (private.is_staff(auth.uid()));
CREATE POLICY "Staff can delete payments" ON public.invoice_payments FOR DELETE TO authenticated USING (private.is_staff(auth.uid()));