/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Learn from invoice edits: when a part/line price is changed on an invoice,
 * push that price back into the inventory library so future jobs quote the
 * up-to-date price. Matches inventory items by name (case-insensitive) or SKU.
 */
export async function learnInventoryPrice(
  rawName: string | null | undefined,
  unitPrice: number | null | undefined,
  opts: { silent?: boolean } = {},
) {
  const name = (rawName ?? "").trim();
  const price = Number(unitPrice);
  if (!name || !Number.isFinite(price) || price <= 0) return;

  const { data, error } = await supabase
    .from("inventory_items")
    .select("id, name, sku, unit_price")
    .or(`name.ilike.${escapeFilter(name)},sku.ilike.${escapeFilter(name)}`)
    .limit(5);

  if (error || !data?.length) return;

  const match =
    data.find((i: any) => (i.name ?? "").trim().toLowerCase() === name.toLowerCase()) ??
    data.find((i: any) => (i.sku ?? "").trim().toLowerCase() === name.toLowerCase());
  if (!match) return;

  const current = Number(match.unit_price ?? 0);
  if (Math.abs(current - price) < 0.005) return;

  const { error: upErr } = await supabase
    .from("inventory_items")
    .update({ unit_price: price })
    .eq("id", match.id);
  if (upErr) return;

  if (!opts.silent) {
    toast.success(
      `Inventory updated — ${match.name}: $${current.toFixed(2)} → $${price.toFixed(2)}`,
    );
  }
}

function escapeFilter(v: string) {
  // commas and parens break PostgREST `or` filters
  return v.replace(/[(),]/g, " ").trim();
}
