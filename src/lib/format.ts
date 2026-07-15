export const STATUS_META: Record<string, { label: string; cls: string; dot: string }> = {
  new: {
    label: "New",
    cls: "bg-status-new/15 text-status-new border-status-new/30",
    dot: "bg-status-new",
  },
  assigned: {
    label: "Assigned",
    cls: "bg-status-assigned/15 text-status-assigned border-status-assigned/30",
    dot: "bg-status-assigned",
  },
  in_progress: {
    label: "In Progress",
    cls: "bg-status-progress/15 text-status-progress border-status-progress/30",
    dot: "bg-status-progress",
  },
  waiting_parts: {
    label: "Waiting Parts",
    cls: "bg-status-parts/15 text-status-parts border-status-parts/30",
    dot: "bg-status-parts",
  },
  ready_for_pickup: {
    label: "Ready For Pickup",
    cls: "bg-status-ready/15 text-status-ready border-status-ready/30",
    dot: "bg-status-ready",
  },
  completed: {
    label: "Completed",
    cls: "bg-status-done/15 text-status-done border-status-done/30",
    dot: "bg-status-done",
  },
};

export const STATUS_ORDER = [
  "new",
  "assigned",
  "in_progress",
  "waiting_parts",
  "ready_for_pickup",
  "completed",
] as const;

export function formatMinutes(min: number) {
  if (!min || min < 1) return "0m";
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (!h) return `${m}m`;
  if (!m) return `${h}h`;
  return `${h}h ${m}m`;
}

export function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

export function fullBike(b: { year?: number | null; make: string; model: string }) {
  return [b.year, b.make, b.model].filter(Boolean).join(" ");
}
