/* Shared semantic status system for the workshop workflow. */

export type BookInStage = "booked" | "waiting_inspection" | "arrived" | "in_workshop";

export type StageMeta = {
  key: string;
  label: string;
  /** Tailwind classes built from semantic tokens / restrained status colours */
  dot: string;
  chip: string;
  ring: string;
};

export const STAGE_META: Record<string, StageMeta> = {
  booked: {
    key: "booked",
    label: "Booked in",
    dot: "bg-muted-foreground",
    chip: "bg-muted text-muted-foreground border-border",
    ring: "ring-border",
  },
  arrived: {
    key: "arrived",
    label: "Arrived",
    dot: "bg-blue-500",
    chip: "bg-blue-500/15 text-blue-400 border-blue-500/40",
    ring: "ring-blue-500/50",
  },
  waiting_inspection: {
    key: "waiting_inspection",
    label: "Awaiting inspection",
    dot: "bg-amber-400",
    chip: "bg-amber-400/15 text-amber-300 border-amber-400/40",
    ring: "ring-amber-400/50",
  },
  in_workshop: {
    key: "in_workshop",
    label: "In workshop",
    dot: "bg-primary",
    chip: "bg-primary/15 text-primary border-primary/40",
    ring: "ring-primary/50",
  },

  waiting_approval: {
    key: "waiting_approval",
    label: "Waiting approval",
    dot: "bg-amber-500",
    chip: "bg-amber-500/15 text-amber-400 border-amber-500/40",
    ring: "ring-amber-500/50",
  },
  waiting_parts: {
    key: "waiting_parts",
    label: "Waiting parts",
    dot: "bg-amber-600",
    chip: "bg-amber-600/15 text-amber-400 border-amber-600/40",
    ring: "ring-amber-600/50",
  },
  ready_to_work: {
    key: "ready_to_work",
    label: "Ready to work",
    dot: "bg-primary",
    chip: "bg-primary/15 text-primary border-primary/40",
    ring: "ring-primary/50",
  },
  in_progress: {
    key: "in_progress",
    label: "In progress",
    dot: "bg-orange-500",
    chip: "bg-orange-500/15 text-orange-400 border-orange-500/40",
    ring: "ring-orange-500/50",
  },
  qc: {
    key: "qc",
    label: "Dyno / QC",
    dot: "bg-purple-500",
    chip: "bg-purple-500/15 text-purple-400 border-purple-500/40",
    ring: "ring-purple-500/50",
  },
  ready_for_pickup: {
    key: "ready_for_pickup",
    label: "Ready for pickup",
    dot: "bg-green-500",
    chip: "bg-green-500/15 text-green-400 border-green-500/40",
    ring: "ring-green-500/50",
  },
  blocked: {
    key: "blocked",
    label: "Blocked",
    dot: "bg-destructive",
    chip: "bg-destructive/15 text-destructive border-destructive/40",
    ring: "ring-destructive/50",
  },
};

export function stageMeta(key: string | null | undefined): StageMeta {
  return STAGE_META[key ?? "booked"] ?? STAGE_META.booked;
}

/**
 * Derive the stage of a booking row.
 * - A booking whose day has arrived automatically falls into "waiting_inspection".
 * - Checking the bike in moves it to "arrived".
 * - Once a job card exists it leaves the book-in board ("in_workshop").
 */
export function bookInStage(b: {
  bike_arrived?: boolean | null;
  job_id?: string | null;
  scheduled_date?: string | null;
}): BookInStage {
  if (b?.job_id) return "in_workshop";
  if (b?.bike_arrived) return "arrived";
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  if (b?.scheduled_date && b.scheduled_date <= todayStr) return "waiting_inspection";
  return "booked";
}

/** Capacity state for a given day. */
export function capacityState(booked: number, capacity: number) {
  if (capacity <= 0) return booked > 0 ? ("over" as const) : ("closed" as const);
  if (booked > capacity) return "over" as const;
  if (booked === capacity) return "full" as const;
  if (booked >= capacity - 1) return "nearly" as const;
  return "ok" as const;
}
