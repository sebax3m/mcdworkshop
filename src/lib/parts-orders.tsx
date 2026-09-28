/* eslint-disable @typescript-eslint/no-explicit-any */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Package } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";

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

/** Live sidebar count of parts that still need to be ordered. */
export function useOpenPartsOrdersCount() {
  return useQuery({
    queryKey: ["parts-orders", "pending-count"],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("booking_parts")
        .select("id", { count: "exact", head: true })
        .eq("status", "needs_ordering");
      if (error) throw error;
      return count ?? 0;
    },
  });
}

export type NeedsOrderingRow = {
  id: string;
  booking_id: string;
  description: string | null;
  part_number: string | null;
  qty_required: number;
  supplier: string | null;
  booking: {
    id: string;
    scheduled_date: string | null;
    customer_name: string | null;
    bike: string | null;
  } | null;
};

/** Parts with status "needs_ordering", joined to their booking for the popup. */
export function useNeedsOrderingParts(enabled: boolean) {
  return useQuery({
    queryKey: ["parts-orders", "needs-ordering-list"],
    enabled,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("booking_parts")
        .select(
          "id, booking_id, description, part_number, qty_required, supplier, bookings(id, scheduled_date, rego, customers(first_name, last_name), motorcycles(year, make, model, rego))",
        )
        .eq("status", "needs_ordering")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r: any) => {
        const b = r.bookings;
        const c = b?.customers;
        const m = b?.motorcycles;
        const name = c ? [c.first_name, c.last_name].filter(Boolean).join(" ") : null;
        const bike = m
          ? [m.year, m.make, m.model].filter(Boolean).join(" ")
          : (b?.rego ?? null);
        return {
          id: r.id,
          booking_id: r.booking_id,
          description: r.description,
          part_number: r.part_number,
          qty_required: r.qty_required ?? 1,
          supplier: r.supplier,
          booking: b
            ? { id: b.id, scheduled_date: b.scheduled_date, customer_name: name, bike }
            : null,
        };
      }) as NeedsOrderingRow[];
    },
  });
}

/** Clickable badge: opens a popup listing jobs whose parts still need ordering. */
export function NeedsOrderingBadge({ count, className }: { count: number; className?: string }) {
  const [open, setOpen] = useState(false);
  const nav = useNavigate();
  const listQ = useNeedsOrderingParts(open);
  if (count <= 0) return null;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setOpen(true);
          }}
          className={cn(
            "inline-flex min-w-5 h-5 shrink-0 items-center justify-center rounded-full bg-destructive px-1 text-[0.625rem] font-bold tabular-nums text-destructive-foreground hover:scale-110 transition-transform cursor-pointer",
            className,
          )}
          aria-label={`${count} parts need ordering`}
          title="Parts that need ordering"
        >
          {count}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="right"
        sideOffset={12}
        className="w-[340px] p-0 overflow-hidden rounded-xl border-border bg-popover shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border/60 bg-muted/40">
          <Package className="h-4 w-4 text-orange-400" />
          <div className="font-semibold text-sm">Parts to order</div>
          <span className="rounded-full bg-orange-500/15 border border-orange-500/40 px-1.5 py-0.5 text-[0.625rem] font-bold text-orange-300">
            {count}
          </span>
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
          {listQ.isLoading ? (
            <div className="p-6 text-center text-xs text-muted-foreground">Loading…</div>
          ) : (listQ.data ?? []).length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">Nothing to order</div>
          ) : (
            (listQ.data ?? []).map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  setOpen(false);
                  if (p.booking_id) nav({ to: "/bookings/$bookingId", params: { bookingId: p.booking_id } });
                }}
                className="w-full text-left px-3 py-2.5 border-b border-border/40 last:border-b-0 hover:bg-orange-500/5 transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold truncate">
                    {p.description || p.part_number || "Part"}
                  </span>
                  <span className="text-[0.625rem] font-bold uppercase tracking-wider text-orange-300 shrink-0">
                    ×{p.qty_required}
                  </span>
                </div>
                <div className="text-[0.6875rem] text-muted-foreground truncate mt-0.5">
                  {p.booking?.customer_name ?? "Unknown customer"}
                  {p.booking?.bike ? ` · ${p.booking.bike}` : ""}
                </div>
                <div className="text-[0.625rem] uppercase tracking-wider text-muted-foreground/70 mt-1">
                  {p.booking?.scheduled_date
                    ? new Date(p.booking.scheduled_date + "T00:00:00").toLocaleDateString("en-GB")
                    : "No date"}
                  {p.supplier ? ` · ${p.supplier}` : ""}
                </div>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function useInvalidateParts() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["booking-parts-index"] });
    qc.invalidateQueries({ queryKey: ["booking-parts"] });
    qc.invalidateQueries({ queryKey: ["parts-orders"] });
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
