CREATE TABLE public.mcd_tech_settings (
  id BOOLEAN PRIMARY KEY DEFAULT true CHECK (id),
  ai_enabled BOOLEAN NOT NULL DEFAULT true,
  external_ai_enabled BOOLEAN NOT NULL DEFAULT true,
  allow_technician_access BOOLEAN NOT NULL DEFAULT true,
  allow_customer_reports BOOLEAN NOT NULL DEFAULT true,
  allow_library_proposals BOOLEAN NOT NULL DEFAULT true,
  updated_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.mcd_tech_settings TO authenticated;
GRANT ALL ON public.mcd_tech_settings TO service_role;
ALTER TABLE public.mcd_tech_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mcd_tech_settings_read" ON public.mcd_tech_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "mcd_tech_settings_admin_write" ON public.mcd_tech_settings FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));
INSERT INTO public.mcd_tech_settings (id) VALUES (true);

CREATE TABLE public.mcd_tech_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL DEFAULT 'MCD TECH session',
  job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
  motorcycle_id UUID REFERENCES public.motorcycles(id) ON DELETE SET NULL,
  model_id UUID,
  context_label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX mcd_tech_conversations_user_idx ON public.mcd_tech_conversations (user_id, updated_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mcd_tech_conversations TO authenticated;
GRANT ALL ON public.mcd_tech_conversations TO service_role;
ALTER TABLE public.mcd_tech_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mcd_conv_own" ON public.mcd_tech_conversations FOR ALL TO authenticated
  USING (user_id = auth.uid() OR private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (user_id = auth.uid());

CREATE TABLE public.mcd_tech_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.mcd_tech_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user','assistant')),
  content TEXT NOT NULL DEFAULT '',
  payload JSONB,
  answer_source TEXT,
  used_external_ai BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX mcd_tech_messages_conv_idx ON public.mcd_tech_messages (conversation_id, created_at);
GRANT SELECT, INSERT, DELETE ON public.mcd_tech_messages TO authenticated;
GRANT ALL ON public.mcd_tech_messages TO service_role;
ALTER TABLE public.mcd_tech_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mcd_msg_own" ON public.mcd_tech_messages FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.mcd_tech_conversations c WHERE c.id = conversation_id
    AND (c.user_id = auth.uid() OR private.has_role(auth.uid(), 'admin'::app_role))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.mcd_tech_conversations c WHERE c.id = conversation_id AND c.user_id = auth.uid()));