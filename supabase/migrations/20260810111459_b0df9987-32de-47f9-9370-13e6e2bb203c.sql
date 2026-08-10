DROP POLICY IF EXISTS "staff read notifications" ON public.notifications;

CREATE POLICY "staff read notifications"
ON public.notifications
FOR SELECT
TO authenticated
USING (
  private.is_staff(auth.uid())
  AND (
    NOT (requires_action AND target_role = 'admin')
    OR private.has_role(auth.uid(), 'admin'::app_role)
  )
);