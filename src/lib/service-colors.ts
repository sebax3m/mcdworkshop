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
    bg: "bg-service-light-blue/90",
    fill: "bg-service-light-blue/50",
    ring: "ring-service-light-blue",
    label: "text-service-light-blue",
    text: "text-white",
    border: "border-service-light-blue",
    hex: "#60a5fa",
  },
  standard: {
    bg: "bg-service-light-blue/90",
    fill: "bg-service-light-blue/50",
    ring: "ring-service-light-blue",
    label: "text-service-light-blue",
    text: "text-white",
    border: "border-service-light-blue",
    hex: "#60a5fa",
  },
  full: {
    bg: "bg-service-light-blue/90",
    fill: "bg-service-light-blue/50",
    ring: "ring-service-light-blue",
    label: "text-service-light-blue",
    text: "text-white",
    border: "border-service-light-blue",
    hex: "#60a5fa",
  },
  dyno: {
    bg: "bg-service-gold/90",
    fill: "bg-service-gold/50",
    ring: "ring-service-gold",
    label: "text-service-gold",
    text: "text-black",
    border: "border-service-gold",
    hex: "#fbbf24",
  },
  diagnostic: {
    bg: "bg-service-orange/90",
    fill: "bg-service-orange/50",
    ring: "ring-service-orange",
    label: "text-service-orange",
    text: "text-black",
    border: "border-service-orange",
    hex: "#fb923c",
  },
  insurance: {
    bg: "bg-service-purple/90",
    fill: "bg-service-purple/50",
    ring: "ring-service-purple",
    label: "text-service-purple",
    text: "text-white",
    border: "border-service-purple",
    hex: "#a855f7",
  },
  postbike: {
    bg: "bg-service-red/90",
    fill: "bg-service-red/50",
    ring: "ring-service-red",
    label: "text-service-red",
    text: "text-white",
    border: "border-service-red",
    hex: "#ef4444",
  },
  other: {
    bg: "bg-service-grey/90",
    fill: "bg-service-grey/50",
    ring: "ring-service-grey",
    label: "text-service-grey",
    text: "text-white",
    border: "border-service-grey",
    hex: "#9ca3af",
  },
  default: {
    bg: "bg-service-light-blue/90",
    fill: "bg-service-light-blue/50",
    ring: "ring-service-light-blue",
    label: "text-service-light-blue",
    text: "text-white",
    border: "border-service-light-blue",
    hex: "#60a5fa",
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

/** Whether the service type should show an extra highlight rectangle/frame. */
export function isHighlightedService(t: string | null | undefined): boolean {
  if (!t) return false;
  const k = t.toLowerCase();
  return (
    k.includes("full") ||
    k.includes("tuning") ||
    k.includes("dyno") ||
    k.includes("diag") ||
    k.includes("insurance") ||
    k.includes("collision") ||
    k.includes("crash") ||
    (k.includes("post") && k.includes("bike"))
  );
}

/** Short uppercase label for the service badge shown on book-in cards. */
export function serviceBadgeLabel(t: string | null | undefined): string {
  if (!t) return "";
  const k = t.toLowerCase();
  if (k.includes("post") && k.includes("bike")) return "POST BIKE";
  if (k.includes("collision") || k.includes("insurance") || k.includes("crash")) return "INSURANCE";
  if (k.includes("tuning") || k.includes("dyno")) return "TUNING";
  if (k.includes("full")) return "FULL SERVICE";
  if (k.includes("diag")) return "DIAGNOSTIC";
  return t.toUpperCase();
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
