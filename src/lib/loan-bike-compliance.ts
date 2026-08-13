/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from "@/integrations/supabase/client";

export const EXPIRY_WARNING_DAYS = 30;

export type ExpiryKind = "wof" | "rego";

export type ExpiryStatus = {
  date: string;
  days: number;
  level: "expired" | "due" | "ok";
  label: string;
};

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function daysUntil(dateStr: string): number {
  const a = new Date(todayISO() + "T00:00:00").getTime();
  const b = new Date(dateStr + "T00:00:00").getTime();
  return Math.round((b - a) / 86400000);
}

/** Null when no date set. */
export function expiryStatus(dateStr: string | null | undefined): ExpiryStatus | null {
  if (!dateStr) return null;
  const days = daysUntil(dateStr);
  const level: ExpiryStatus["level"] =
    days < 0 ? "expired" : days <= EXPIRY_WARNING_DAYS ? "due" : "ok";
  const label =
    days < 0
      ? `Expired ${Math.abs(days)}d ago`
      : days === 0
        ? "Expires today"
        : `${days}d left`;
  return { date: dateStr, days, level, label };
}

export function expiryClasses(level: ExpiryStatus["level"]) {
  if (level === "expired") return "bg-destructive/15 text-destructive";
  if (level === "due") return "bg-amber-400/15 text-amber-400";
  return "bg-emerald-500/10 text-emerald-500";
}

const KIND_LABEL: Record<ExpiryKind, string> = { wof: "WOF", rego: "Rego" };

/**
 * Creates a notification + a calendar note for every loan bike whose WOF or
 * rego expiry is within the warning window (or already expired).
 * Deduplicated by title, so it is safe to run on every page load.
 */
export async function syncLoanBikeExpiryAlerts(): Promise<number> {
  const { data: bikes } = await supabase
    .from("loan_bikes")
    .select("id, name, rego, active, wof_expiry, rego_expiry")
    .eq("active", true);
  if (!bikes?.length) return 0;

  type Pending = { title: string; body: string; link: string; noteDate: string };
  const pending: Pending[] = [];

  for (const b of bikes as any[]) {
    for (const kind of ["wof", "rego"] as ExpiryKind[]) {
      const date = kind === "wof" ? b.wof_expiry : b.rego_expiry;
      const st = expiryStatus(date);
      if (!st || st.level === "ok") continue;
      pending.push({
        title: `${KIND_LABEL[kind]} ${st.level === "expired" ? "expired" : "due"} — ${b.name}`,
        body: `${KIND_LABEL[kind]} for loan bike ${b.name}${b.rego ? ` (${b.rego})` : ""} ${
          st.level === "expired" ? "expired on" : "expires on"
        } ${st.date} · ${st.label}`,
        link: `/loan-bikes/${b.id}`,
        noteDate: st.date,
      });
    }
  }
  if (!pending.length) return 0;

  const titles = pending.map((p) => p.title);

  const [{ data: existingNotifs }, { data: existingNotes }] = await Promise.all([
    supabase
      .from("notifications")
      .select("title")
      .eq("kind", "loan_bike_expiry")
      .in("title", titles),
    supabase.from("daily_notes").select("title, note_date").in("title", titles),
  ]);

  const haveNotif = new Set((existingNotifs ?? []).map((n: any) => n.title));
  const haveNote = new Set((existingNotes ?? []).map((n: any) => `${n.note_date}|${n.title}`));

  const newNotifs = pending
    .filter((p) => !haveNotif.has(p.title))
    .map((p) => ({
      kind: "loan_bike_expiry",
      title: p.title,
      body: p.body,
      link: p.link,
      target_role: null,
      requires_action: false,
    }));

  const newNotes = pending
    .filter((p) => !haveNote.has(`${p.noteDate}|${p.title}`))
    .map((p) => ({ note_date: p.noteDate, title: p.title, body: p.body }));

  await Promise.all([
    newNotifs.length ? supabase.from("notifications").insert(newNotifs) : Promise.resolve(),
    newNotes.length ? supabase.from("daily_notes").insert(newNotes) : Promise.resolve(),
  ]);

  return newNotifs.length + newNotes.length;
}
