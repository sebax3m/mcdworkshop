UPDATE public.booking_types
SET is_active = false
WHERE name IN (
  'Insurance / Crash',
  'Collision Repair (Insurance)',
  'Tyre Change',
  'Brake Service',
  'Chain & Sprocket',
  'Suspension',
  'Helmet Fitting'
);