
-- 300V is an oil grade, not a chain size: tighten the chain rule
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
    WHEN txt ~* '(chain\s*(&|and)\s*sprocket|sprocket)' THEN 'Sprocket'
    WHEN txt ~* '(\bchain\b|[0-9]{3}\s?(vx|zvm|v\s?x)[0-9])' THEN 'Chain'
    WHEN txt ~* '(tyre|tire|michelin|pirelli|dunlop|bridgestone|shinko|metzeler|[0-9]{3}/[0-9]{2}-?1[0-9])' THEN 'Tyre'
    WHEN txt ~* '(battery|yuasa|ytx[0-9])' THEN 'Battery'
    WHEN txt ~* '(handle\s*bar|\bbar\b.*(protaper|renthal)|protaper|renthal)' THEN 'Handlebars'
    WHEN txt ~* '(bulb|headlight|indicator|\bled\b|fuse|relay|coil|stator|regulator|sensor|injector|fuel\s*pump)' THEN 'Electrical'
    WHEN txt ~* '(cable|throttle\s*wire|hose|line)' THEN 'Cable'
    WHEN txt ~* '(bearing|\bseal\b|bush(ing)?)' THEN 'Bearings / Seals'
    WHEN txt ~* '(gasket|o-?ring|crush\s*washer)' THEN 'Gasket'
    WHEN txt ~* '\bbelt\b' THEN 'Belt'
    WHEN txt ~* 'clutch' THEN 'Clutch'
    WHEN txt ~* '(piston|\bvalve\b|\bcam\b|tensioner|water\s*pump|cylinder)' THEN 'Engine Part'
    WHEN txt ~* '(slider|crash|fairing|mirror|lever|guard|screen)' THEN 'Bodywork'
    WHEN txt ~* '(bolt|\bnut\b|screw|washer|clip|zip\s*tie)' THEN 'Hardware'
    WHEN txt ~* '(consumable|cleaner|degreaser|grease|silicone|\brag\b|wd-?40|loctite)' THEN 'Consumables'
    WHEN txt ~* 'primary\s*oil' THEN 'Primary Oil'
    WHEN txt ~* '([0-9]{1,2}w-?[0-9]{2}|engine\s*oil|\b(5100|7100|300v|3000|710)\b|motul|castrol|spectro)' THEN 'Engine Oil'
    ELSE 'Part'
  END
$$;

-- Re-run the type for rows whose ITEM is still a placeholder or plainly wrong
UPDATE public.parts p
SET part_number = public.part_item_guess(coalesce(p.supplier, p.name, ''))
WHERE EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = p.job_id)
  AND (
    p.part_number IN ('New Item', 'Part', 'Item', 'Custom Part')
    OR (p.part_number = 'Chain' AND coalesce(p.supplier,'') !~* '(chain|sprocket)')
  );

UPDATE public.inventory_items i
SET sku = public.part_item_guess(coalesce(i.name, ''))
WHERE i.sku IN ('New Item', 'Part', 'Item')
   OR (i.sku = 'Chain' AND coalesce(i.name,'') !~* '(chain|sprocket)');

-- Normalise the two spellings of the chain kit and odd initcaps
UPDATE public.inventory_items SET sku = 'Chain & Sprocket Kit'
WHERE sku IN ('Chain And Sprocket Kit', 'Chain And Sprockets', 'Chain & Sprockets');
UPDATE public.parts SET part_number = 'Chain & Sprocket Kit'
WHERE part_number IN ('Chain And Sprocket Kit', 'Chain And Sprockets', 'Chain & Sprockets');
UPDATE public.inventory_items SET sku = 'Electrical' WHERE sku = 'Ducati Injector Oem';
