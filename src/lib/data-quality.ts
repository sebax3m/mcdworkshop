/**
 * Shared data-quality helpers for Customers and Motorcycles.
 * Comparison-only: never mutates or rewrites stored values.
 */

const PLACEHOLDER_NAMES = new Set([
  "job",
  "service",
  "test",
  "unknown",
  "customer",
  "bike",
  "motorcycle",
  "workshop",
  "booking",
  "none",
  "n/a",
  "na",
]);

const PLACEHOLDER_BIKE_VALUES = new Set([
  "unknown",
  "test",
  "bike",
  "motorcycle",
  "job",
  "-",
  "n/a",
  "na",
  "none",
]);

/** Digits-only NZ-aware phone key used for duplicate detection. */
export function normalizePhone(raw: string | null | undefined): string {
  if (!raw) return "";
  let d = String(raw).replace(/[^\d+]/g, "");
  if (d.startsWith("+64")) d = "0" + d.slice(3);
  else if (d.startsWith("0064")) d = "0" + d.slice(4);
  else if (d.startsWith("64") && d.length >= 10) d = "0" + d.slice(2);
  d = d.replace(/\D/g, "");
  if (d.length > 1 && !d.startsWith("0")) d = "0" + d;
  return d;
}

export function hasPhone(raw: string | null | undefined): boolean {
  return normalizePhone(raw).length >= 8;
}

export function normalizeRego(raw: string | null | undefined): string {
  return String(raw ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

export function normalizeVin(raw: string | null | undefined): string {
  return String(raw ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

/** Placeholder / junk name detection (case-insensitive). */
export function isSuspiciousName(...parts: (string | null | undefined)[]): boolean {
  const joined = parts
    .map((p) => String(p ?? "").trim())
    .filter(Boolean)
    .join(" ")
    .trim();
  if (!joined) return true;
  const lower = joined.toLowerCase();
  if (PLACEHOLDER_NAMES.has(lower)) return true;
  // any single token that is a placeholder word on its own
  const tokens = lower.split(/[\s/,.-]+/).filter(Boolean);
  if (tokens.length > 0 && tokens.every((t) => PLACEHOLDER_NAMES.has(t))) return true;
  if (/^[0-9\s]+$/.test(joined)) return true; // only numbers
  if (!/[a-z]/i.test(joined)) return true; // only punctuation/symbols
  return false;
}

export function isSuspiciousBikeValue(value: string | null | undefined): boolean {
  const v = String(value ?? "").trim();
  if (!v) return true;
  if (PLACEHOLDER_BIKE_VALUES.has(v.toLowerCase())) return true;
  if (/^[0-9\s]+$/.test(v)) return true;
  if (!/[a-z]/i.test(v)) return true;
  return false;
}

export type CustomerLike = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  is_archived?: boolean | null;
};

export function isCustomerSuspicious(c: CustomerLike): boolean {
  return isSuspiciousName(c.first_name, c.last_name);
}

export function isCustomerValid(c: CustomerLike): boolean {
  return (
    !!String(c.first_name ?? "").trim() && hasPhone(c.phone) && !isCustomerSuspicious(c)
  );
}

export type BikeLike = {
  id: string;
  customer_id?: string | null;
  make?: string | null;
  model?: string | null;
  rego?: string | null;
  vin?: string | null;
  is_archived?: boolean | null;
};

export function isBikeSuspicious(b: BikeLike): boolean {
  return isSuspiciousBikeValue(b.make) || isSuspiciousBikeValue(b.model);
}

/** Rego/VIN are optional (dirt & race bikes legitimately lack them). */
export function isBikeValid(b: BikeLike, hasOwner: boolean): boolean {
  return (
    hasOwner &&
    !!String(b.make ?? "").trim() &&
    !!String(b.model ?? "").trim() &&
    !isBikeSuspicious(b)
  );
}

/** Group rows by a normalized key, returning only groups with 2+ members. */
export function duplicateGroups<T>(
  rows: T[],
  keyOf: (row: T) => string,
): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const key = keyOf(row);
    if (!key) continue;
    const arr = map.get(key) ?? [];
    arr.push(row);
    map.set(key, arr);
  }
  for (const [k, v] of map) if (v.length < 2) map.delete(k);
  return map;
}

export function duplicateIds<T extends { id: string }>(groups: Map<string, T[]>): Set<string> {
  const ids = new Set<string>();
  for (const rows of groups.values()) for (const r of rows) ids.add(r.id);
  return ids;
}
