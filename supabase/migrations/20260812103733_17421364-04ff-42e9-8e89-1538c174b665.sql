-- Phase 4: technical documents, RAG, checklists, query analytics
create extension if not exists vector with schema extensions;

create type public.garage_doc_type as enum (
  'workshop_manual','service_manual','owner_manual','parts_catalogue',
  'technical_bulletin','workshop_procedure','dyno_document','supplier_document','other'
);

create type public.garage_answer_source as enum (
  'structured','document','history','external_ai','none'
);

-- 1. DOCUMENTS ---------------------------------------------------------------
create table public.garage_documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  manufacturer text not null,
  model text,
  generation text,
  year_from integer,
  year_to integer,
  engine_platform text,
  doc_type public.garage_doc_type not null default 'workshop_manual',
  language text not null default 'en',
  version text,
  source public.garage_source not null default 'manufacturer_manual',
  verification public.garage_verification not null default 'unverified',
  model_id uuid references public.bike_library_models(id) on delete set null,
  storage_path text,
  external_url text,
  page_count integer,
  notes text,
  authorised boolean not null default true,
  is_archived boolean not null default false,
  uploaded_by uuid,
  verified_by uuid,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.garage_documents to authenticated;
grant all on public.garage_documents to service_role;
alter table public.garage_documents enable row level security;

create policy "staff read documents" on public.garage_documents
  for select to authenticated using (true);
create policy "admins manage documents" on public.garage_documents
  for all to authenticated
  using (private.has_role(auth.uid(),'admin'))
  with check (private.has_role(auth.uid(),'admin'));

create trigger garage_documents_touch before update on public.garage_documents
  for each row execute function public.touch_updated_at();

create index garage_documents_model_idx on public.garage_documents(model_id);
create index garage_documents_make_idx on public.garage_documents(lower(manufacturer), lower(coalesce(model,'')));

-- 2. DOCUMENT CHUNKS ---------------------------------------------------------
create table public.garage_document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.garage_documents(id) on delete cascade,
  chunk_index integer not null,
  content text not null,
  heading text,
  page_from integer,
  page_to integer,
  embedding extensions.vector(1536),
  created_at timestamptz not null default now(),
  unique (document_id, chunk_index)
);

grant select, insert, update, delete on public.garage_document_chunks to authenticated;
grant all on public.garage_document_chunks to service_role;
alter table public.garage_document_chunks enable row level security;

create policy "staff read chunks" on public.garage_document_chunks
  for select to authenticated using (true);
create policy "admins manage chunks" on public.garage_document_chunks
  for all to authenticated
  using (private.has_role(auth.uid(),'admin'))
  with check (private.has_role(auth.uid(),'admin'));

create index garage_chunks_doc_idx on public.garage_document_chunks(document_id);
create index garage_chunks_fts_idx on public.garage_document_chunks
  using gin (to_tsvector('english', content));

-- 3. CHECKLISTS --------------------------------------------------------------
create table public.garage_checklists (
  id uuid primary key default gen_random_uuid(),
  operation_key text not null,
  title text not null,
  model_id uuid references public.bike_library_models(id) on delete cascade,
  base_checklist_id uuid references public.garage_checklists(id) on delete set null,
  description text,
  estimated_hours numeric,
  is_archived boolean not null default false,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.garage_checklists to authenticated;
grant all on public.garage_checklists to service_role;
alter table public.garage_checklists enable row level security;

create policy "staff read checklists" on public.garage_checklists
  for select to authenticated using (true);
create policy "admins manage checklists" on public.garage_checklists
  for all to authenticated
  using (private.has_role(auth.uid(),'admin'))
  with check (private.has_role(auth.uid(),'admin'));

create trigger garage_checklists_touch before update on public.garage_checklists
  for each row execute function public.touch_updated_at();

create unique index garage_checklists_generic_key on public.garage_checklists(operation_key)
  where model_id is null;
create index garage_checklists_model_idx on public.garage_checklists(model_id);

create table public.garage_checklist_items (
  id uuid primary key default gen_random_uuid(),
  checklist_id uuid not null references public.garage_checklists(id) on delete cascade,
  label text not null,
  note text,
  torque_ref text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

grant select, insert, update, delete on public.garage_checklist_items to authenticated;
grant all on public.garage_checklist_items to service_role;
alter table public.garage_checklist_items enable row level security;

create policy "staff read checklist items" on public.garage_checklist_items
  for select to authenticated using (true);
create policy "admins manage checklist items" on public.garage_checklist_items
  for all to authenticated
  using (private.has_role(auth.uid(),'admin'))
  with check (private.has_role(auth.uid(),'admin'));

-- 4. QUERY LOG + FEEDBACK ----------------------------------------------------
create table public.garage_queries (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  question_norm text not null,
  topic text,
  model_id uuid references public.bike_library_models(id) on delete set null,
  motorcycle_id uuid references public.motorcycles(id) on delete set null,
  job_id uuid references public.jobs(id) on delete set null,
  answer_source public.garage_answer_source not null default 'none',
  answered boolean not null default false,
  document_id uuid references public.garage_documents(id) on delete set null,
  answer_summary text,
  used_external_ai boolean not null default false,
  cache_hit boolean not null default false,
  needs_verification boolean not null default false,
  asked_by uuid,
  created_at timestamptz not null default now()
);

grant select, insert, update on public.garage_queries to authenticated;
grant all on public.garage_queries to service_role;
alter table public.garage_queries enable row level security;

create policy "staff read queries" on public.garage_queries
  for select to authenticated using (true);
create policy "staff log queries" on public.garage_queries
  for insert to authenticated with check (asked_by = auth.uid());
create policy "admins update queries" on public.garage_queries
  for update to authenticated
  using (private.has_role(auth.uid(),'admin'))
  with check (private.has_role(auth.uid(),'admin'));

create index garage_queries_norm_idx on public.garage_queries(question_norm);
create index garage_queries_model_idx on public.garage_queries(model_id);

create table public.garage_answer_feedback (
  id uuid primary key default gen_random_uuid(),
  query_id uuid not null references public.garage_queries(id) on delete cascade,
  helpful boolean not null,
  reason text,
  note text,
  created_by uuid,
  created_at timestamptz not null default now()
);

grant select, insert on public.garage_answer_feedback to authenticated;
grant all on public.garage_answer_feedback to service_role;
alter table public.garage_answer_feedback enable row level security;

create policy "staff read feedback" on public.garage_answer_feedback
  for select to authenticated using (true);
create policy "staff give feedback" on public.garage_answer_feedback
  for insert to authenticated with check (created_by = auth.uid());

-- 5. RETRIEVAL RPCs ----------------------------------------------------------
create or replace function public.garage_search_chunks(
  p_embedding extensions.vector(1536) default null,
  p_query text default null,
  p_make text default null,
  p_model text default null,
  p_year integer default null,
  p_model_id uuid default null,
  p_limit integer default 6
)
returns table(
  chunk_id uuid, document_id uuid, title text, manufacturer text, doc_model text,
  generation text, year_from integer, year_to integer, doc_type public.garage_doc_type,
  version text, verification public.garage_verification, heading text,
  page_from integer, page_to integer, content text, score numeric
)
language sql
stable
set search_path to 'public','extensions'
as $$
  with allowed as (
    select d.* from public.garage_documents d
    where d.is_archived = false and d.authorised = true
      and (
        (p_model_id is not null and d.model_id = p_model_id)
        or (p_make is not null and lower(d.manufacturer) = lower(p_make)
            and (d.model is null or p_model is null
                 or lower(d.model) = lower(p_model)
                 or lower(p_model) like '%' || lower(d.model) || '%'
                 or lower(d.model) like '%' || lower(p_model) || '%'))
      )
      and (p_year is null
           or (coalesce(d.year_from, -99999) <= p_year and coalesce(d.year_to, 99999) >= p_year))
  )
  select c.id, d.id, d.title, d.manufacturer, d.model, d.generation, d.year_from, d.year_to,
         d.doc_type, d.version, d.verification, c.heading, c.page_from, c.page_to, c.content,
         (case when p_embedding is not null and c.embedding is not null
               then (1 - (c.embedding <=> p_embedding))::numeric
               else 0 end
          + case when p_query is not null and p_query <> ''
                 then ts_rank(to_tsvector('english', c.content),
                              plainto_tsquery('english', p_query))::numeric
                 else 0 end)::numeric as score
    from public.garage_document_chunks c
    join allowed d on d.id = c.document_id
   where p_embedding is not null
      or (p_query is not null and to_tsvector('english', c.content) @@ plainto_tsquery('english', p_query))
   order by score desc
   limit greatest(1, coalesce(p_limit, 6));
$$;

create or replace function public.garage_knowledge_coverage(p_model_id uuid)
returns jsonb
language sql
stable
set search_path to 'public'
as $$
  select jsonb_build_object(
    'fluids', (select count(*) from public.garage_fluid_specs where model_id = p_model_id and is_archived = false),
    'parts', (select count(*) from public.bike_library_parts where model_id = p_model_id and is_archived = false),
    'labour', (select count(*) from public.bike_library_labour where model_id = p_model_id and is_archived = false),
    'torque', (select count(*) from public.bike_library_torque where model_id = p_model_id and is_archived = false),
    'valves', (select count(*) from public.garage_valve_specs where model_id = p_model_id and is_archived = false),
    'documents', (select count(*) from public.garage_documents where model_id = p_model_id and is_archived = false),
    'procedures', (select count(*) from public.garage_checklists where model_id = p_model_id and is_archived = false),
    'observations', (select count(*) from public.garage_observations where model_id = p_model_id)
  );
$$;

create or replace function public.garage_missing_knowledge(p_limit integer default 20)
returns table(question_norm text, asks bigint, model_id uuid, last_asked timestamptz, sample text)
language sql
stable
set search_path to 'public'
as $$
  select q.question_norm, count(*) as asks, (array_agg(q.model_id))[1] as model_id,
         max(q.created_at) as last_asked, min(q.question) as sample
    from public.garage_queries q
   where q.answered = false or q.answer_source in ('external_ai','none')
   group by q.question_norm
  having count(*) >= 2
   order by count(*) desc, max(q.created_at) desc
   limit greatest(1, coalesce(p_limit, 20));
$$;

create or replace function public.garage_ai_usage(p_days integer default 30)
returns jsonb
language sql
stable
set search_path to 'public'
as $$
  select jsonb_build_object(
    'total', count(*),
    'structured', count(*) filter (where answer_source = 'structured'),
    'document', count(*) filter (where answer_source = 'document'),
    'history', count(*) filter (where answer_source = 'history'),
    'external_ai', count(*) filter (where used_external_ai),
    'cache_hits', count(*) filter (where cache_hit),
    'unanswered', count(*) filter (where answered = false)
  )
  from public.garage_queries
  where created_at > now() - make_interval(days => greatest(1, coalesce(p_days, 30)));
$$;

-- 6. PRIVATE DOCUMENT STORAGE POLICIES ---------------------------------------
create policy "staff read workshop docs" on storage.objects
  for select to authenticated using (bucket_id = 'workshop-docs');
create policy "admins write workshop docs" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'workshop-docs' and private.has_role(auth.uid(),'admin'));
create policy "admins update workshop docs" on storage.objects
  for update to authenticated
  using (bucket_id = 'workshop-docs' and private.has_role(auth.uid(),'admin'));
create policy "admins delete workshop docs" on storage.objects
  for delete to authenticated
  using (bucket_id = 'workshop-docs' and private.has_role(auth.uid(),'admin'));