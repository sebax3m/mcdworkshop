CREATE TABLE public.activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  record_id text,
  action text NOT NULL,
  old_data jsonb,
  new_data jsonb,
  actor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  restored_at timestamptz,
  restored_by uuid
);
CREATE INDEX activity_log_created_idx ON public.activity_log (created_at DESC);
CREATE INDEX activity_log_table_idx ON public.activity_log (table_name, action);
GRANT SELECT ON public.activity_log TO authenticated;
GRANT ALL ON public.activity_log TO service_role;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read activity" ON public.activity_log FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.log_activity() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.activity_log(table_name, record_id, action, old_data, actor_id)
    VALUES (TG_TABLE_NAME, (to_jsonb(OLD)->>'id'), 'delete', to_jsonb(OLD), auth.uid());
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO public.activity_log(table_name, record_id, action, new_data, actor_id)
    VALUES (TG_TABLE_NAME, (to_jsonb(NEW)->>'id'), 'insert', to_jsonb(NEW), auth.uid());
  ELSE
    IF to_jsonb(OLD) - 'updated_at' IS DISTINCT FROM to_jsonb(NEW) - 'updated_at' THEN
      INSERT INTO public.activity_log(table_name, record_id, action, old_data, new_data, actor_id)
      VALUES (TG_TABLE_NAME, (to_jsonb(NEW)->>'id'), 'update', to_jsonb(OLD), to_jsonb(NEW), auth.uid());
    END IF;
  END IF;
  IF random() < 0.01 THEN
    DELETE FROM public.activity_log WHERE created_at < now() - interval '30 days';
  END IF;
  RETURN NULL;
END $$;
REVOKE EXECUTE ON FUNCTION public.log_activity() FROM PUBLIC, anon, authenticated;

DO $$
DECLARE t text;
BEGIN
  -- full activity (create/edit/delete)
  FOREACH t IN ARRAY ARRAY['bookings','invoices','jobs','customers','invoice_payments','insurance_claims'] LOOP
    EXECUTE format('CREATE TRIGGER zz_activity_log AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.log_activity()', t);
  END LOOP;
  -- deletions only
  FOREACH t IN ARRAY ARRAY['motorcycles','booking_parts','parts','inventory_items','job_notes','job_photos','job_tasks','daily_notes','loan_bikes','time_entries','clock_events','service_templates','parts_catalog','booking_types','job_inspection_findings'] LOOP
    EXECUTE format('CREATE TRIGGER zz_activity_log AFTER DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.log_activity()', t);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.restore_deleted_record(p_log_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.activity_log;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Only admins can restore'; END IF;
  SELECT * INTO r FROM public.activity_log WHERE id = p_log_id;
  IF r IS NULL OR r.action <> 'delete' THEN RAISE EXCEPTION 'Not a deleted record'; END IF;
  IF r.restored_at IS NOT NULL THEN RAISE EXCEPTION 'Already restored'; END IF;
  EXECUTE format('INSERT INTO public.%I SELECT * FROM jsonb_populate_record(NULL::public.%I, $1)', r.table_name, r.table_name) USING r.old_data;
  UPDATE public.activity_log SET restored_at = now(), restored_by = auth.uid() WHERE id = p_log_id;
  RETURN jsonb_build_object('ok', true, 'table', r.table_name, 'id', r.record_id);
END $$;
REVOKE EXECUTE ON FUNCTION public.restore_deleted_record(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restore_deleted_record(uuid) TO authenticated;