/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import { CheckCircle2, RotateCcw, User as UserIcon } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { displayBike, displayCustomerName, displayServiceType } from "@/lib/display";
import { resolveBookInStatus, isBookInCompleted } from "@/lib/book-in-status";
import { serviceColor } from "@/lib/service-colors";
import { cn } from "@/lib/utils";
import { useTechnicianNames } from "@/hooks/use-technician-names";
import { StatusBadge } from "@/components/booking/StatusBadge";
import { TechnicianIndicator } from "@/components/booking/TechnicianIndicator";
import { TransportIndicator, transportKind } from "@/components/booking/TransportIndicator";

type Props = {
  booking: any;
  onClick?: () => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: () => void;
  className?: string;
  dense?: boolean;
};

/**
 * Book-in card. Colour communicates OPERATIONAL STATUS (left accent + subtle
 * tint + badge); service type is secondary (small dot + label).
 */
export function BookInCard({
  booking: b,
  onClick,
  draggable,
  onDragStart,
  onDragEnd,
  className,
  dense,
}: Props) {
  const status = resolveBookInStatus(b);
  const jobCompleted = isBookInCompleted(b);
  const bike = displayBike(b.motorcycles);
  const rego = b.motorcycles?.rego || b.rego || "";
  const customer = displayCustomerName(b.customers);
  const work = displayServiceType(b.service_type, b.service_type_other);
  const svc = serviceColor(b.service_type);

  const techNames = useTechnicianNames();
  const techName = b.assigned_tech_id
    ? (b.tech_name ?? techNames.get(b.assigned_tech_id) ?? "Assigned")
    : null;

  const kind = transportKind(b);

  const qc = useQueryClient();
  const [completing, setCompleting] = useState(false);
  const [reversing, setReversing] = useState(false);

  function invalidate() {
    for (const key of [
      ["booking", b.id],
      ["calendar-bookings"],
      ["my-bookings"],
      ["my-jobs"],
      ["day-bookings"],
      ["today-bookings"],
      ["loan-bikes"],
      ["loan-bikes-active-assignments"],
    ]) {
      qc.invalidateQueries({ queryKey: key as any });
    }
  }

  async function markCompleted(e: React.MouseEvent) {
    e.stopPropagation();
    if (completing) return;
    if (!confirm(`Mark this book-in as completed?\n\n${bike}${rego ? ` (${rego})` : ""}`)) return;
    setCompleting(true);
    try {
      const now = new Date().toISOString();
      const updates: { status: string; loan_bike_returned_at?: string } = {
        status: "completed",
      };
      if (b.job_id) {
        const { error: jobError } = await supabase
          .from("jobs")
          .update({ status: "completed", completed_at: now })
          .eq("id", b.job_id);
        if (jobError) throw jobError;
      }
      if (b.loan_bike_id && !b.loan_bike_returned_at) {
        updates.loan_bike_returned_at = now;
      }
      const { error } = await supabase.from("bookings").update(updates).eq("id", b.id);
      if (error) throw error;
      invalidate();
      toast.success("Booking marked as completed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to complete booking");
    } finally {
      setCompleting(false);
    }
  }

  async function reverseComplete(e: React.MouseEvent) {
    e.stopPropagation();
    if (reversing) return;
    if (!confirm("Reverse completion? This will set the booking and job back to In progress."))
      return;
    setReversing(true);
    try {
      const updates: { status: string; loan_bike_returned_at?: null } = {
        status: "in_progress",
      };
      if (b.job_id) {
        const { error: jobError } = await supabase
          .from("jobs")
          .update({ status: "in_progress", completed_at: null })
          .eq("id", b.job_id);
        if (jobError) throw jobError;
      }
      if (b.loan_bike_id && b.loan_bike_returned_at) {
        updates.loan_bike_returned_at = null;
      }
      const { error } = await supabase.from("bookings").update(updates).eq("id", b.id);
      if (error) throw error;
      invalidate();
      toast.success("Completion reversed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reverse completion");
    } finally {
      setReversing(false);
    }
  }

  const tooltip = [
    bike,
    rego,
    customer,
    work,
    status.label,
    techName ? `Tech: ${techName}` : "",
    b.bike_arrived_at ? `Arrived ${String(b.bike_arrived_at).slice(11, 16)}` : "",
    b.customers?.phone ?? "",
    b.transport_address ?? "",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      role="button"
      tabIndex={0}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.();
        }
      }}
      title={tooltip}
      className={cn(
        "group relative w-full overflow-hidden rounded-lg border border-border/70 border-l-4 text-left shadow-sm transition-all",
        status.accent,
        jobCompleted ? "bg-muted/20 opacity-80 saturate-50" : status.tint,
        "hover:shadow-md hover:border-border focus:outline-none focus:ring-2 focus:ring-primary/40",
        dense ? "p-1.5" : "p-2.5",
        draggable && "cursor-grab active:cursor-grabbing",
        className,
      )}
    >
      {/* Quick workflow action (hover) */}
      {jobCompleted ? (
        <button
          type="button"
          onClick={reverseComplete}
          disabled={reversing}
          title="Reverse completion"
          className="absolute bottom-1 right-1 z-10 grid h-5 w-5 place-items-center rounded-full border border-amber-500/60 bg-background/90 text-amber-400 opacity-0 transition-opacity hover:bg-amber-500/20 group-hover:opacity-100 focus:opacity-100"
        >
          <RotateCcw className="h-3 w-3" />
        </button>
      ) : (
        <button
          type="button"
          onClick={markCompleted}
          disabled={completing}
          title="Mark as completed"
          className="absolute bottom-1 right-1 z-10 grid h-5 w-5 place-items-center rounded-full border border-green-500/60 bg-background/90 text-green-400 opacity-0 transition-opacity hover:bg-green-500/20 group-hover:opacity-100 focus:opacity-100"
        >
          <CheckCircle2 className="h-3 w-3" />
        </button>
      )}

      {/* Tiny indicators */}
      <div className="absolute right-1 top-1 z-10 flex items-center gap-1">
        {b.bike_arrived && !jobCompleted && (
          <span className="h-1.5 w-1.5 rounded-full bg-orange-500" title="Arrived today" />
        )}
        {b.loan_bike && (
          <span className="h-1.5 w-1.5 rounded-full bg-fuchsia-500" title="Loan bike" />
        )}
        {b.notes && <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" title="Has notes" />}
      </div>

      <div className="min-w-0 pr-6">
        {/* ROW 1 — motorcycle + rego + transport */}
        <div className="flex items-start justify-between gap-1.5">
          <div className="min-w-0 truncate text-[0.7rem] font-bold leading-tight sm:text-[0.8rem]">
            {bike}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {rego && (
              <span className="rounded bg-background/70 px-1 py-0 text-[0.5625rem] font-bold uppercase tracking-wider tabular-nums text-foreground/80">
                {rego}
              </span>
            )}
            <TransportIndicator kind={kind} address={b.transport_address} />
          </div>
        </div>

        {/* ROW 2 — customer */}
        <div className="mt-0.5 flex items-center gap-1 truncate text-[0.625rem] text-muted-foreground sm:text-[0.6875rem]">
          <UserIcon className="h-2.5 w-2.5 shrink-0" />
          <span className="truncate">{customer}</span>
        </div>

        {/* ROW 3 — requested work (service type = secondary) */}
        <div className="flex items-center gap-1 truncate text-[0.625rem] sm:text-[0.6875rem]">
          <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", svc.bg)} />
          <span className="truncate text-foreground/80">{work}</span>
        </div>

        {/* ROW 4 — operational status + technician */}
        <div className="mt-1 flex items-center gap-1.5">
          <StatusBadge meta={status} compact={dense} />
          <TechnicianIndicator name={techName} className="ml-auto" showName={!dense} />
        </div>
      </div>
    </div>
  );
}

/** Small "6 / 8" capacity indicator with a segmented bar. */
export function CapacityBadge({
  booked,
  capacity,
  compact,
}: {
  booked: number;
  capacity: number;
  compact?: boolean;
}) {
  const full = capacity > 0 && booked >= capacity;
  const over = capacity > 0 && booked > capacity;
  const nearly = capacity > 0 && !full && booked >= capacity - 1;
  const tone = over
    ? "text-destructive"
    : full
      ? "text-amber-400"
      : nearly
        ? "text-amber-300"
        : "text-muted-foreground";
  return (
    <span className={cn("inline-flex items-center gap-1.5", tone)}>
      <span className="text-[0.65rem] sm:text-[0.6875rem] font-bold tabular-nums">
        {booked} / {capacity}
      </span>
      {!compact && (
        <span className="hidden sm:inline-flex gap-[2px]">
          {Array.from({ length: Math.min(Math.max(capacity, 1), 10) }, (_, i) => (
            <span
              key={i}
              className={cn(
                "h-1.5 w-1.5 rounded-[2px]",
                i < booked ? (over || full ? "bg-amber-500" : "bg-primary") : "bg-muted",
              )}
            />
          ))}
        </span>
      )}
      {full && (
        <span className="rounded bg-amber-500/15 border border-amber-500/40 px-1 text-[0.5rem] sm:text-[0.5625rem] font-bold uppercase tracking-wider">
          {over ? "Over" : "Full"}
        </span>
      )}
    </span>
  );
}
