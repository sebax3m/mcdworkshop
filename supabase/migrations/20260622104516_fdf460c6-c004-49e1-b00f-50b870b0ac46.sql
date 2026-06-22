
INSERT INTO public.service_templates (name, description, estimated_hours, tasks, is_active, sort_order)
VALUES ('Annual Service', 'Yearly comprehensive service — fluids, filters and key safety checks.', 3.00,
'[
  {"label":"Engine oil & filter change"},
  {"label":"Air filter replacement"},
  {"label":"Spark plug replacement"},
  {"label":"Brake fluid replacement"},
  {"label":"Coolant top-up / replacement"},
  {"label":"Chain cleaned, lubed & adjusted"},
  {"label":"Tyre pressure check & adjust"},
  {"label":"Brake pad wear inspection"},
  {"label":"Lubed pivots"},
  {"label":"Lighting & electrics check"},
  {"label":"Overall safety inspection"},
  {"label":"Test ride"}
]'::jsonb, true, 4);
