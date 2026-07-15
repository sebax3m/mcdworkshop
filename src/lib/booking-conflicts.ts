import { supabase } from "@/integrations/supabase/client";

export type BookingConflict = {
  id: string;
  scheduled_date: string;
  drop_off_time: string;
  scheduled_end_time: string;
  service_type: string;
  status: string;
  assigned_tech_id: string | null;
};

export type ConflictCheckInput = {
  date: string; // yyyy-mm-dd
  startTime: string; // HH:mm or HH:mm:ss
  endTime: string; // HH:mm or HH:mm:ss
  technicianId?: string | null;
  excludeBookingId?: string | null;
};

function normaliseTime(t: string): string {
  // ensure HH:mm:ss
  if (!t) return t;
  const parts = t.split(":");
  const hh = (parts[0] ?? "00").padStart(2, "0");
  const mm = (parts[1] ?? "00").padStart(2, "0");
  const ss = (parts[2] ?? "00").padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

/**
 * Server-side global-capacity conflict check via RPC.
 * Returns the list of conflicting bookings (empty = free slot).
 * The RPC ignores cancelled/deleted/no_show and excludes p_exclude_booking_id.
 * Daily notes are never included (separate table).
 */
export async function findBookingConflicts(input: ConflictCheckInput): Promise<BookingConflict[]> {
  const { data, error } = await supabase.rpc(
    "find_booking_conflicts" as never,
    {
      p_date: input.date,
      p_start: normaliseTime(input.startTime),
      p_end: normaliseTime(input.endTime),
      p_technician_id: input.technicianId ?? null,
      p_exclude_booking_id: input.excludeBookingId ?? null,
    } as never,
  );
  if (error) throw error;
  return (data ?? []) as unknown as BookingConflict[];
}

/** Validate times client-side. Returns an error string or null. */
export function validateTimeRange(start: string, end: string): string | null {
  if (!start) return "Start time is required";
  if (!end) return "End time is required";
  const [sh, sm] = start.split(":").map((n) => Number(n) || 0);
  const [eh, em] = end.split(":").map((n) => Number(n) || 0);
  const sMin = sh * 60 + sm;
  const eMin = eh * 60 + em;
  if (eMin <= sMin) return "End time must be after start time";
  // No overnight bookings
  if (eMin > 24 * 60) return "Booking cannot cross midnight";
  return null;
}

export function formatConflictMessage(conflicts: BookingConflict[]): string {
  if (conflicts.length === 0) return "";
  const c = conflicts[0];
  const s = String(c.drop_off_time).slice(0, 5);
  const e = String(c.scheduled_end_time).slice(0, 5);
  const extra = conflicts.length > 1 ? ` (+${conflicts.length - 1} more)` : "";
  return `Slot conflicts with ${c.service_type || "another booking"} ${s}–${e}${extra}`;
}

/** Add minutes to an HH:mm time string, clamped to same day. */
export function addMinutesToTime(time: string, minutes: number): string {
  const [h, m] = time.split(":").map((n) => Number(n) || 0);
  const total = Math.min(24 * 60 - 1, h * 60 + m + minutes);
  const hh = Math.floor(total / 60)
    .toString()
    .padStart(2, "0");
  const mm = (total % 60).toString().padStart(2, "0");
  return `${hh}:${mm}`;
}
