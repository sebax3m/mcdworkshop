
update public.booking_types set name = 'Basic / Eco Service', updated_at = now()
where id = 'ea3b575e-1bec-4885-91cd-3d278d4e44cc';

insert into public.booking_types (name, sort_order, is_active)
select 'WOF', 45, true
where not exists (select 1 from public.booking_types where lower(name) = 'wof');

insert into public.service_templates (name, description, estimated_hours, sort_order, is_active, tasks)
select 'WOF', 'Warrant of Fitness inspection.', 0.5, 50, true,
'[{"label":"Tyres & wheels inspected"},{"label":"Brakes inspected"},{"label":"Steering & suspension inspected"},{"label":"Lights & indicators checked"},{"label":"Horn checked"},{"label":"Chain / final drive checked"},{"label":"Frame & structure inspected"},{"label":"Exhaust & fuel system checked"},{"label":"Mirrors & speedometer checked"},{"label":"WOF result recorded"}]'::jsonb
where not exists (select 1 from public.service_templates where lower(name) = 'wof');
