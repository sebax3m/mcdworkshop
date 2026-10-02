DROP POLICY "Tech manage own time" ON public.time_entries;

CREATE POLICY "Tech insert own time"
ON public.time_entries FOR INSERT TO authenticated
WITH CHECK (technician_id = auth.uid());

CREATE POLICY "Tech update own time"
ON public.time_entries FOR UPDATE TO authenticated
USING (technician_id = auth.uid())
WITH CHECK (technician_id = auth.uid());

CREATE OR REPLACE FUNCTION public.guard_time_entry_edit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF private.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;
  -- Note-only edits are allowed for the entry owner.
  IF NEW.started_at IS NOT DISTINCT FROM OLD.started_at
     AND NEW.ended_at IS NOT DISTINCT FROM OLD.ended_at
     AND NEW.minutes IS NOT DISTINCT FROM OLD.minutes
     AND NEW.job_id IS NOT DISTINCT FROM OLD.job_id
     AND NEW.technician_id IS NOT DISTINCT FROM OLD.technician_id THEN
    RETURN NEW;
  END IF;
  -- Closing an open entry (clock out / stop timer) is allowed.
  IF OLD.ended_at IS NULL
     AND NEW.ended_at IS NOT NULL
     AND NEW.started_at IS NOT DISTINCT FROM OLD.started_at
     AND NEW.job_id IS NOT DISTINCT FROM OLD.job_id
     AND NEW.technician_id IS NOT DISTINCT FROM OLD.technician_id THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Only admins can edit time entry times';
END;
$$;

CREATE TRIGGER guard_time_entry_edit
BEFORE UPDATE ON public.time_entries
FOR EACH ROW EXECUTE FUNCTION public.guard_time_entry_edit();