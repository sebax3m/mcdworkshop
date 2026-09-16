
-- Canonical ITEM label for a piece of text (NULL when it is not a type name)
CREATE OR REPLACE FUNCTION public.part_item_label(txt text)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE t text; k text;
BEGIN
  t := btrim(coalesce(txt,''));
  IF length(t) < 2 THEN RETURN NULL; END IF;
  k := lower(regexp_replace(t, '\s+', ' ', 'g'));
  RETURN CASE
    WHEN k IN ('engine oil','motor oil','oil') THEN 'Engine Oil'
    WHEN k = 'primary oil' THEN 'Primary Oil'
    WHEN k = 'final drive oil' THEN 'Final Drive Oil'
    WHEN k IN ('gear oil','transmission oil') THEN 'Gear Oil'
    WHEN k IN ('fork oil','fork oil 10w') THEN 'Fork Oil'
    WHEN k = 'oil filter' THEN 'Oil Filter'
    WHEN k = 'air filter' THEN 'Air Filter'
    WHEN k = 'fuel filter' THEN 'Fuel Filter'
    WHEN k IN ('spark plug','spark plugs','hd spark-plug','hd spark plug') THEN 'Spark Plugs'
    WHEN k IN ('brake pad','brake pads') THEN 'Brake Pads'
    WHEN k IN ('brake disc','brake discs') THEN 'Brake Discs'
    WHEN k IN ('brake fluid','brake fluids') THEN 'Brake Fluid'
    WHEN k = 'coolant' THEN 'Coolant'
    WHEN k = 'chain' THEN 'Chain'
    WHEN k IN ('sprocket','sprockets') THEN 'Sprocket'
    WHEN k IN ('tyre','tire') THEN 'Tyre'
    WHEN k = 'front tyre' THEN 'Front Tyre'
    WHEN k = 'rear tyre' THEN 'Rear Tyre'
    WHEN k = 'battery' THEN 'Battery'
    WHEN k IN ('fork seal','fork seals') THEN 'Fork Seals'
    WHEN k = 'dust seals' THEN 'Dust Seals'
    WHEN k IN ('consumables','shop consumables','workshop consumables') THEN 'Consumables'
    WHEN k IN ('wof','warrant of fitness') THEN 'WOF'
    WHEN k = 'carry fee' THEN 'Carry Fee'
    WHEN k = 'ecu scan' THEN 'ECU Scan'
    WHEN k IN ('tuning','dyno') THEN 'Tuning'
    WHEN k = 'fuel' THEN 'Fuel'
    WHEN k = 'labour' THEN 'Labour'
    WHEN t !~ '[0-9]'
     AND array_length(regexp_split_to_array(t, '\s+'), 1) <= 4
     AND t ~ '^[A-Za-z][A-Za-z\s&/''-]*$'
     AND k !~ '(motul|castrol|spectro|shell|ngk|denso|hiflo|vesrah|michelin|pirelli|dunlop|bridgestone|shinko|metzeler|continental|yuasa|brembo|ebc|tourmax|kiwix|protaper|renthal)'
      THEN initcap(t)
    ELSE NULL
  END;
END $$;

-- Fallback: work the type out from any free text
CREATE OR REPLACE FUNCTION public.part_item_guess(txt text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE
    WHEN txt ~* '(oil\s*filter|\bhf\s?[0-9]{2,4}\b)' THEN 'Oil Filter'
    WHEN txt ~* '(air\s*filter|\bhfa[0-9]|k&?n.*filter)' THEN 'Air Filter'
    WHEN txt ~* 'fuel\s*filter' THEN 'Fuel Filter'
    WHEN txt ~* '(spark\s*plug|\bngk\b|iridium|\bcr[0-9]|\blmar[0-9]|\bmar[0-9])' THEN 'Spark Plugs'
    WHEN txt ~* '(brake\s*pad|sintered\s*pad)' THEN 'Brake Pads'
    WHEN txt ~* '(brake\s*(disc|rotor))' THEN 'Brake Discs'
    WHEN txt ~* '(brake\s*fluid|\bdot\s*[3-9]|\brbf\s?[0-9]{3})' THEN 'Brake Fluid'
    WHEN txt ~* '(coolant|motocool|antifreeze|inugel)' THEN 'Coolant'
    WHEN txt ~* '(fork\s*oil|suspension\s*fluid)' THEN 'Fork Oil'
    WHEN txt ~* 'fork\s*seal' THEN 'Fork Seals'
    WHEN txt ~* 'chain\s*(lube|wax)' THEN 'Chain Lube'
    WHEN txt ~* 'chain\s*(clean|degrease)' THEN 'Chain Cleaner'
    WHEN txt ~* '(chain\s*&\s*sprocket|sprocket)' THEN 'Sprocket'
    WHEN txt ~* '(\bchain\b|\bdid\b\s*[0-9]|[0-9]{3}(v|zvm|vx))' THEN 'Chain'
    WHEN txt ~* '(tyre|tire|michelin|pirelli|dunlop|bridgestone|shinko|metzeler|[0-9]{3}/[0-9]{2}-?1[0-9])' THEN 'Tyre'
    WHEN txt ~* '(battery|yuasa|ytx[0-9])' THEN 'Battery'
    WHEN txt ~* '(bulb|headlight|indicator|\bled\b|fuse|relay|coil|stator|regulator|sensor|injector|fuel\s*pump)' THEN 'Electrical'
    WHEN txt ~* '(cable|throttle\s*wire|hose|line)' THEN 'Cable'
    WHEN txt ~* '(bearing|\bseal\b|bush(ing)?)' THEN 'Bearings / Seals'
    WHEN txt ~* '(gasket|o-?ring|crush\s*washer)' THEN 'Gasket'
    WHEN txt ~* '\bbelt\b' THEN 'Belt'
    WHEN txt ~* 'clutch' THEN 'Clutch'
    WHEN txt ~* '(piston|\bvalve\b|\bcam\b|tensioner|water\s*pump|cylinder)' THEN 'Engine Part'
    WHEN txt ~* '(slider|crash|fairing|mirror|lever|guard|screen|\bbar\b)' THEN 'Bodywork'
    WHEN txt ~* '(bolt|\bnut\b|screw|washer|clip|zip\s*tie)' THEN 'Hardware'
    WHEN txt ~* '(consumable|cleaner|degreaser|grease|silicone|\brag\b|wd-?40|loctite)' THEN 'Consumables'
    WHEN txt ~* '(primary\s*oil)' THEN 'Primary Oil'
    WHEN txt ~* '([0-9]{1,2}w-?[0-9]{2}|engine\s*oil|\b(5100|7100|300v|3000|710)\b|motul|castrol|spectro)' THEN 'Engine Oil'
    ELSE 'Part'
  END
$$;

-- Choose the ITEM (type) for a stored row
CREATE OR REPLACE FUNCTION public.part_item_of(p_code text, p_name text, p_supp text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT coalesce(
    public.part_item_label(p_code),
    public.part_item_label(p_supp),
    public.part_item_label(p_name),
    public.part_item_guess(concat_ws(' ', p_name, p_supp, p_code))
  )
$$;

-- Choose the DESCRIPTION (exact product) for a stored row
CREATE OR REPLACE FUNCTION public.part_desc_of(p_code text, p_name text, p_supp text, p_item text)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE c text; best text := NULL; fallback text := NULL;
BEGIN
  FOREACH c IN ARRAY ARRAY[coalesce(p_supp,''), coalesce(p_name,''), coalesce(p_code,'')] LOOP
    c := btrim(c);
    CONTINUE WHEN length(c) < 2 OR lower(c) = lower(coalesce(p_item,''));
    IF best IS NULL AND (c ~ '[0-9]' OR c ~* '(motul|castrol|spectro|ngk|denso|hiflo|vesrah|michelin|pirelli|dunlop|bridgestone|shinko|did|yuasa|k&n|brembo|ebc|tourmax|kiwix|protaper)'
        OR array_length(regexp_split_to_array(c, '\s+'), 1) > 3) THEN
      best := c;
    END IF;
    IF fallback IS NULL THEN fallback := c; END IF;
  END LOOP;
  RETURN coalesce(best, fallback, p_item);
END $$;

-- ── Backfill job part lines (all invoices, paid or not) ───────────────────
UPDATE public.parts p
SET part_number = x.item,
    supplier    = x.descr,
    name        = x.descr
FROM (
  SELECT id,
         public.part_item_of(part_number, name, supplier) AS item,
         public.part_desc_of(part_number, name, supplier,
           public.part_item_of(part_number, name, supplier)) AS descr
  FROM public.parts
) x
WHERE p.id = x.id
  AND EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = p.job_id)
  AND x.item IS NOT NULL
  AND (coalesce(p.part_number,'') <> x.item OR coalesce(p.supplier,'') <> x.descr);

-- ── Backfill the inventory library (sku = ITEM, name = product) ───────────
UPDATE public.inventory_items i
SET sku  = x.item,
    name = x.descr
FROM (
  SELECT id,
         public.part_item_of(sku, name, NULL) AS item,
         public.part_desc_of(sku, name, NULL,
           public.part_item_of(sku, name, NULL)) AS descr
  FROM public.inventory_items
) x
WHERE i.id = x.id
  AND x.item IS NOT NULL
  AND x.descr IS NOT NULL
  AND (coalesce(i.sku,'') <> x.item OR coalesce(i.name,'') <> x.descr);
