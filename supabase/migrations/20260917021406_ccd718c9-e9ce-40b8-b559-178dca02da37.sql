DO $$
DECLARE
  grp RECORD; dup RECORD; t text; keeper uuid;
  child_tables text[] := ARRAY['bike_library_labour','bike_library_model_aliases','bike_library_parts','bike_library_torque','garage_bike_overrides','garage_checklists','garage_documents','garage_fluid_specs','garage_notes','garage_observations','garage_queries','garage_research_requests','garage_research_results','garage_revisions','garage_tech_specs','garage_update_proposals','garage_valve_specs','mcd_tech_conversations','motorcycle_model_links'];
BEGIN
  FOR grp IN
    SELECT public.garage_norm(make) AS mk, public.garage_norm(model) AS md
      FROM public.bike_library_models
     WHERE is_archived = false
     GROUP BY 1,2
    HAVING count(*) > 1
  LOOP
    SELECT id INTO keeper
      FROM public.bike_library_models
     WHERE is_archived = false
       AND public.garage_norm(make) = grp.mk
       AND public.garage_norm(model) = grp.md
     ORDER BY created_at ASC NULLS LAST, id
     LIMIT 1;

    FOR dup IN
      SELECT * FROM public.bike_library_models
       WHERE is_archived = false
         AND public.garage_norm(make) = grp.mk
         AND public.garage_norm(model) = grp.md
         AND id <> keeper
    LOOP
      -- keep a searchable alias for the old generation label
      IF dup.generation IS NOT NULL AND btrim(dup.generation) <> '' THEN
        INSERT INTO public.bike_library_model_aliases (model_id, alias, alias_norm)
        SELECT keeper, dup.generation, public.garage_norm(dup.generation)
        WHERE NOT EXISTS (
          SELECT 1 FROM public.bike_library_model_aliases a
           WHERE a.model_id = keeper AND a.alias_norm = public.garage_norm(dup.generation));
      END IF;

      -- drop rows that would collide on unique keys after repointing
      DELETE FROM public.bike_library_model_aliases a
       WHERE a.model_id = dup.id
         AND EXISTS (SELECT 1 FROM public.bike_library_model_aliases b
                      WHERE b.model_id = keeper AND b.alias_norm = a.alias_norm);
      DELETE FROM public.garage_research_requests r
       WHERE r.model_id = dup.id
         AND EXISTS (SELECT 1 FROM public.garage_research_requests k
                      WHERE k.model_id = keeper
                        AND k.category IS NOT DISTINCT FROM r.category
                        AND k.subject IS NOT DISTINCT FROM r.subject
                        AND k.field IS NOT DISTINCT FROM r.field);

      FOREACH t IN ARRAY child_tables LOOP
        EXECUTE format('UPDATE public.%I SET model_id = $1 WHERE model_id = $2', t) USING keeper, dup.id;
      END LOOP;

      DELETE FROM public.bike_library_models WHERE id = dup.id;

      -- widen the year window on the keeper (after the duplicate row is gone)
      UPDATE public.bike_library_models k
         SET year_from = LEAST(COALESCE(k.year_from, dup.year_from), COALESCE(dup.year_from, k.year_from)),
             year_to   = CASE WHEN k.year_to IS NULL OR dup.year_to IS NULL THEN NULL
                              ELSE GREATEST(k.year_to, dup.year_to) END,
             platform  = COALESCE(NULLIF(btrim(k.platform,''),''), dup.platform),
             engine    = COALESCE(NULLIF(btrim(k.engine,''),''), dup.engine),
             category  = COALESCE(k.category, dup.category)
       WHERE k.id = keeper;
    END LOOP;
  END LOOP;
END $$;