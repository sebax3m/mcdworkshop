
alter table public.service_templates add column if not exists version integer not null default 1;
alter table public.service_templates add column if not exists archived_at timestamptz;
alter table public.job_tasks add column if not exists status text not null default 'pending';
alter table public.job_tasks add column if not exists template_id uuid references public.service_templates(id);
alter table public.job_tasks add column if not exists template_version integer;
alter table public.jobs add column if not exists template_version integer;

do $$ begin
  alter table public.job_tasks add constraint job_tasks_status_check
    check (status in ('pending','completed','na','attention','not_completed'));
exception when duplicate_object then null; end $$;

-- keep legacy is_done flag and the new status in sync in both directions
create or replace function public.sync_job_task_status() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.status = 'pending' and new.is_done then new.status := 'completed'; end if;
    new.is_done := (new.status = 'completed');
    return new;
  end if;
  if new.status is distinct from old.status then
    new.is_done := (new.status = 'completed');
  elsif new.is_done is distinct from old.is_done then
    new.status := case when new.is_done then 'completed' else 'pending' end;
  end if;
  return new;
end $$;

drop trigger if exists job_tasks_sync_status on public.job_tasks;
create trigger job_tasks_sync_status before insert or update on public.job_tasks
for each row execute function public.sync_job_task_status();

update public.job_tasks set status = 'completed' where is_done and status <> 'completed';

-- bump template version whenever the master content changes
create or replace function public.bump_service_template_version() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.name is distinct from old.name
     or new.description is distinct from old.description
     or new.tasks is distinct from old.tasks then
    new.version := coalesce(old.version, 1) + 1;
    new.updated_at := now();
  end if;
  return new;
end $$;

drop trigger if exists service_templates_bump_version on public.service_templates;
create trigger service_templates_bump_version before update on public.service_templates
for each row execute function public.bump_service_template_version();

-- MASTER TEMPLATES
update public.service_templates set
  name = 'Basic / Eco Service',
  description = 'Essential maintenance service — oil, filter and safety checks.',
  tasks = '[{"label":"Engine oil replaced"},{"label":"Oil filter replaced"},{"label":"Brakes & tyres inspected"},{"label":"Wheel & steering bearings checked"},{"label":"Chain adjusted & lubricated where applicable"},{"label":"All pivots lubricated & free play checked"},{"label":"Fluid levels checked"},{"label":"Lights & controls checked"},{"label":"General safety inspection completed"},{"label":"Test ride completed"}]'::jsonb
where id = '2b80f848-6654-4673-bf7a-62dbe1615173';

update public.service_templates set
  name = 'Standard Service',
  description = 'Recommended service — oil, plugs, filters, fluids and full safety inspection.',
  tasks = '[{"label":"Engine oil & filter replaced"},{"label":"Spark plugs replaced"},{"label":"Air filter checked / replaced"},{"label":"Brake fluid checked / replaced"},{"label":"Coolant checked / replaced"},{"label":"Clutch fluid checked / replaced where applicable"},{"label":"Wheel & steering bearings checked"},{"label":"Chain adjusted & lubricated where applicable"},{"label":"All pivots lubricated & free play checked"},{"label":"Battery & charging system checked"},{"label":"Lights & electrical system checked"},{"label":"Controls & general fasteners checked"},{"label":"General mechanical & safety inspection completed"},{"label":"Test ride completed"}]'::jsonb
where id = 'fb1c76e5-cc6c-4ea8-82ab-e1df9e6d12a8';

update public.service_templates set
  name = 'Annual Service',
  description = 'Yearly comprehensive inspection service.',
  tasks = '[{"label":"Engine oil & filter replaced"},{"label":"Brakes & tyres comprehensively inspected"},{"label":"Wheel & steering bearings checked"},{"label":"Drivetrain inspected"},{"label":"All pivots lubricated & free play checked"},{"label":"Fluid levels & condition checked"},{"label":"Battery & charging system checked"},{"label":"Lights & electrical system checked"},{"label":"Controls & general fasteners checked"},{"label":"Comprehensive safety inspection completed"},{"label":"Test ride completed"}]'::jsonb
where id = 'cceeea94-1f09-4de9-8f61-134ce1121ec1';

update public.service_templates set
  name = 'Full Service',
  description = 'Complete service including valve clearance check / adjustment.',
  tasks = '[{"label":"Engine oil & filter replaced"},{"label":"Valve clearances checked / adjusted"},{"label":"Spark plugs replaced"},{"label":"Air filter checked / replaced"},{"label":"Brake fluid checked / replaced"},{"label":"Coolant checked / replaced"},{"label":"Clutch fluid checked / replaced where applicable"},{"label":"Wheel & steering bearings checked"},{"label":"Chain adjusted & lubricated where applicable"},{"label":"All pivots lubricated & free play checked"},{"label":"Battery & charging system checked"},{"label":"Lights & electrical system checked"},{"label":"Controls & general fasteners checked"},{"label":"General mechanical & safety inspection completed"},{"label":"Test ride completed"}]'::jsonb
where id = 'e3fe3b34-e6ae-46bd-9cbc-9429b1cf6003';
