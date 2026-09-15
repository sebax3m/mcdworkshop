/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Learn from invoice edits of the ITEM (part number) and DESCRIPTION columns.
 *
 * When someone corrects how a part is written on an invoice we treat that as
 * the new house format and push it back across the program:
 *   - the inventory library row (sku = item code, name = description)
 *   - every other job part line that still uses the old code / description
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

  const keys = uniq([prevCode, prevName, prevDesc].filter((k): k is string => !!k && k.length >= 2));

  await updateInventory({ keys, nextCode, nextDesc, silent: args.silent });
  await updateSiblingParts({ prevCode, prevName, prevDesc, nextCode, nextDesc, skipPartId: args.skipPartId });
}

async function updateInventory(o: {
  keys: string[];
  nextCode: string;
  nextDesc: string;
  silent?: boolean;
}) {
  if (!o.keys.length) return;
  const filters = o.keys
    .flatMap((k) => {
      const safe = escapeFilter(k);
      return safe ? [`name.ilike.${safe}`, `sku.ilike.${safe}`] : [];
    })
    .join(",");
  if (!filters) return;

  const { data, error } = await supabase
    .from("inventory_items")
    .select("id, name, sku")
    .or(filters)
    .limit(20);
  if (error || !data?.length) return;

  const lowered = o.keys.map((k) => k.toLowerCase());
  const match =
    data.find((i: any) => lowered.includes(norm(i.sku))) ??
    data.find((i: any) => lowered.includes(norm(i.name))) ??
    (data.length === 1 ? data[0] : undefined);
  if (!match) return;

  const patch: { sku?: string; name?: string } = {};
  if (o.nextCode && norm(match.sku) !== o.nextCode.toLowerCase()) patch.sku = o.nextCode;
  if (o.nextDesc && norm(match.name) !== o.nextDesc.toLowerCase()) patch.name = o.nextDesc;
  if (!Object.keys(patch).length) return;

  const { error: upErr } = await supabase.from("inventory_items").update(patch).eq("id", match.id);
  if (upErr) {
    if (!o.silent) toast.error(`Couldn't update inventory item: ${upErr.message}`);
    return;
  }
  if (!o.silent) {
    toast.success(`Inventory updated — ${patch.sku ?? match.sku ?? ""} ${patch.name ?? match.name ?? ""}`.trim());
  }
}

async function updateSiblingParts(o: {
  prevCode: string;
  prevName: string;
  prevDesc: string;
  nextCode: string;
  nextDesc: string;
  skipPartId?: string;
}) {
  // Only re-write other lines when we can identify them by a real code.
  const key = o.prevCode || o.prevName;
  if (!key || key.length < 3) return;

  const patch: { part_number?: string; supplier?: string } = {};
  if (o.nextCode) patch.part_number = o.nextCode;
  if (o.nextDesc) patch.supplier = o.nextDesc;
  if (!Object.keys(patch).length) return;

  let q = supabase.from("parts").update(patch);
  q = o.prevCode ? q.ilike("part_number", o.prevCode) : q.ilike("name", o.prevName);
  if (o.skipPartId) q = q.neq("id", o.skipPartId);
  await q;
}

const clean = (v?: string | null) => (v ?? "").trim();
const norm = (v: any) => (v ?? "").toString().trim().toLowerCase();
const uniq = (a: string[]) => Array.from(new Set(a.map((s) => s.toLowerCase()))).map((l) => a.find((s) => s.toLowerCase() === l)!);

function escapeFilter(v: string) {
  return v.replace(/[(),*]/g, " ").replace(/\s{2,}/g, " ").trim();
}
