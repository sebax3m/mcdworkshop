import { supabase } from "@/integrations/supabase/client";
import type { RegoLookupResult } from "@/lib/rego-lookup.functions";

export type LocalBikeRecord = {
  id: string;
  make?: string;
  model?: string;
  year?: number;
  vin?: string;
  color?: string;
  rego?: string;
  wof_expiry?: string;
  rego_expiry?: string;
  customer_id?: string | null;
};

/**
 * After a successful Carjam fetch, persist the data onto the existing
 * workshop motorcycle record right away — even if the booking is never
 * finished. Expiry dates are refreshed (they change over time); identity
 * fields only fill blanks so we never clobber staff-entered data.
 */
export async function saveCarjamDataToBike(
  bikeId: string,
  r: RegoLookupResult,
  current?: LocalBikeRecord | null,
): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (r.wof_expiry) patch.wof_expiry = r.wof_expiry;
  if (r.rego_expiry) patch.rego_expiry = r.rego_expiry;
  if (r.vin && !current?.vin) patch.vin = r.vin;
  if (r.color && !current?.color) patch.color = r.color;
  if (r.make && !current?.make) patch.make = r.make;
  if (r.model && !current?.model) patch.model = r.model;
  if (r.year && !current?.year) patch.year = r.year;
  if (Object.keys(patch).length === 0) return;
  await (supabase as any).from("motorcycles").update(patch).eq("id", bikeId);
}

/** Fields we consider "complete" for a workshop record. */
export function localBikeMissingFields(b: LocalBikeRecord): string[] {
  const missing: string[] = [];
  if (!b.make) missing.push("make");
  if (!b.model) missing.push("model");
  if (!b.year) missing.push("year");
  if (!b.vin) missing.push("VIN");
  if (!b.wof_expiry) missing.push("WOF expiry");
  if (!b.rego_expiry) missing.push("rego expiry");
  return missing;
}

/**
 * Expiry problems on a local bike record: WOF/rego already expired, or
 * expiring within `withinDays` (default 30). If both are still comfortably
 * valid, there's no reason to spend a Carjam lookup.
 */
export function localBikeExpiryIssues(b: LocalBikeRecord, withinDays = 30): string[] {
  const issues: string[] = [];
  const today = new Date(new Date().toDateString());
  const soon = new Date(today);
  soon.setDate(soon.getDate() + withinDays);
  const fmt = (iso: string) => {
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
  };
  const check = (iso: string | undefined, label: string) => {
    if (!iso) return; // missing is reported by localBikeMissingFields
    const d = new Date(`${iso}T00:00:00`);
    if (Number.isNaN(d.getTime())) return;
    if (d < today) issues.push(`${label} expired ${fmt(iso)}`);
    else if (d <= soon) issues.push(`${label} expires ${fmt(iso)}`);
  };
  check(b.wof_expiry, "WOF");
  check(b.rego_expiry, "rego");
  return issues;
}


/**
 * Search the workshop's own motorcycle records by rego plate before
 * spending a Carjam lookup. Returns the best match or null.
 */
export async function findLocalBikeByRego(plate: string): Promise<LocalBikeRecord | null> {
  const clean = plate.trim().toUpperCase().replace(/\s+/g, "");
  if (!clean) return null;
  const { data, error } = await (supabase as any)
    .from("motorcycles")
    .select("id, make, model, year, vin, color, rego, wof_expiry, rego_expiry, customer_id")
    .ilike("rego", clean)
    .limit(5);
  if (error || !data?.length) return null;
  // Prefer the exact normalized match, then the most complete record.
  const norm = (s?: string) => (s ?? "").toUpperCase().replace(/\s+/g, "");
  const exact = data.find((b: any) => norm(b.rego) === clean);
  const best = (exact ?? data[0]) as LocalBikeRecord;
  return best;
}
