insert into public.service_templates (name, description, estimated_hours, version, sort_order, is_active, tasks)
select 'Tuning', 'Dyno / ECU tuning session', 2.0, 1, 70, true,
 '[{"label":"Bike secured on dyno, straps and fan set"},{"label":"Baseline power run recorded"},{"label":"Air/fuel ratio logged across RPM range"},{"label":"Fuel and ignition maps adjusted"},{"label":"Follow-up runs until targets met"},{"label":"Final power run and printout supplied"},{"label":"Road test and final checks"}]'::jsonb
where not exists (select 1 from public.service_templates where lower(name) = 'tuning');