/* eslint-disable @typescript-eslint/no-explicit-any */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const SUPPLIERS = ["Darbi", "R2", "F & Davies", "Nationwide", "Eurobike", "Whites", "Others"];

export type PartStatus =
  | "needs_ordering"
  | "ordered"
  | "partially_received"
  | "arrived"
  | "backordered"
  | "cancelled";

export const PART_STATUSES: { key: PartStatus; label: string; cls: string }[] = [
  { key: "needs_ordering", label: "Needs ordering", cls: "border-orange-500/60 bg-orange-500/15 text-orange-300" },
  { key: "ordered", label: "Ordered", cls: "border-sky-500/60 bg-sky-500/15 text-sky-300" },
  { key: "partially_received", label: "Partially received", cls: "border-yellow-500/60 bg-yellow-500/15 text-yellow-300" },
  { key: "arrived", label: "Arrived", cls: "border-emerald-500/60 bg-emerald-500/15 text-emerald-300" },
  { key: "backordered", label: "Backordered", cls: "border-red-500/60 bg-red-500/15 text-red-300" },
  { key: "cancelled", label: "Cancelled", cls: "border-border bg-muted text-muted-foreground" },
];
export const statusMeta = (s: string) => PART_STATUSES.find((x) => x.key === s) ?? PART_STATUSES[0];

export type OverallParts = "required" | "ordered" | "partial" | "arrived" | "issue";
export const OVERALL_META: Record<OverallParts, { label: string; cls: string; dot: string }> = {
  required: { label: "Parts required", cls: "border-orange-500/60 bg-orange-500/15 text-orange-300", dot: "bg-orange-400" },
  ordered: { label: "Parts ordered", cls: "border-sky-500/60 bg-sky-500/15 text-sky-300", dot: "bg-sky-400" },
  partial: { label: "Parts partially received", cls: "border-yellow-500/60 bg-yellow-500/15 text-yellow-300", dot: "bg-yellow-400" },
  arrived: { label: "Parts arrived", cls: "border-emerald-500/60 bg-emerald-500/15 text-emerald-300", dot: "bg-emerald-400" },
  issue: { label: "Parts issue / backorder", cls: "border-red-500/60 bg-red-500/15 text-red-300", dot: "bg-red-400" },
};

/** Overall parts status for a book-in from its individual parts. */
export function overallStatus(parts: { status: string }[], flagged = false): OverallParts | null {
  const act = parts.filter((p) => p.status !== "cancelled");
  if (!act.length) return flagged ? "required" : null;
  if (act.some((p) => p.status === "backordered")) return "issue";
  if (act.every((p) => p.status === "arrived")) return "arrived";
  if (act.some((p) => p.status === "arrived" || p.status === "partially_received")) return "partial";
  if (act.every((p) => p.status === "ordered")) return "ordered";
  return "required";
}

export function OverallBadge({ status, className }: { status: OverallParts; className?: string }) {
  const m = OVERALL_META[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[0.625rem] font-bold uppercase tracking-wider", m.cls, className)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", m.dot)} />
      {m.label}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const m = statusMeta(status);
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[0.625rem] font-bold uppercase tracking-wider whitespace-nowrap", m.cls)}>
      {m.label}
    </span>
  );
}

/** Auto-suggested parts from the service type / notes. */
export function suggestedParts(b: any): string[] {
  const svc = `${b.service_type ?? ""} ${b.service_type_other ?? ""}`.toLowerCase();
  const txt = `${svc} ${b.complaints ?? ""} ${b.notes ?? ""} ${b.instructions ?? ""}`.toLowerCase();
  const out = new Set<string>();
  if (svc.includes("full")) ["Oil filter", "Air filter", "Spark plugs"].forEach((p) => out.add(p));
  if (/rotor|brake\s*disc/.test(txt)) out.add("Brake rotors");
  if (/brake\s*pads?|\bpads\b/.test(txt)) out.add("Brake pads");
  if (/tyre|tire/.test(txt)) out.add("Tyres");
  return [...out];
}

/** Index of every book-in's parts (one shared query for calendar cards). */
export function useBookingPartsIndex() {
  return useQuery({
    queryKey: ["booking-parts-index"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("booking_parts")
        .select("booking_id, status")
        .neq("status", "cancelled");
      if (error) throw error;
      const map = new Map<string, { status: string }[]>();
      for (const r of data ?? []) {
        const l = map.get(r.booking_id) ?? [];
        l.push(r);
        map.set(r.booking_id, l);
      }
      return map;
    },
  });
}

export function useInvalidateParts() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["booking-parts-index"] });
    qc.invalidateQueries({ queryKey: ["booking-parts"] });
    qc.invalidateQueries({ queryKey: ["parts-orders"] });
    qc.invalidateQueries({ queryKey: ["parts-order-reminders"] });
  };
}

/** Patch applied when moving a part to a status (stamps dates / qty). */
export function statusPatch(p: any, status: PartStatus) {
  const today = new Date().toISOString().slice(0, 10);
  const patch: any = { status };
  if (status === "ordered" && !p.ordered_at) patch.ordered_at = today;
  if (status === "arrived") {
    patch.qty_received = p.qty_required;
    patch.received_at = today;
    if (!p.ordered_at) patch.ordered_at = today;
  }
  return patch;
}
