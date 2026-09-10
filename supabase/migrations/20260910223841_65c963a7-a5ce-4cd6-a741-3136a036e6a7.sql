UPDATE public.parts p
SET supplier = NULL
WHERE p.supplier IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.inventory_items i
    WHERE i.brand IS NOT NULL AND lower(i.brand) = lower(p.supplier)
  );