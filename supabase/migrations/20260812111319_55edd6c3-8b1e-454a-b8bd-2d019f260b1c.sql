-- Phase 2: model hierarchy, platforms, aliases, matching + audit
ALTER TABLE public.bike_library_models
  ADD COLUMN IF NOT EXISTS generation text,
  ADD COLUMN IF NOT EXISTS platform text,
  ADD COLUMN IF NOT EXISTS engine text,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS priority smallint NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS market_status text,
  ADD COLUMN IF NOT EXISTS model_family text;

CREATE INDEX IF NOT EXISTS idx_blm_make_norm ON public.bike_library_models (public.garage_norm(make));
CREATE INDEX IF NOT EXISTS idx_blm_model_norm ON public.bike_library_models (public.garage_norm(model));
CREATE INDEX IF NOT EXISTS idx_blm_years ON public.bike_library_models (year_from, year_to);
CREATE INDEX IF NOT EXISTS idx_blm_platform ON public.bike_library_models (platform);
CREATE INDEX IF NOT EXISTS idx_blm_priority ON public.bike_library_models (priority);

CREATE TABLE IF NOT EXISTS public.bike_library_platforms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  make text NOT NULL,
  code text NOT NULL,
  name text,
  notes text,
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_blp_make_code ON public.bike_library_platforms (public.garage_norm(make), public.garage_norm(code));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bike_library_platforms TO authenticated;
GRANT ALL ON public.bike_library_platforms TO service_role;
ALTER TABLE public.bike_library_platforms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "platforms readable by staff" ON public.bike_library_platforms FOR SELECT TO authenticated USING (true);
CREATE POLICY "platforms writable by admin" ON public.bike_library_platforms FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin')) WITH CHECK (private.has_role(auth.uid(),'admin'));
CREATE TRIGGER bike_library_platforms_touch BEFORE UPDATE ON public.bike_library_platforms
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.bike_library_model_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id uuid NOT NULL REFERENCES public.bike_library_models(id) ON DELETE CASCADE,
  alias text NOT NULL,
  alias_norm text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_blma_unique ON public.bike_library_model_aliases (model_id, alias_norm);
CREATE INDEX IF NOT EXISTS idx_blma_norm ON public.bike_library_model_aliases (alias_norm);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bike_library_model_aliases TO authenticated;
GRANT ALL ON public.bike_library_model_aliases TO service_role;
ALTER TABLE public.bike_library_model_aliases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "aliases readable by staff" ON public.bike_library_model_aliases FOR SELECT TO authenticated USING (true);
CREATE POLICY "aliases writable by admin" ON public.bike_library_model_aliases FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin')) WITH CHECK (private.has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.motorcycle_model_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  motorcycle_id uuid NOT NULL REFERENCES public.motorcycles(id) ON DELETE CASCADE,
  model_id uuid NOT NULL REFERENCES public.bike_library_models(id) ON DELETE CASCADE,
  confidence text NOT NULL DEFAULT 'confirmed',
  confirmed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_mml_moto ON public.motorcycle_model_links (motorcycle_id);
CREATE INDEX IF NOT EXISTS idx_mml_model ON public.motorcycle_model_links (model_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.motorcycle_model_links TO authenticated;
GRANT ALL ON public.motorcycle_model_links TO service_role;
ALTER TABLE public.motorcycle_model_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "links readable by staff" ON public.motorcycle_model_links FOR SELECT TO authenticated USING (true);
CREATE POLICY "links writable by staff" ON public.motorcycle_model_links FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE TRIGGER motorcycle_model_links_touch BEFORE UPDATE ON public.motorcycle_model_links
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.audit_bike_library_model()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE f text; oldv text; newv text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.garage_revisions(model_id, entity_table, entity_id, label, new_value, action, created_by)
    VALUES (NEW.id, 'bike_library_models', NEW.id, 'Model created', concat_ws(' ', NEW.make, NEW.model, NEW.generation), 'create', auth.uid());
    RETURN NEW;
  END IF;
  FOREACH f IN ARRAY ARRAY['make','model','generation','platform','engine','category','variant','priority','year_from','year_to','market_status','is_archived'] LOOP
    EXECUTE format('SELECT ($1).%I::text, ($2).%I::text', f, f) INTO oldv, newv USING OLD, NEW;
    IF oldv IS DISTINCT FROM newv THEN
      INSERT INTO public.garage_revisions(model_id, entity_table, entity_id, field, label, old_value, new_value, action, created_by)
      VALUES (NEW.id, 'bike_library_models', NEW.id, f, concat_ws(' ', NEW.make, NEW.model), oldv, newv,
              CASE WHEN f = 'is_archived' AND NEW.is_archived THEN 'archive' ELSE 'update' END, auth.uid());
    END IF;
  END LOOP;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS bike_library_models_audit ON public.bike_library_models;
CREATE TRIGGER bike_library_models_audit AFTER INSERT OR UPDATE ON public.bike_library_models
  FOR EACH ROW EXECUTE FUNCTION public.audit_bike_library_model();

CREATE OR REPLACE FUNCTION public.guard_bike_library_model_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n int;
BEGIN
  SELECT (SELECT count(*) FROM public.bike_library_parts WHERE model_id = OLD.id)
       + (SELECT count(*) FROM public.bike_library_labour WHERE model_id = OLD.id)
       + (SELECT count(*) FROM public.bike_library_torque WHERE model_id = OLD.id)
       + (SELECT count(*) FROM public.garage_fluid_specs WHERE model_id = OLD.id)
       + (SELECT count(*) FROM public.garage_valve_specs WHERE model_id = OLD.id)
       + (SELECT count(*) FROM public.garage_documents WHERE model_id = OLD.id)
       + (SELECT count(*) FROM public.garage_checklists WHERE model_id = OLD.id)
    INTO n;
  IF n > 0 THEN
    RAISE EXCEPTION 'Cannot delete model with linked workshop knowledge (% records) - archive it instead', n;
  END IF;
  RETURN OLD;
END; $$;
DROP TRIGGER IF EXISTS bike_library_models_delete_guard ON public.bike_library_models;
CREATE TRIGGER bike_library_models_delete_guard BEFORE DELETE ON public.bike_library_models
  FOR EACH ROW EXECUTE FUNCTION public.guard_bike_library_model_delete();

CREATE OR REPLACE FUNCTION public.garage_suggest_models(p_make text, p_model text, p_year integer DEFAULT NULL)
RETURNS TABLE(model_id uuid, make text, model text, generation text, year_from int, year_to int, platform text, confidence text, score int)
LANGUAGE sql STABLE SET search_path = public AS $$
  WITH cand AS (
    SELECT m.id, m.make, m.model, m.generation, m.year_from, m.year_to, m.platform,
           (CASE WHEN public.garage_norm(m.make) = public.garage_norm(p_make) THEN 40 ELSE 0 END
          + CASE WHEN public.garage_norm(m.model) = public.garage_norm(p_model) THEN 40
                 WHEN EXISTS (SELECT 1 FROM public.bike_library_model_aliases a
                               WHERE a.model_id = m.id AND a.alias_norm = public.garage_norm(p_model)) THEN 35
                 WHEN public.garage_norm(m.model) <> '' AND public.garage_norm(p_model) <> ''
                      AND (public.garage_norm(m.model) LIKE '%' || public.garage_norm(p_model) || '%'
                        OR public.garage_norm(p_model) LIKE '%' || public.garage_norm(m.model) || '%') THEN 20
                 ELSE 0 END
          + CASE WHEN p_year IS NULL THEN 0
                 WHEN coalesce(m.year_from, -99999) <= p_year AND coalesce(m.year_to, 99999) >= p_year THEN 20
                 ELSE 0 END)::int AS score
      FROM public.bike_library_models m
     WHERE m.is_archived = false
  )
  SELECT id, make, model, generation, year_from, year_to, platform,
         CASE WHEN score >= 90 THEN 'matched' WHEN score >= 55 THEN 'likely' ELSE 'weak' END,
         score
    FROM cand
   WHERE score >= 55
   ORDER BY score DESC, year_from DESC NULLS LAST
   LIMIT 5;
$$;

WITH seed(make,model,generation,year_from,year_to,variant,engine,platform,category,priority) AS (VALUES
('Yamaha','MT-07','Gen 1',2014,2017,NULL,'689cc parallel twin','CP2','naked',1),
('Yamaha','MT-07','Gen 2',2018,2020,NULL,'689cc parallel twin','CP2','naked',1),
('Yamaha','MT-07','Gen 3',2021,2024,NULL,'689cc parallel twin','CP2','naked',1),
('Yamaha','MT-09','Gen 1',2014,2016,NULL,'847cc triple','CP3','naked',1),
('Yamaha','MT-09','Gen 2',2017,2020,NULL,'847cc triple','CP3','naked',1),
('Yamaha','MT-09','Gen 3',2021,2023,NULL,'890cc triple','CP3','naked',1),
('Yamaha','MT-09','Gen 4',2024,NULL,NULL,'890cc triple','CP3','naked',2),
('Yamaha','MT-03','Gen 1',2016,NULL,NULL,'321cc parallel twin','CP2 (321)','naked',2),
('Yamaha','MT-10','Gen 1',2016,2021,NULL,'998cc crossplane four','CP4','naked',2),
('Yamaha','MT-10','Gen 2',2022,NULL,NULL,'998cc crossplane four','CP4','naked',2),
('Yamaha','YZF-R1','Gen 5',2015,2019,NULL,'998cc crossplane four','CP4','sport',1),
('Yamaha','YZF-R1','Gen 6',2020,NULL,NULL,'998cc crossplane four','CP4','sport',1),
('Yamaha','YZF-R3','Gen 1',2015,2018,NULL,'321cc parallel twin','CP2 (321)','sport',2),
('Yamaha','YZF-R3','Gen 2',2019,NULL,NULL,'321cc parallel twin','CP2 (321)','sport',2),
('Yamaha','YZF-R6','Gen 4',2017,2020,NULL,'599cc inline four','R6','sport',2),
('Yamaha','YZF-R7','Gen 1',2022,NULL,NULL,'689cc parallel twin','CP2','sport',2),
('Yamaha','Tracer 900','Gen 1',2015,2020,NULL,'847cc triple','CP3','sport touring',2),
('Yamaha','Tracer 9','Gen 2',2021,NULL,'GT','890cc triple','CP3','sport touring',2),
('Yamaha','Tenere 700','Gen 1',2019,NULL,NULL,'689cc parallel twin','CP2','adventure',1),
('Yamaha','XSR700','Gen 1',2016,NULL,NULL,'689cc parallel twin','CP2','retro',2),
('Yamaha','XSR900','Gen 1',2016,2021,NULL,'847cc triple','CP3','retro',2),
('Yamaha','XSR900','Gen 2',2022,NULL,NULL,'890cc triple','CP3','retro',2),
('Yamaha','FJR1300','Gen 3',2013,2022,NULL,'1298cc inline four','FJR','touring',3),
('Yamaha','WR450F','Gen',2019,NULL,NULL,'450cc single','WR','offroad',3),
('Honda','CBR500R','Gen 1',2013,2018,NULL,'471cc parallel twin','CB500','sport',2),
('Honda','CBR500R','Gen 2',2019,NULL,NULL,'471cc parallel twin','CB500','sport',2),
('Honda','CB500F','Gen 1',2013,2018,NULL,'471cc parallel twin','CB500','naked',2),
('Honda','CB500X','Gen 1',2013,NULL,NULL,'471cc parallel twin','CB500','adventure',2),
('Honda','CBR650R','Gen 1',2019,NULL,NULL,'649cc inline four','CB650','sport',2),
('Honda','CB650R','Gen 1',2019,NULL,NULL,'649cc inline four','CB650','naked',2),
('Honda','CBR600RR','Gen 4',2013,2020,NULL,'599cc inline four','PC40','sport',2),
('Honda','CBR1000RR Fireblade','Gen SC59',2008,2016,NULL,'999cc inline four','SC59','sport',2),
('Honda','CBR1000RR-R Fireblade','SC82',2020,NULL,'SP','1000cc inline four','SC82','sport',2),
('Honda','Africa Twin CRF1000L','Gen 1',2016,2019,NULL,'998cc parallel twin','CRF1000','adventure',1),
('Honda','Africa Twin CRF1100L','Gen 2',2020,NULL,'Adventure Sports','1084cc parallel twin','CRF1100','adventure',1),
('Honda','NC750X','Gen 2',2016,2020,NULL,'745cc parallel twin','NC750','adventure',2),
('Honda','NC750X','Gen 3',2021,NULL,NULL,'745cc parallel twin','NC750','adventure',2),
('Honda','CRF300L','Gen 1',2021,NULL,NULL,'286cc single','CRF','dual sport',2),
('Honda','CRF250L','Gen 1',2013,2020,NULL,'250cc single','CRF','dual sport',2),
('Honda','Rebel 500','Gen 1',2017,NULL,NULL,'471cc parallel twin','CB500','cruiser',2),
('Honda','Rebel 1100','Gen 1',2021,NULL,NULL,'1084cc parallel twin','CRF1100','cruiser',2),
('Honda','Gold Wing','Gen 6',2018,NULL,'Tour','1833cc flat six','GL1800','touring',3),
('Honda','Grom','Gen 2',2017,2021,NULL,'124cc single','MSX','minibike',3),
('Honda','X-ADV','Gen 2',2021,NULL,NULL,'745cc parallel twin','NC750','adventure scooter',3),
('Kawasaki','Ninja 300','Gen 1',2013,2017,NULL,'296cc parallel twin','EX300','sport',2),
('Kawasaki','Ninja 400','Gen 1',2018,NULL,NULL,'399cc parallel twin','EX400','sport',1),
('Kawasaki','Ninja 650','Gen 3',2017,NULL,NULL,'649cc parallel twin','ER650','sport',1),
('Kawasaki','Z650','Gen 1',2017,NULL,NULL,'649cc parallel twin','ER650','naked',1),
('Kawasaki','Z900','Gen 1',2017,2019,NULL,'948cc inline four','Z900','naked',1),
('Kawasaki','Z900','Gen 2',2020,NULL,NULL,'948cc inline four','Z900','naked',1),
('Kawasaki','Z1000','Gen 4',2014,2020,NULL,'1043cc inline four','Z1000','naked',2),
('Kawasaki','Ninja ZX-6R','Gen',2013,2018,NULL,'636cc inline four','ZX636','sport',2),
('Kawasaki','Ninja ZX-10R','Gen',2016,2020,NULL,'998cc inline four','ZX10','sport',2),
('Kawasaki','Ninja 1000SX','Gen 3',2020,NULL,NULL,'1043cc inline four','Z1000','sport touring',2),
('Kawasaki','Versys 650','Gen 3',2015,NULL,NULL,'649cc parallel twin','ER650','adventure',2),
('Kawasaki','Versys 1000','Gen 2',2019,NULL,NULL,'1043cc inline four','Z1000','adventure',3),
('Kawasaki','KLR650','Gen 3',2022,NULL,NULL,'652cc single','KL650','dual sport',2),
('Kawasaki','Vulcan S','Gen 1',2015,NULL,NULL,'649cc parallel twin','ER650','cruiser',2),
('Kawasaki','W800','Gen 2',2019,NULL,NULL,'773cc parallel twin','W800','retro',3),
('Suzuki','SV650','Gen 3',2016,NULL,NULL,'645cc V-twin','SV650','naked',1),
('Suzuki','GSX-R600','Gen K11',2011,2020,NULL,'599cc inline four','GSXR600','sport',2),
('Suzuki','GSX-R750','Gen K11',2011,NULL,NULL,'750cc inline four','GSXR750','sport',2),
('Suzuki','GSX-R1000','Gen L7',2017,NULL,'R','999cc inline four','GSXR1000','sport',2),
('Suzuki','GSX-S750','Gen 1',2015,2021,NULL,'749cc inline four','GSXS750','naked',2),
('Suzuki','GSX-S1000','Gen 2',2021,NULL,NULL,'999cc inline four','GSXS1000','naked',2),
('Suzuki','GSX-8S','Gen 1',2023,NULL,NULL,'776cc parallel twin','GSX8','naked',2),
('Suzuki','V-Strom 650','Gen 3',2017,NULL,'XT','645cc V-twin','SV650','adventure',1),
('Suzuki','V-Strom 1050','Gen 1',2020,NULL,'XT','1037cc V-twin','DL1050','adventure',2),
('Suzuki','Hayabusa','Gen 3',2022,NULL,NULL,'1340cc inline four','GSX1300R','sport touring',2),
('Suzuki','DR-Z400','Gen',2000,NULL,'S/SM','398cc single','DRZ400','dual sport',2),
('BMW','S 1000 RR','K46',2010,2018,NULL,'999cc inline four','K46','sport',2),
('BMW','S 1000 RR','K67',2019,2022,NULL,'999cc inline four','K67','sport',1),
('BMW','S 1000 RR','K67 LCI',2023,NULL,NULL,'999cc inline four','K67','sport',2),
('BMW','S 1000 R','K47',2014,2020,NULL,'999cc inline four','K47','naked',2),
('BMW','S 1000 XR','K49',2015,2019,NULL,'999cc inline four','K49','sport touring',3),
('BMW','R 1250 GS','ShiftCam',2019,2023,'Adventure','1254cc boxer twin','R1250 ShiftCam','adventure',1),
('BMW','R 1300 GS','Gen 1',2024,NULL,NULL,'1300cc boxer twin','R1300 Boxer','adventure',1),
('BMW','R 1200 GS','LC',2013,2018,'Adventure','1170cc boxer twin','R1200 LC','adventure',1),
('BMW','R 1250 RT','ShiftCam',2019,NULL,NULL,'1254cc boxer twin','R1250 ShiftCam','touring',2),
('BMW','R nineT','Gen 1',2014,2020,NULL,'1170cc boxer twin','R1200 air/oil','retro',2),
('BMW','F 850 GS','Gen 1',2018,NULL,'Adventure','853cc parallel twin','F850','adventure',2),
('BMW','F 750 GS','Gen 1',2018,NULL,NULL,'853cc parallel twin','F850','adventure',2),
('BMW','F 900 R','Gen 1',2020,NULL,NULL,'895cc parallel twin','F900','naked',2),
('BMW','G 310 R','Gen 1',2016,NULL,NULL,'313cc single','G310','naked',3),
('BMW','K 1600 GT','Gen 2',2017,NULL,'GTL','1649cc inline six','K1600','touring',3),
('Harley-Davidson','Road Glide','Touring',2017,2023,NULL,'Milwaukee-Eight 107/114','Milwaukee-Eight 107','touring',1),
('Harley-Davidson','Road Glide','Touring Gen 2',2024,NULL,NULL,'Milwaukee-Eight 117','Milwaukee-Eight 117','touring',2),
('Harley-Davidson','Street Glide','Touring',2017,2023,NULL,'Milwaukee-Eight 107/114','Milwaukee-Eight 107','touring',1),
('Harley-Davidson','Street Glide','Twin Cam',2007,2016,NULL,'Twin Cam 96/103','Twin Cam 103','touring',2),
('Harley-Davidson','Road King','Touring',2017,NULL,NULL,'Milwaukee-Eight 107','Milwaukee-Eight 107','touring',2),
('Harley-Davidson','Electra Glide','Touring',2017,NULL,'Ultra Limited','Milwaukee-Eight 114','Milwaukee-Eight 114','touring',2),
('Harley-Davidson','Fat Boy','Softail M8',2018,NULL,NULL,'Milwaukee-Eight 107/114','Milwaukee-Eight 114','cruiser',1),
('Harley-Davidson','Heritage Classic','Softail M8',2018,NULL,NULL,'Milwaukee-Eight 114','Milwaukee-Eight 114','cruiser',2),
('Harley-Davidson','Street Bob','Softail M8',2018,NULL,NULL,'Milwaukee-Eight 107/114','Milwaukee-Eight 107','cruiser',2),
('Harley-Davidson','Fat Bob','Softail M8',2018,NULL,NULL,'Milwaukee-Eight 114','Milwaukee-Eight 114','cruiser',2),
('Harley-Davidson','Low Rider S','Softail M8',2020,NULL,NULL,'Milwaukee-Eight 117','Milwaukee-Eight 117','cruiser',2),
('Harley-Davidson','Softail','Twin Cam',2007,2017,NULL,'Twin Cam 96/103/110','Twin Cam 103','cruiser',2),
('Harley-Davidson','Iron 883','Sportster',2009,2022,NULL,'883cc Evolution','Evolution 883','cruiser',1),
('Harley-Davidson','Forty-Eight','Sportster',2010,2022,NULL,'1202cc Evolution','Evolution 1200','cruiser',2),
('Harley-Davidson','Sportster S','RH1250',2021,NULL,NULL,'1252cc Revolution Max','Revolution Max','cruiser',2),
('Harley-Davidson','Nightster','RH975',2022,NULL,NULL,'975cc Revolution Max','Revolution Max','cruiser',2),
('Harley-Davidson','Pan America 1250','RA1250',2021,NULL,'Special','1252cc Revolution Max','Revolution Max','adventure',2),
('Harley-Davidson V-Rod','V-Rod VRSCA','Revolution',2002,2006,NULL,'1130cc Revolution V-twin','Revolution 1130','muscle',2),
('Harley-Davidson V-Rod','Night Rod Special VRSCDX','Revolution',2007,2017,NULL,'1250cc Revolution V-twin','Revolution 1250','muscle',1),
('Harley-Davidson V-Rod','V-Rod Muscle VRSCF','Revolution',2009,2017,NULL,'1250cc Revolution V-twin','Revolution 1250','muscle',2),
('Harley-Davidson V-Rod','Street Rod VRSCR','Revolution',2006,2007,NULL,'1130cc Revolution V-twin','Revolution 1130','muscle',3),
('Ducati','Monster 821','Testastretta 11',2014,2020,NULL,'821cc L-twin','Testastretta','naked',2),
('Ducati','Monster 937','Gen 1',2021,NULL,NULL,'937cc L-twin','Testastretta','naked',2),
('Ducati','Monster 1200','Testastretta 11',2014,2021,'S','1198cc L-twin','Testastretta','naked',2),
('Ducati','Panigale V2','Gen 1',2020,2024,NULL,'955cc Superquadro','Superquadro','sport',1),
('Ducati','Panigale V4','Gen 1',2018,2021,'S','1103cc V4','Desmosedici Stradale','sport',1),
('Ducati','Panigale V4','Gen 2',2022,NULL,'S','1103cc V4','Desmosedici Stradale','sport',1),
('Ducati','Streetfighter V4','Gen 1',2020,NULL,'S','1103cc V4','Desmosedici Stradale','naked',2),
('Ducati','Multistrada 1260','Testastretta DVT',2018,2020,NULL,'1262cc L-twin','Testastretta DVT','adventure',2),
('Ducati','Multistrada V4','Gen 1',2021,NULL,'S','1158cc V4','V4 Granturismo','adventure',1),
('Ducati','Multistrada V2','Gen 1',2022,NULL,NULL,'937cc L-twin','Testastretta','adventure',2),
('Ducati','Scrambler Icon','Gen 1',2015,2022,NULL,'803cc L-twin','Desmodue 803','retro',2),
('Ducati','DesertX','Gen 1',2022,NULL,NULL,'937cc L-twin','Testastretta','adventure',2),
('Ducati','Diavel V4','Gen 1',2023,NULL,NULL,'1158cc V4','V4 Granturismo','muscle',3),
('Ducati','Hypermotard 950','Gen 1',2019,NULL,NULL,'937cc L-twin','Testastretta','supermoto',3),
('Triumph','Street Triple 765','Gen 1',2017,2022,'RS','765cc triple','765 triple','naked',1),
('Triumph','Street Triple 765','Gen 2',2023,NULL,'RS','765cc triple','765 triple','naked',2),
('Triumph','Speed Triple 1200','RS',2021,NULL,NULL,'1160cc triple','1200 triple','naked',2),
('Triumph','Trident 660','Gen 1',2021,NULL,NULL,'660cc triple','660 triple','naked',1),
('Triumph','Tiger Sport 660','Gen 1',2022,NULL,NULL,'660cc triple','660 triple','sport touring',2),
('Triumph','Tiger 900','Gen 1',2020,2023,'Rally Pro','888cc triple','900 triple','adventure',1),
('Triumph','Tiger 1200','Gen 3',2022,NULL,'GT Pro','1160cc triple','1200 triple','adventure',2),
('Triumph','Bonneville T120','Gen 1',2016,NULL,NULL,'1200cc parallel twin','Bonneville HT 1200','retro',1),
('Triumph','Bonneville T100','Gen 1',2017,NULL,NULL,'900cc parallel twin','Bonneville HT 900','retro',2),
('Triumph','Bonneville Bobber','Gen 1',2017,NULL,NULL,'1200cc parallel twin','Bonneville HT 1200','cruiser',2),
('Triumph','Rocket 3','Gen 2',2020,NULL,'R/GT','2458cc triple','Rocket 3','muscle',3),
('Triumph','Daytona 675','Gen 3',2013,2017,'R','675cc triple','675 triple','sport',3),
('KTM','390 Duke','Gen 2',2017,2023,NULL,'373cc single','LC4c 373','naked',1),
('KTM','390 Duke','Gen 3',2024,NULL,NULL,'399cc single','LC4c 399','naked',2),
('KTM','790 Duke','Gen 1',2018,2020,NULL,'799cc parallel twin','LC8c 799','naked',2),
('KTM','890 Duke','Gen 1',2020,NULL,'R','889cc parallel twin','LC8c 889','naked',2),
('KTM','1290 Super Duke R','Gen 3',2020,NULL,NULL,'1301cc V-twin','LC8 1301','naked',2),
('KTM','RC 390','Gen 2',2022,NULL,NULL,'373cc single','LC4c 373','sport',2),
('KTM','390 Adventure','Gen 1',2020,NULL,NULL,'373cc single','LC4c 373','adventure',2),
('KTM','890 Adventure','Gen 1',2021,NULL,'R','889cc parallel twin','LC8c 889','adventure',2),
('KTM','1290 Super Adventure','Gen 3',2021,NULL,'S','1301cc V-twin','LC8 1301','adventure',2),
('KTM','500 EXC-F','Gen',2017,NULL,NULL,'511cc single','LC4 500','enduro',2),
('KTM','300 EXC','Gen',2017,NULL,'TPI','293cc two-stroke','2T 300','enduro',2),
('Indian','Scout','Gen 1',2015,2024,'Bobber','1133cc V-twin','Scout 1133','cruiser',1),
('Indian','Scout','Gen 2',2025,NULL,NULL,'1250cc V-twin','SpeedPlus 1250','cruiser',3),
('Indian','Chief','Gen 2',2022,NULL,'Dark Horse','1890cc V-twin','Thunderstroke 116','cruiser',2),
('Indian','Springfield','Thunderstroke',2016,NULL,NULL,'1811/1890cc V-twin','Thunderstroke 111','touring',2),
('Indian','Roadmaster','Thunderstroke',2015,NULL,NULL,'1811/1890cc V-twin','Thunderstroke 116','touring',2),
('Indian','Challenger','PowerPlus',2020,NULL,NULL,'1769cc V-twin','PowerPlus 108','touring',2),
('Indian','FTR','Gen 1',2019,NULL,'1200 S','1203cc V-twin','FTR 1200','naked',2)
)
INSERT INTO public.bike_library_models (make, model, generation, year_from, year_to, variant, engine, platform, category, priority, cylinders)
SELECT s.make, s.model, s.generation, s.year_from, s.year_to, s.variant, s.engine, s.platform, s.category, s.priority, 1
  FROM seed s
 WHERE NOT EXISTS (
   SELECT 1 FROM public.bike_library_models m
    WHERE public.garage_norm(m.make) = public.garage_norm(s.make)
      AND public.garage_norm(m.model) = public.garage_norm(s.model)
      AND coalesce(m.year_from,-1) = coalesce(s.year_from,-1)
 );

WITH a(model,alias) AS (VALUES
('MT-09','MT09'),('MT-09','MT 09'),('MT-09','FZ-09'),('MT-09','FZ09'),
('MT-07','MT07'),('MT-07','MT 07'),('MT-07','FZ-07'),('MT-07','FZ07'),
('MT-03','MT03'),('MT-03','MT 03'),
('MT-10','MT10'),('MT-10','MT 10'),('MT-10','FZ-10'),
('YZF-R1','R1'),('YZF-R1','YZFR1'),('YZF-R1','YZF R1'),
('YZF-R3','R3'),('YZF-R3','YZFR3'),
('YZF-R6','R6'),('YZF-R6','YZFR6'),
('YZF-R7','R7'),('YZF-R7','YZFR7'),
('Tenere 700','Tenere 700'),('Tenere 700','T7'),('Tenere 700','XTZ690'),
('S 1000 RR','S1000RR'),('S 1000 RR','S1000 RR'),('S 1000 RR','S 1000RR'),
('S 1000 R','S1000R'),('S 1000 R','S1000 R'),
('S 1000 XR','S1000XR'),
('R 1250 GS','R1250GS'),('R 1250 GS','R1250 GS'),('R 1250 GS','R 1250GS'),
('R 1300 GS','R1300GS'),('R 1300 GS','R1300 GS'),
('R 1200 GS','R1200GS'),('R 1200 GS','R1200 GS'),
('R 1250 RT','R1250RT'),
('F 850 GS','F850GS'),('F 750 GS','F750GS'),('F 900 R','F900R'),('G 310 R','G310R'),
('K 1600 GT','K1600GT'),('K 1600 GT','K1600GTL'),
('R nineT','RnineT'),('R nineT','R9T'),('R nineT','R Nine T'),
('Night Rod Special VRSCDX','VRSCDX'),('Night Rod Special VRSCDX','Night Rod Special'),('Night Rod Special VRSCDX','Night Rod'),
('V-Rod VRSCA','VRSCA'),('V-Rod VRSCA','VRod'),('V-Rod VRSCA','V Rod'),
('V-Rod Muscle VRSCF','VRSCF'),('V-Rod Muscle VRSCF','V-Rod Muscle'),
('Street Rod VRSCR','VRSCR'),
('Ninja ZX-6R','ZX6R'),('Ninja ZX-6R','ZX-6R'),('Ninja ZX-6R','ZX 6R'),
('Ninja ZX-10R','ZX10R'),('Ninja ZX-10R','ZX-10R'),
('Ninja 1000SX','Z1000SX'),('Ninja 1000SX','Ninja 1000'),
('CBR1000RR Fireblade','CBR1000RR'),('CBR1000RR Fireblade','Fireblade'),
('CBR1000RR-R Fireblade','CBR1000RR-R'),('CBR1000RR-R Fireblade','Fireblade SP'),
('Africa Twin CRF1000L','CRF1000L'),('Africa Twin CRF1000L','Africa Twin'),
('Africa Twin CRF1100L','CRF1100L'),('Africa Twin CRF1100L','Africa Twin'),
('GSX-R1000','GSXR1000'),('GSX-R1000','GSXR 1000'),('GSX-R750','GSXR750'),('GSX-R600','GSXR600'),
('GSX-S1000','GSXS1000'),('GSX-S750','GSXS750'),('GSX-8S','GSX8S'),
('V-Strom 650','VStrom 650'),('V-Strom 650','DL650'),
('V-Strom 1050','VStrom 1050'),('V-Strom 1050','DL1050'),
('DR-Z400','DRZ400'),('DR-Z400','DRZ 400'),
('Street Triple 765','Street Triple'),('Street Triple 765','StreetTriple 765'),
('Speed Triple 1200','Speed Triple'),
('Panigale V4','1103 Panigale'),('Panigale V4','PanigaleV4'),
('Panigale V2','PanigaleV2'),('Panigale V2','959 Panigale'),
('Multistrada V4','MTS V4'),('Multistrada V4','Multistrada 1158'),
('390 Duke','Duke 390'),('390 Duke','390Duke'),('890 Duke','Duke 890'),('790 Duke','Duke 790'),
('1290 Super Duke R','Super Duke 1290'),('1290 Super Duke R','SDR 1290'),
('500 EXC-F','500EXC'),('500 EXC-F','EXC-F 500')
)
INSERT INTO public.bike_library_model_aliases (model_id, alias, alias_norm)
SELECT m.id, a.alias, public.garage_norm(a.alias)
  FROM a JOIN public.bike_library_models m ON public.garage_norm(m.model) = public.garage_norm(a.model)
ON CONFLICT (model_id, alias_norm) DO NOTHING;

INSERT INTO public.bike_library_platforms (make, code, name)
SELECT DISTINCT m.make, m.platform, m.platform
  FROM public.bike_library_models m
 WHERE m.platform IS NOT NULL AND btrim(m.platform) <> ''
ON CONFLICT DO NOTHING;