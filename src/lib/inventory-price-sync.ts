/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Learn from invoice edits: when a part/line price is changed on an invoice,
 * push that price back into the inventory library so future jobs quote the
 * up-to-date price.
 *
 * Matching is done on any of the identifiers we know for the line: the part
 * number / code (ITEM column), the plain name, and the description text.
 * Inventory rows are matched on their `sku` or `name`.
 */
export async function learnInventoryPrice(
  keysInput: string | null | undefined | (string | null | undefined)[],
  unitPrice: number | null | undefined,
  opts: { silent?: boolean } = {},
) {
  const keys = (Array.isArray(keysInput) ? keysInput : [keysInput])
    .map((k) => (k ?? "").trim())
    .filter((k) => k.length >= 2);
  const price = Number(unitPrice);
  if (!keys.length || !Number.isFinite(price) || price <= 0) return;

  const uniqueKeys = Array.from(new Set(keys.map((k) => k.toLowerCase()))).map(
    (lower) => keys.find((k) => k.toLowerCase() === lower)!,
  );

  const filters = uniqueKeys
    .flatMap((k) => {
      const safe = escapeFilter(k);
      return safe ? [`name.ilike.${safe}`, `sku.ilike.${safe}`] : [];
    })
    .join(",");
  if (!filters) return;

  const { data, error } = await supabase
    .from("inventory_items")
    .select("id, name, sku, unit_price")
    .or(filters)
    .limit(20);

  if (error || !data?.length) return;

  const lowered = uniqueKeys.map((k) => k.toLowerCase());
  const norm = (v: any) => (v ?? "").toString().trim().toLowerCase();

  // The DESCRIPTION (inventory `name`) identifies the exact product, so it
  // always wins. The ITEM code (`sku`) is a generic category like
  // "Spark Plugs" shared by many products — only trust it when it maps to a
  // single inventory row, otherwise we'd overwrite an unrelated product.
  const nameMatches = data.filter((i: any) => lowered.includes(norm(i.name)));
  const skuMatches = data.filter((i: any) => lowered.includes(norm(i.sku)));

  const match =
    (nameMatches.length === 1 ? nameMatches[0] : undefined) ??
    (skuMatches.length === 1 ? skuMatches[0] : undefined);
  if (!match) return;


  const current = Number(match.unit_price ?? 0);
  if (Math.abs(current - price) < 0.005) return;

  const { error: upErr } = await supabase
    .from("inventory_items")
    .update({ unit_price: price })
    .eq("id", match.id);
  if (upErr) {
    if (!opts.silent) toast.error(`Couldn't update inventory price: ${upErr.message}`);
    return;
  }

  if (!opts.silent) {
    toast.success(
      `Inventory updated — ${match.name}: $${current.toFixed(2)} → $${price.toFixed(2)}`,
    );
  }
}

function escapeFilter(v: string) {
  // commas, parens and wildcards break PostgREST `or` filters
  return v.replace(/[(),*]/g, " ").replace(/\s{2,}/g, " ").trim();
}
