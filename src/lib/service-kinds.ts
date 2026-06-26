export type ServiceKind = "basic" | "standard" | "annual" | "full" | "dyno" | "collision" | "other";

export function detectServiceKind(title?: string | null): ServiceKind {
  const t = (title ?? "").toLowerCase();
  if (t.includes("collision") || t.includes("insurance") || t.includes("crash") || t.includes("accident")) return "collision";
  if (t.includes("full")) return "full";
  if (t.includes("annual")) return "annual";
  if (t.includes("standard")) return "standard";
  if (t.includes("basic") || t.includes("minor")) return "basic";
  if (t.includes("dyno") || t.includes("tune")) return "dyno";
  return "other";
}


/** Which parts/fluid fields apply to each service kind, cumulative basic → full */
export const SERVICE_PARTS: Record<ServiceKind, Array<{ key: string; label: string; category: string; unitHint?: string }>> = {
  basic: [
    { key: "engine_oil", label: "Engine oil", category: "oil", unitHint: "L" },
    { key: "oil_filter", label: "Oil filter", category: "oil_filter", unitHint: "unit" },
  ],
  standard: [
    { key: "engine_oil", label: "Engine oil", category: "oil", unitHint: "L" },
    { key: "oil_filter", label: "Oil filter", category: "oil_filter", unitHint: "unit" },
    { key: "spark_plug", label: "Spark plugs", category: "spark_plug", unitHint: "unit" },
    { key: "brake_fluid", label: "Brake fluid", category: "brake_fluid", unitHint: "bottle" },
  ],
  annual: [
    { key: "engine_oil", label: "Engine oil", category: "oil", unitHint: "L" },
    { key: "oil_filter", label: "Oil filter", category: "oil_filter", unitHint: "unit" },
    { key: "air_filter", label: "Air filter", category: "air_filter", unitHint: "unit" },
    { key: "spark_plug", label: "Spark plugs", category: "spark_plug", unitHint: "unit" },
    { key: "brake_fluid", label: "Brake fluid", category: "brake_fluid", unitHint: "bottle" },
    { key: "coolant", label: "Coolant", category: "coolant", unitHint: "L" },
  ],
  full: [
    { key: "engine_oil", label: "Engine oil", category: "oil", unitHint: "L" },
    { key: "oil_filter", label: "Oil filter", category: "oil_filter", unitHint: "unit" },
    { key: "spark_plug", label: "Spark plugs", category: "spark_plug", unitHint: "unit" },
    { key: "air_filter", label: "Air filter", category: "air_filter", unitHint: "unit" },
    { key: "brake_fluid", label: "Brake fluid", category: "brake_fluid", unitHint: "bottle" },
    { key: "coolant", label: "Coolant", category: "coolant", unitHint: "L" },
  ],
  dyno: [],
  collision: [],
  other: [],

};

export const KIND_META: Record<ServiceKind, { label: string; cls: string }> = {
  basic: { label: "Basic Service", cls: "border-status-ready/40 bg-status-ready/10 text-status-ready" },
  standard: { label: "Standard Service", cls: "border-status-progress/40 bg-status-progress/10 text-status-progress" },
  annual: { label: "Annual Service", cls: "border-primary/40 bg-primary/10 text-primary" },
  full: { label: "Full Service", cls: "border-status-parts/40 bg-status-parts/10 text-status-parts" },
  dyno: { label: "Dyno Tune", cls: "border-primary/40 bg-primary/10 text-primary" },
  other: { label: "Service", cls: "border-border bg-muted text-muted-foreground" },
};