/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const ITEM_PREFIX =
  /^(chain|oil filter|air filter|brake pads?|spark plugs?|engine oil|tyre|battery|front sprocket|rear sprocket)\s+/i;

/** Normalised product key: drops the ITEM prefix, spaces and punctuation so
 *  "Chain DID 525VX3 -120ZB" and "DID 525VX3-120ZB" match. */
export function productKey(v: string | null | undefined) {
  return (v ?? "").trim().replace(ITEM_PREFIX, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Learn from invoice edits: when a line price changes on an invoice, push it
 * back into the inventory library and the parts catalogue. DESCRIPTION
 * (exact product) is matched loosely; the generic ITEM code only when unique.
 */
export async function learnInventoryPrice(
  keysInput: string | null | undefined | (string | null | undefined)[],
  unitPrice: number | null | undefined,
  opts: { silent?: boolean } = {},
) {
  const raw = (Array.isArray(keysInput) ? keysInput : [keysInput]).map((k) => (k ?? "").trim());
  const price = Number(unitPrice);
  if (!Number.isFinite(price) || price <= 0) return;
  // Specific keys (≥5 normalised chars) identify a product; short/generic ones don't.
  const keys = Array.from(new Set(raw.map(productKey).filter((k) => k.length >= 5)));
  const exact = new Set(raw.filter((k) => k.length >= 2).map((k) => k.toLowerCase()));
  if (!keys.length && !exact.size) return;

  const { data } = await supabase.from("inventory_items").select("id, name, sku, unit_price").limit(5000);
  const items = data ?? [];
  let matches = items.filter((i: any) => keys.includes(productKey(i.name)));
  if (!matches.length) {
    const sku = items.filter((i: any) => exact.has((i.sku ?? "").toLowerCase()));
    if (sku.length === 1) matches = sku;
  }

  const changed = matches.filter((m: any) => Math.abs(Number(m.unit_price ?? 0) - price) >= 0.005);
  for (const m of changed) {
    const { error } = await supabase.from("inventory_items").update({ unit_price: price }).eq("id", m.id);
    if (error && !opts.silent) toast.error(`Couldn't update library price: ${error.message}`);
  }

  // Parts catalogue (Settings → Parts & Suppliers): last_sell is ex-GST.
  if (keys.length) {
    const { data: cat } = await supabase.from("parts_catalog").select("id, description, last_sell").limit(5000);
    const exGst = Math.round((price / 1.15) * 100) / 100;
    for (const c of (cat ?? []).filter((c: any) => keys.includes(productKey(c.description)))) {
      if (Math.abs(Number(c.last_sell ?? 0) - exGst) < 0.005) continue;
      await supabase.from("parts_catalog").update({ last_sell: exGst } as never).eq("id", c.id);
    }
  }

  if (!opts.silent && changed.length) {
    toast.success(`Library updated — ${changed[0].name}: $${price.toFixed(2)}`);
  }
}
