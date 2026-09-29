CREATE OR REPLACE FUNCTION public.parts_supplier_stats()
 RETURNS TABLE(supplier text, orders bigint, parts bigint, last_order date, avg_lead_days numeric, avg_cost numeric)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT h.supplier, count(*) AS orders, count(DISTINCT h.catalog_id) AS parts,
         max(coalesce(h.ordered_at, h.received_at)) AS last_order,
         round(avg(h.lead_days) FILTER (WHERE h.lead_days BETWEEN 0 AND 365)::numeric, 1) AS avg_lead_days,
         round(avg(h.cost)::numeric, 2) AS avg_cost
    FROM parts_purchase_history h
   WHERE h.supplier IS NOT NULL AND h.supplier <> ''
   GROUP BY h.supplier
   ORDER BY count(*) DESC;
$function$;