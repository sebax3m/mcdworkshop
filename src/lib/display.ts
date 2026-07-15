/**
 * Null-safe display helpers for the Booking / Calendar UI.
 * Replaces literal null / undefined / NaN with a friendly fallback.
 */
export function dash(value: unknown, fallback = "—"): string {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "number") {
    if (Number.isNaN(value)) return fallback;
    return String(value);
  }
  const s = String(value).trim();
  if (!s || s === "null" || s === "undefined" || s === "NaN") return fallback;
  return s;
}

export function displayCustomerName(
  c:
    | {
        first_name?: string | null;
        last_name?: string | null;
      }
    | null
    | undefined,
): string {
  if (!c) return "—";
  const first = (c.first_name ?? "").trim();
  const last = (c.last_name ?? "").trim();
  const full = `${first} ${last}`.trim();
  return full || "—";
}

export function displayBike(
  m:
    | {
        year?: number | string | null;
        make?: string | null;
        model?: string | null;
      }
    | null
    | undefined,
): string {
  if (!m) return "—";
  const parts = [m.year, m.make, m.model]
    .map((p) => (p === null || p === undefined ? "" : String(p).trim()))
    .filter((s) => s && s !== "null" && s !== "undefined" && s !== "NaN");
  return parts.length ? parts.join(" ") : "—";
}

export function displayTime(t: string | null | undefined): string {
  if (!t) return "—";
  const s = String(t);
  return s.length >= 5 ? s.slice(0, 5) : s;
}

export function displayServiceType(
  serviceType: string | null | undefined,
  serviceTypeOther?: string | null,
): string {
  const base = dash(serviceType, "—");
  if (base === "Other" && serviceTypeOther && serviceTypeOther.trim()) {
    return `Other · ${serviceTypeOther.trim()}`;
  }
  return base;
}
