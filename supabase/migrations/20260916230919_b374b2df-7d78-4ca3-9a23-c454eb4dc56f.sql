
DELETE FROM public.inventory_items a
USING public.inventory_items b
WHERE lower(a.sku) = lower(b.sku)
  AND lower(a.name) = lower(b.name)
  AND a.id <> b.id
  AND (
    coalesce(a.unit_price,0) < coalesce(b.unit_price,0)
    OR (coalesce(a.unit_price,0) = coalesce(b.unit_price,0) AND a.created_at > b.created_at)
  );
