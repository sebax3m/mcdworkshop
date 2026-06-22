
-- Inventory items
CREATE TABLE public.inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL,
  brand text,
  type text,
  unit text NOT NULL DEFAULT 'unit',
  unit_price numeric(10,2) NOT NULL DEFAULT 0,
  stock_qty numeric(10,2) NOT NULL DEFAULT 0,
  min_stock numeric(10,2) NOT NULL DEFAULT 0,
  sku text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_items TO authenticated;
GRANT ALL ON public.inventory_items TO service_role;

ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff view inventory" ON public.inventory_items
  FOR SELECT TO authenticated USING (private.is_staff(auth.uid()));
CREATE POLICY "Admins manage inventory" ON public.inventory_items
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER inventory_items_updated_at
  BEFORE UPDATE ON public.inventory_items
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Extend job_tasks with a small note
ALTER TABLE public.job_tasks ADD COLUMN IF NOT EXISTS note text;

-- Extend jobs with flexible service data
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS service_data jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Cylinder count on motorcycles
ALTER TABLE public.motorcycles ADD COLUMN IF NOT EXISTS cylinders integer NOT NULL DEFAULT 4;

-- Refresh service templates to match reference
DELETE FROM public.service_templates WHERE name IN ('Minor Service','Major Service','Basic Service','Standard Service','Full Service');

INSERT INTO public.service_templates (name, description, estimated_hours, tasks, is_active, sort_order) VALUES
('Basic Service', 'Essential maintenance — keeping your bike in top condition.', 1.50,
 '[
   {"label":"Engine oil & filter change"},
   {"label":"Chain cleaned, lubed & adjusted"},
   {"label":"Brake fluid check"},
   {"label":"Coolant check"},
   {"label":"Tyre pressure check & adjust"},
   {"label":"Lighting system check"},
   {"label":"Steering check"},
   {"label":"Brake pad wear inspection"},
   {"label":"Lubed pivots"},
   {"label":"Brake caliper check"},
   {"label":"Front fork check"},
   {"label":"Air filter element check"},
   {"label":"Compression check"},
   {"label":"Overall safety inspection"},
   {"label":"Test ride"}
 ]'::jsonb, true, 1),
('Standard Service', 'Recommended at manufacturer intervals — includes everything in Basic plus.', 2.50,
 '[
   {"label":"Engine oil & filter change"},
   {"label":"Chain cleaned, lubed & adjusted"},
   {"label":"Tyre pressure check & adjust"},
   {"label":"Lighting system check"},
   {"label":"Steering check"},
   {"label":"Brake pad wear inspection"},
   {"label":"Lubed pivots"},
   {"label":"Brake caliper check"},
   {"label":"Front fork check"},
   {"label":"Air filter element check"},
   {"label":"Compression check"},
   {"label":"Spark plug replacement"},
   {"label":"Air filter replacement"},
   {"label":"Brake fluid replacement"},
   {"label":"Clutch fluid replacement (if hydraulic)"},
   {"label":"Coolant replacement (if required)"},
   {"label":"Overall safety inspection"},
   {"label":"Test ride"}
 ]'::jsonb, true, 2),
('Full Service', 'The most complete service — includes everything in Standard plus valve clearance check.', 4.50,
 '[
   {"label":"Engine oil & filter change"},
   {"label":"Chain cleaned, lubed & adjusted"},
   {"label":"Tyre pressure check & adjust"},
   {"label":"Lighting system check"},
   {"label":"Steering check"},
   {"label":"Brake pad wear inspection"},
   {"label":"Lubed pivots"},
   {"label":"Brake caliper check"},
   {"label":"Front fork check"},
   {"label":"Spark plug replacement"},
   {"label":"Air filter replacement"},
   {"label":"Brake fluid replacement"},
   {"label":"Clutch fluid replacement (if hydraulic)"},
   {"label":"Coolant replacement (if required)"},
   {"label":"Compression check"},
   {"label":"Valve clearance check"},
   {"label":"Overall safety inspection"},
   {"label":"Test ride"}
 ]'::jsonb, true, 3);

-- Set realistic cylinder counts for the seeded bikes
UPDATE public.motorcycles SET cylinders = 2 WHERE make IN ('Harley-Davidson','Ducati');
UPDATE public.motorcycles SET cylinders = 1 WHERE model ILIKE '%KTM%' OR model ILIKE '%single%';
UPDATE public.motorcycles SET cylinders = 3 WHERE model ILIKE '%Triple%' OR model ILIKE '%MT-09%' OR model ILIKE '%Speed Triple%';
UPDATE public.motorcycles SET cylinders = 4 WHERE make IN ('Kawasaki','Suzuki') OR model ILIKE '%S 1000 RR%' OR model ILIKE '%GSX-R%' OR model ILIKE '%ZX-10R%';
UPDATE public.motorcycles SET cylinders = 2 WHERE make = 'BMW' AND model ILIKE '%R 1250%';

-- Seed inventory
INSERT INTO public.inventory_items (name, category, brand, type, unit, unit_price, stock_qty, min_stock, sku) VALUES
('Motul 7100 10W-40', 'oil', 'Motul', '10W-40 Full Synthetic', 'L', 28.00, 24, 6, 'OIL-MOT-1040'),
('Motul 300V 10W-40', 'oil', 'Motul', '10W-40 Racing Ester', 'L', 42.00, 12, 4, 'OIL-MOT-300V'),
('Castrol Power1 Racing 10W-50', 'oil', 'Castrol', '10W-50 Full Synthetic', 'L', 32.00, 18, 6, 'OIL-CAS-1050'),
('K&N Oil Filter KN-204', 'oil_filter', 'K&N', 'KN-204 (universal Japanese)', 'unit', 22.00, 15, 5, 'OF-KN-204'),
('Hiflofiltro HF303', 'oil_filter', 'Hiflo', 'HF303', 'unit', 14.00, 20, 6, 'OF-HF-303'),
('K&N Air Filter HA-1009', 'air_filter', 'K&N', 'HA-1009 reusable', 'unit', 68.00, 6, 2, 'AF-KN-1009'),
('NGK CR9EIA-9 Iridium', 'spark_plug', 'NGK', 'CR9EIA-9 Iridium', 'unit', 18.50, 32, 8, 'SP-NGK-CR9EIA'),
('NGK LMAR8A-9 Iridium', 'spark_plug', 'NGK', 'LMAR8A-9 Iridium', 'unit', 19.50, 24, 8, 'SP-NGK-LMAR8A'),
('EBC FA379HH Brake Pads', 'brake_pad', 'EBC', 'FA379HH Sintered', 'set', 58.00, 10, 3, 'BP-EBC-FA379'),
('EBC FA254HH Brake Pads', 'brake_pad', 'EBC', 'FA254HH Sintered', 'set', 56.00, 8, 3, 'BP-EBC-FA254'),
('Motul RBF 600 Brake Fluid', 'brake_fluid', 'Motul', 'DOT 4 Racing 500ml', 'bottle', 24.00, 14, 4, 'BF-MOT-RBF600'),
('Motul MoCool Coolant', 'coolant', 'Motul', 'Pre-mixed 1L', 'L', 18.00, 12, 4, 'CL-MOT-MOCOOL'),
('DID 525VX3 Gold Chain', 'chain', 'DID', '525VX3 X-Ring 120L', 'unit', 220.00, 5, 2, 'CH-DID-525VX3'),
('JT Front Sprocket 16T', 'sprocket', 'JT', 'JTF1180.16 Front', 'unit', 38.00, 8, 3, 'SK-JT-F1180-16'),
('JT Rear Sprocket 42T', 'sprocket', 'JT', 'JTR899.42 Rear', 'unit', 62.00, 6, 2, 'SK-JT-R899-42');
