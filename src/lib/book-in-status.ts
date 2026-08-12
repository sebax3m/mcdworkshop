import {
  CheckCircle2,
  ClipboardCheck,
  Clock,
  CircleDot,
  Flag,
  Gauge,
  Hourglass,
  PackageSearch,
  PlayCircle,
  Search,
  type LucideIcon,
} from "lucide-react";

import { isPostBike } from "@/lib/post-bike";

/**
 * ONE central mapping for the operational status of a book-in.
 * The whole Book-ins calendar (cards, legend, chips) derives colour from here —
 * service type is only ever secondary information.
 */
export type BookInStatusKey =
  | "booked"
  | "arrived"
  | "inspection"
  | "waiting_approval"
  | "waiting_parts"
  | "ready_to_work"
  | "in_progress"
  | "dyno_qc"
  | "ready_for_pickup"
  | "completed";

export type BookInStatusMeta = {
  key: BookInStatusKey;
  label: string;
  /** Short label for very tight layouts (mobile / month chips). */
  short: string;
  icon: LucideIcon;
  /** Solid dot / bar colour. */
  dot: string;
  /** Left accent border colour. */
  accent: string;
  /** Subtle card tint. */
  tint: string;
  /** Badge classes. */
  badge: string;
  /** Icon colour. */
  text: string;
  /** Sort weight — active work first, completed last. */
  priority: number;
};

export const BOOK_IN_STATUS: Record<BookInStatusKey, BookInStatusMeta> = {
  booked: {
    key: "booked",
    label: "Booked",
    short: "BOOKED",
    icon: Clock,
    dot: "bg-muted-foreground",
    accent: "border-l-muted-foreground/60",
    tint: "bg-card",
    badge: "bg-muted text-muted-foreground border-border",
    text: "text-muted-foreground",
    priority: 30,
  },
  arrived: {
    key: "arrived",
    label: "Arrived",
    short: "ARRIVED",
    icon: Flag,
    dot: "bg-blue-500",
    accent: "border-l-blue-500",
    tint: "bg-blue-500/[0.08]",
    badge: "bg-blue-500/15 text-blue-300 border-blue-500/40",
    text: "text-blue-400",
    priority: 20,
  },
  inspection: {
    key: "inspection",
    label: "Inspection",
    short: "INSPECT",
    icon: Search,
    dot: "bg-purple-500",
    accent: "border-l-purple-500",
    tint: "bg-purple-500/[0.08]",
    badge: "bg-purple-500/15 text-purple-300 border-purple-500/40",
    text: "text-purple-400",
    priority: 15,
  },
  waiting_approval: {
    key: "waiting_approval",
    label: "Approval",
    short: "APPROVAL",
    icon: Hourglass,
    dot: "bg-amber-500",
    accent: "border-l-amber-500",
    tint: "bg-amber-500/[0.08]",
    badge: "bg-amber-500/15 text-amber-300 border-amber-500/40",
    text: "text-amber-400",
    priority: 12,
  },
  waiting_parts: {
    key: "waiting_parts",
    label: "Waiting Parts",
    short: "PARTS",
    icon: PackageSearch,
    dot: "bg-teal-400",
    accent: "border-l-teal-400",
    tint: "bg-teal-400/[0.08]",
    badge: "bg-teal-400/15 text-teal-300 border-teal-400/40",
    text: "text-teal-300",
    priority: 14,
  },
  ready_to_work: {
    key: "ready_to_work",
    label: "Ready to Work",
    short: "READY TO WORK",
    icon: ClipboardCheck,
    dot: "bg-emerald-500",
    accent: "border-l-emerald-500",
    tint: "bg-emerald-500/[0.07]",
    badge: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
    text: "text-emerald-400",
    priority: 13,
  },
  in_progress: {
    key: "in_progress",
    label: "In Progress",
    short: "IN PROGRESS",
    icon: PlayCircle,
    dot: "bg-sky-400",
    accent: "border-l-sky-400",
    tint: "bg-sky-400/[0.1]",
    badge: "bg-sky-400/20 text-sky-200 border-sky-400/50",
    text: "text-sky-300",
    priority: 10,
  },
  dyno_qc: {
    key: "dyno_qc",
    label: "Dyno / QC",
    short: "DYNO / QC",
    icon: Gauge,
    dot: "bg-fuchsia-500",
    accent: "border-l-fuchsia-500",
    tint: "bg-fuchsia-500/[0.08]",
    badge: "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/40",
    text: "text-fuchsia-400",
    priority: 11,
  },
  ready_for_pickup: {
    key: "ready_for_pickup",
    label: "Ready",
    short: "READY",
    icon: CheckCircle2,
    dot: "bg-green-500",
    accent: "border-l-green-500",
    tint: "bg-green-500/[0.09]",
    badge: "bg-green-500/15 text-green-300 border-green-500/40",
    text: "text-green-400",
    priority: 16,
  },
  completed: {
    key: "completed",
    label: "Completed",
    short: "DONE",
    icon: CheckCircle2,
    dot: "bg-muted-foreground/60",
    accent: "border-l-border",
    tint: "bg-muted/20",
    badge: "bg-muted/40 text-muted-foreground border-border",
    text: "text-green-500",
    priority: 90,
  },
};

/** Legend order for the Book-in status legend. */
export const BOOK_IN_STATUS_LEGEND: BookInStatusKey[] = [
  "booked",
  "arrived",
  "inspection",
  "waiting_approval",
  "waiting_parts",
  "ready_to_work",
  "in_progress",
  "dyno_qc",
  "ready_for_pickup",
  "completed",
];

const JOB_STATUS_MAP: Record<string, BookInStatusKey> = {
  waiting_approval: "waiting_approval",
  awaiting_approval: "waiting_approval",
  waiting_parts: "waiting_parts",
  awaiting_parts: "waiting_parts",
  ready_to_work: "ready_to_work",
  ready: "ready_to_work",
  in_progress: "in_progress",
  inprogress: "in_progress",
  qc: "dyno_qc",
  dyno: "dyno_qc",
  dyno_qc: "dyno_qc",
  ready_for_pickup: "ready_for_pickup",
  completed: "completed",
  inspection: "inspection",
  waiting_inspection: "inspection",
};

export type BookInLike = {
  status?: string | null;
  job_status?: string | null;
  job_completed?: boolean | null;
  jobs?: { status?: string | null } | null;
  job_id?: string | null;
  bike_arrived?: boolean | null;
  scheduled_date?: string | null;
  service_type?: string | null;
};

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function isBookInCompleted(b: BookInLike | null | undefined): boolean {
  if (!b) return false;
  return (
    b.job_completed === true ||
    b.job_status === "completed" ||
    b.jobs?.status === "completed" ||
    b.status === "completed"
  );
}

/**
 * Resolve the operational status of a booking row.
 * Unknown / legacy values fall back to the neutral "booked" state — never crash.
 */
export function resolveBookInStatus(b: BookInLike | null | undefined): BookInStatusMeta {
  if (!b) return BOOK_IN_STATUS.booked;
  if (isBookInCompleted(b)) return BOOK_IN_STATUS.completed;

  const job = (b.job_status ?? b.jobs?.status ?? "").toString().toLowerCase();
  const mapped = JOB_STATUS_MAP[job];
  if (mapped) return BOOK_IN_STATUS[mapped];

  const booking = (b.status ?? "").toString().toLowerCase();
  const mappedBooking = JOB_STATUS_MAP[booking];
  if (mappedBooking) return BOOK_IN_STATUS[mappedBooking];

  if (b.job_id) return BOOK_IN_STATUS.in_progress;
  if (b.bike_arrived) return BOOK_IN_STATUS.arrived;
  // Post bikes are tracked per branch and never auto-advance to inspection.
  if (isPostBike(b.service_type)) return BOOK_IN_STATUS.booked;
  if (b.scheduled_date && b.scheduled_date <= todayKey()) return BOOK_IN_STATUS.inspection;
  return BOOK_IN_STATUS.booked;
}

/** Small helper so a status dot can be rendered without importing the whole map. */
export function statusDot(b: BookInLike): string {
  return resolveBookInStatus(b).dot;
}

export { CircleDot };
