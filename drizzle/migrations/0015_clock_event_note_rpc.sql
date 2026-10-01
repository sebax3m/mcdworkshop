CREATE OR REPLACE FUNCTION public.set_clock_event_note(p_event_id uuid, p_note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.clock_events SET note = NULLIF(left(trim(coalesce(p_note,'')), 500), '')
  WHERE id = p_event_id AND (user_id = auth.uid() OR private.has_role(auth.uid(), 'admin'::app_role));
  IF NOT FOUND THEN RAISE EXCEPTION 'Not allowed'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.set_clock_event_note(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_clock_event_note(uuid, text) TO authenticated;