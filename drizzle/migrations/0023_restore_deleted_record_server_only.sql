DROP FUNCTION IF EXISTS public.restore_deleted_record(uuid);
CREATE OR REPLACE FUNCTION public.restore_deleted_record(p_log_id uuid, p_actor uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE r public.activity_log;
BEGIN
  IF p_actor IS NULL OR NOT private.has_role(p_actor, 'admin') THEN RAISE EXCEPTION 'Only admins can restore'; END IF;
  SELECT * INTO r FROM public.activity_log WHERE id = p_log_id;
  IF r IS NULL OR r.action <> 'delete' THEN RAISE EXCEPTION 'Not a deleted record'; END IF;
  IF r.restored_at IS NOT NULL THEN RAISE EXCEPTION 'Already restored'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_proc p ON p.oid = t.tgfoid
    WHERE n.nspname = 'public' AND c.relname = r.table_name AND p.proname = 'log_activity'
  ) THEN RAISE EXCEPTION 'Table cannot be restored'; END IF;
  EXECUTE format('INSERT INTO public.%I SELECT * FROM jsonb_populate_record(NULL::public.%I, $1)', r.table_name, r.table_name) USING r.old_data;
  UPDATE public.activity_log SET restored_at = now(), restored_by = p_actor WHERE id = p_log_id;
  RETURN jsonb_build_object('ok', true, 'table', r.table_name, 'id', r.record_id);
END $function$;
REVOKE EXECUTE ON FUNCTION public.restore_deleted_record(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.restore_deleted_record(uuid, uuid) TO service_role;