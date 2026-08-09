/** Shared service-type colour legend used by the calendar, day view and cards. */
export type ServiceColor = {
  bg: string;
  /** Solid-ish tinted fill for the whole card. */
  fill: string;
  ring: string;
  label: string;
  text: string;
  border: string;
  hex: string;
};

export const SERVICE_COLORS: Record<string, ServiceColor> = {
  basic: {
    bg: "bg-status-new/70",
    fill: "bg-status-new/25",
    ring: "ring-status-new",
    label: "text-status-new",
    text: "text-white",
    border: "border-status-new",
    hex: "#22c55e",
  },
  standard: {
    bg: "bg-primary/70",
    fill: "bg-primary/25",
    ring: "ring-primary",
    label: "text-primary",
    text: "text-white",
    border: "border-primary",
    hex: "#3b82f6",
  },
  full: {
    bg: "bg-status-assigned/70",
    fill: "bg-status-assigned/25",
    ring: "ring-status-assigned",
    label: "text-status-assigned",
    text: "text-white",
    border: "border-status-assigned",
    hex: "#f59e0b",
  },
  dyno: {
    bg: "bg-status-dyno/70",
    fill: "bg-status-dyno/25",
    ring: "ring-status-dyno",
    label: "text-status-dyno",
    text: "text-black",
    border: "border-status-dyno",
    hex: "#a855f7",
  },
  diagnostic: {
    bg: "bg-status-progress/70",
    fill: "bg-status-progress/25",
    ring: "ring-status-progress",
    label: "text-status-progress",
    text: "text-black",
    border: "border-status-progress",
    hex: "#14b8a6",
  },
  insurance: {
    bg: "bg-status-insurance/70",
    fill: "bg-status-insurance/25",
    ring: "ring-status-insurance",
    label: "text-status-insurance",
    text: "text-white",
    border: "border-status-insurance",
    hex: "#ef4444",
  },
  postbike: {
    bg: "bg-cyan-400/70",
    fill: "bg-cyan-400/25",
    ring: "ring-cyan-400",
    label: "text-cyan-400",
    text: "text-black",
    border: "border-cyan-400",
    hex: "#06b6d4",
  },
  other: {
    bg: "bg-muted-foreground/70",
    fill: "bg-muted-foreground/25",
    ring: "ring-muted-foreground",
    label: "text-muted-foreground",
    text: "text-white",
    border: "border-muted-foreground",
    hex: "#64748b",
  },
  default: {
    bg: "bg-muted",
    fill: "bg-muted/60",
    ring: "ring-border",
    label: "text-foreground",
    text: "text-white",
    border: "border-border",
    hex: "#3b82f6",
  },
};

export function serviceColor(t: string | null | undefined): ServiceColor {
  if (!t) return SERVICE_COLORS.default;
  const k = t.toLowerCase();
  if (k.includes("post") && k.includes("bike")) return SERVICE_COLORS.postbike;
  if (k.includes("collision") || k.includes("insurance") || k.includes("crash"))
    return SERVICE_COLORS.insurance;
  if (k.includes("tuning") || k.includes("dyno")) return SERVICE_COLORS.dyno;
  if (k.includes("full")) return SERVICE_COLORS.full;
  if (k.includes("standard")) return SERVICE_COLORS.standard;
  if (k.includes("basic")) return SERVICE_COLORS.basic;
  if (k.includes("diag")) return SERVICE_COLORS.diagnostic;
  if (k === "other") return SERVICE_COLORS.other;
  return SERVICE_COLORS.default;
}

/** Legend entries, in display order. */
export const SERVICE_LEGEND: { key: string; label: string }[] = [
  { key: "basic", label: "Basic Service" },
  { key: "standard", label: "Standard Service" },
  { key: "full", label: "Full Service" },
  { key: "dyno", label: "Tuning" },
  { key: "diagnostic", label: "Diagnostic" },
  { key: "insurance", label: "Insurance / Crash" },
  { key: "postbike", label: "Post Bike" },
  { key: "other", label: "Other" },
];
