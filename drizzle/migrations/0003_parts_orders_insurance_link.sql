ALTER TABLE public.booking_parts ALTER COLUMN booking_id DROP NOT NULL;
ALTER TABLE public.booking_parts
  ADD COLUMN IF NOT EXISTS claim_id uuid REFERENCES public.insurance_claims(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS quote_item_id text,
  ADD COLUMN IF NOT EXISTS cost numeric,
  ADD COLUMN IF NOT EXISTS sell_price numeric,
  ADD COLUMN IF NOT EXISTS tracking_number text,
  ADD COLUMN IF NOT EXISTS tracking_url text,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'booking';
ALTER TABLE public.booking_parts DROP CONSTRAINT IF EXISTS booking_parts_status_chk;
ALTER TABLE public.booking_parts ADD CONSTRAINT booking_parts_status_chk CHECK (status = ANY (ARRAY['needs_ordering','quote_requested','ordered','backordered','partially_shipped','shipped','ready_for_collection','partially_received','arrived','cancelled']));
ALTER TABLE public.booking_parts ADD CONSTRAINT booking_parts_owner_chk CHECK (booking_id IS NOT NULL OR claim_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS booking_parts_claim_idx ON public.booking_parts(claim_id);
CREATE UNIQUE INDEX IF NOT EXISTS booking_parts_claim_quote_item_uq ON public.booking_parts(claim_id, quote_item_id) WHERE claim_id IS NOT NULL AND quote_item_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.create_claim_parts_on_approval()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'approved' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'approved') THEN
    INSERT INTO public.booking_parts (claim_id, quote_item_id, description, part_number, qty_required, sell_price, status, source, sort_order)
    SELECT NEW.id,
           COALESCE(it->>'id', md5(it::text)),
           COALESCE(NULLIF(trim(concat_ws(' — ', NULLIF(it->>'item_name',''), NULLIF(it->>'description',''))),''), 'Part'),
           NULLIF(it->>'item_code',''),
           GREATEST(COALESCE(NULLIF(it->>'qty','')::numeric, 1), 1)::int,
           NULLIF(it->>'unit_price','')::numeric,
           'needs_ordering', 'insurance', ord::int
    FROM jsonb_array_elements(COALESCE(NEW.quote_items, '[]'::jsonb)) WITH ORDINALITY AS t(it, ord)
    WHERE COALESCE(it->>'kind','part') <> 'labour'
    ON CONFLICT (claim_id, quote_item_id) WHERE claim_id IS NOT NULL AND quote_item_id IS NOT NULL DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_claim_parts_on_approval ON public.insurance_claims;
CREATE TRIGGER trg_claim_parts_on_approval AFTER INSERT OR UPDATE OF status ON public.insurance_claims
FOR EACH ROW EXECUTE FUNCTION public.create_claim_parts_on_approval();