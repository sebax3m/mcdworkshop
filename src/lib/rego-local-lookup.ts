import { supabase } from "@/integrations/supabase/client";

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
