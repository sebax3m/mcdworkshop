/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Learn from invoice edits of the ITEM (part number) and DESCRIPTION columns.
 *
 * When someone corrects how a part is written on an invoice we treat that as
 * the new house format and push it back across the program:
 *   - the inventory library row (sku = item code, name = description)
 *   - the edited invoice line only; historical invoice lines are never mass-edited
 *     because plain ITEM labels such as "Handlebars" are shared categories, not
 *     unique product identifiers
 */
export async function learnPartNaming(args: {
  /** Identifiers the line had BEFORE the edit. */
  previous: { part_number?: string | null; name?: string | null; supplier?: string | null };
  /** New values entered by the user (only the edited one is required). */
  next: { part_number?: string | null; supplier?: string | null };
  /** Don't touch this parts row (it was just saved). */
  skipPartId?: string;
  silent?: boolean;
}) {
  const nextCode = clean(args.next.part_number);
  const nextDesc = clean(args.next.supplier);
  if (!nextCode && !nextDesc) return;

  const prevCode = clean(args.previous.part_number);
  const prevName = clean(args.previous.name);
  const prevDesc = clean(args.previous.supplier);

  // ITEM is a shared category (for example, many unrelated products are
  // "Engine Oil"). Match inventory by the former product description/name so
  // editing one invoice cannot rename an unrelated product or whole category.
  const productKeys = uniq([prevDesc, prevName].filter((k): k is string => !!k && k.length >= 2));
  const keys = productKeys.length ? productKeys : [prevCode].filter((k) => looksProductSpecific(k));

  await updateInventory({
    keys,
    prevDesc: prevDesc || prevName,
    nextCode,
    nextDesc,
    silent: args.silent,
  });
}

async function updateInventory(o: {
  keys: string[];
  prevDesc: string;
  nextCode: string;
  nextDesc: string;
  silent?: boolean;
}) {
  const matchRow = o.keys.length ? await findInventoryRow(o.keys) : null;

  // Is this the same product written better, or a different product?
  // A different DESCRIPTION means a different product, so we must never
  // rename the existing library row — we add a new one instead.
  const sameProduct =
    !o.nextDesc || !o.prevDesc || productKey(o.nextDesc) === productKey(o.prevDesc);

  if (matchRow && sameProduct) {
    const patch: { sku?: string; name?: string } = {};
    if (o.nextCode && norm(matchRow.sku) !== o.nextCode.toLowerCase()) patch.sku = o.nextCode;
    if (o.nextDesc && norm(matchRow.name) !== o.nextDesc.toLowerCase()) patch.name = o.nextDesc;
    if (!Object.keys(patch).length) return;
    const { error } = await supabase.from("inventory_items").update(patch).eq("id", matchRow.id);
    if (error) {
      if (!o.silent) toast.error(`Couldn't update inventory item: ${error.message}`);
      return;
    }
    if (!o.silent) {
      toast.success(
        `Inventory updated — ${patch.sku ?? matchRow.sku ?? ""} ${patch.name ?? matchRow.name ?? ""}`.trim(),
      );
    }
    return;
  }

  // Different product (or nothing to learn from): only add a library row when
  // we have both halves of the house format and it isn't there already.
  if (!o.nextCode || !o.nextDesc) return;
  const existing = await findInventoryRow([o.nextDesc]);
  if (existing) return;
  const category = guessInventoryCategory(`${o.nextDesc} ${o.nextCode}`);
  const { error } = await supabase.from("inventory_items").insert({
    name: o.nextDesc,
    sku: o.nextCode,
    category,
    unit: categoryUnit(category),
    unit_price: 0,
  } as never);
  if (error) return;
  if (!o.silent) toast.success(`Added to inventory — ${o.nextCode} · ${o.nextDesc}`);
}

/** Exact (case-insensitive) match on the product DESCRIPTION, never on the shared ITEM label. */
async function findInventoryRow(keys: string[]) {
  const filters = keys
    .flatMap((k) => {
      const safe = escapeFilter(k);
      return safe ? [`name.ilike.${safe}`] : [];
    })
    .join(",");
  if (!filters) return null;
  const { data, error } = await supabase
    .from("inventory_items")
    .select("id, name, sku")
    .or(filters)
    .limit(20);
  if (error || !data?.length) return null;
  const lowered = keys.map((k) => k.toLowerCase());
  const matches = data.filter((i: any) => lowered.includes(norm(i.name)));
  return matches.length === 1 ? matches[0] : null;
}

const clean = (v?: string | null) => (v ?? "").trim();
const norm = (v: any) => (v ?? "").toString().trim().toLowerCase();
const productKey = (v: string) => v.toLowerCase().replace(/[^a-z0-9]/g, "");
const uniq = (a: string[]) => Array.from(new Set(a.map((s) => s.toLowerCase()))).map((l) => a.find((s) => s.toLowerCase() === l)!);
const looksProductSpecific = (value: string) => /\d/.test(value) || value.trim().split(/\s+/).length > 3;

function escapeFilter(v: string) {
  return v.replace(/[(),*]/g, " ").replace(/\s{2,}/g, " ").trim();
}

