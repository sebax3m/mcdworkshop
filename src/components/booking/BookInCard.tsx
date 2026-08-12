/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import { Bike as BikeIcon, CheckCircle, RotateCcw, User as UserIcon, Wrench } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { displayBike, displayCustomerName, displayServiceType } from "@/lib/display";
import { bookInStage, stageMeta } from "@/lib/workshop-status";
import { serviceColor } from "@/lib/service-colors";
import { cn } from "@/lib/utils";
import { useTechnicianNames, initialsOf } from "@/hooks/use-technician-names";

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
 * Compact book-in card: motorcycle → rego → customer → requested work → status.
 * Used by the book-in calendar, the day view and the Today dashboard.
 * Mobile gets an ultra-condensed layout to keep the weekly grid readable.
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
  const stage = stageMeta(bookInStage(b));
  const bike = displayBike(b.motorcycles);
  const rego = b.motorcycles?.rego || b.rego || "";
  const customer = displayCustomerName(b.customers);
  const work = displayServiceType(b.service_type, b.service_type_other);
  const svc = serviceColor(b.service_type);

  const techNames = useTechnicianNames();
  const techName = b.assigned_tech_id
    ? (b.tech_name ?? techNames.get(b.assigned_tech_id) ?? "Assigned")
    : null;

  const photo = Array.isArray(b.motorcycles?.photos) ? b.motorcycles.photos[0] : null;
  const jobCompleted =
    b.job_completed === true ||
    b.job_status === "completed" ||
    b.jobs?.status === "completed" ||
    b.status === "completed";

  const qc = useQueryClient();
  const [completing, setCompleting] = useState(false);
  const [reversing, setReversing] = useState(false);

  async function markCompleted(e: React.MouseEvent) {
    e.stopPropagation();
    if (completing) return;
    setCompleting(true);
    try {
      const updates: { status: string; loan_bike_returned_at?: string } = {
        status: "completed",
      };
      if (b.job_id) {
        const { error: jobError } = await supabase
          .from("jobs")
          .update({ status: "completed", completed_at: new Date().toISOString() })
          .eq("id", b.job_id);
        if (jobError) throw jobError;
      }
      if (b.loan_bike_id && !b.loan_bike_returned_at) {
        updates.loan_bike_returned_at = new Date().toISOString();
      }
      const { error } = await supabase.from("bookings").update(updates).eq("id", b.id);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["booking", b.id] });
      qc.invalidateQueries({ queryKey: ["calendar-bookings"] });
      qc.invalidateQueries({ queryKey: ["my-bookings"] });
      qc.invalidateQueries({ queryKey: ["my-jobs"] });
      qc.invalidateQueries({ queryKey: ["day-bookings"] });
      qc.invalidateQueries({ queryKey: ["today-bookings"] });
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
      qc.invalidateQueries({ queryKey: ["booking", b.id] });
      qc.invalidateQueries({ queryKey: ["calendar-bookings"] });
      qc.invalidateQueries({ queryKey: ["my-bookings"] });
      qc.invalidateQueries({ queryKey: ["my-jobs"] });
      qc.invalidateQueries({ queryKey: ["day-bookings"] });
      qc.invalidateQueries({ queryKey: ["today-bookings"] });
      qc.invalidateQueries({ queryKey: ["loan-bikes"] });
      qc.invalidateQueries({ queryKey: ["loan-bikes-active-assignments"] });
      toast.success("Completion reversed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reverse completion");
    } finally {
      setReversing(false);
    }
  }

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
      title={jobCompleted ? "Job completed" : undefined}
      className={cn(
        "group relative w-full rounded-lg text-left transition-all backdrop-blur-md shadow-sm",
        svc.fill,
        jobCompleted ? "job-complete-stripes" : "",
        "hover:shadow-md hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-primary/40",
        dense ? "p-1 sm:p-1.5" : "p-2.5",
        b.bike_arrived && "ring-1 ring-orange-500/60",
        draggable && "cursor-grab active:cursor-grabbing",
        className,
      )}
    >
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
          <CheckCircle className="h-3 w-3" />
        </button>
      )}

      {b.loan_bike && (
        <span
          className="absolute -top-1 -right-1 z-10 h-2.5 w-2.5 rounded-full bg-fuchsia-500 ring-2 ring-background shadow-[0_0_8px_rgba(217,70,239,0.9)] animate-pulse"
          title="Loan bike"
        />
      )}

      {/* Ultra-compact mobile view: bike + customer + tiny status dots */}
      <div className="sm:hidden flex items-start gap-1">
        {photo ? (
          <img
            src={typeof photo === "string" ? photo : photo?.url}
            alt=""
            loading="lazy"
            className="h-5 w-5 rounded object-cover border border-border shrink-0"
          />
        ) : (
          <div className="h-5 w-5 rounded grid place-items-center bg-background/50 text-foreground/70 shrink-0">
            <BikeIcon className="h-2.5 w-2.5" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-[0.65rem] leading-tight truncate">{bike}</div>
          <div className="flex items-center gap-0.5 text-[0.6rem] text-foreground/70 truncate">
            <UserIcon className="h-2 w-2 shrink-0" />
            <span className="truncate">{customer}</span>
          </div>
          <div className="mt-0.5 flex items-center gap-1 flex-wrap">
            <span className={cn("h-1.5 w-1.5 rounded-full", stage.dot)} title={stage.label} />
            {b.loan_bike && (
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" title="Loan bike" />
            )}
            {b.confirmed && (
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" title="Confirmed" />
            )}
            {techName && (
              <span
                className="ml-auto grid h-3.5 w-3.5 place-items-center rounded-full bg-primary text-[0.5rem] font-black text-primary-foreground"
                title={`Assigned to ${techName}`}
              >
                {initialsOf(techName).charAt(0)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Desktop / tablet view */}
      <div className="hidden sm:flex items-start gap-2">
        {photo ? (
          <img
            src={typeof photo === "string" ? photo : photo?.url}
            alt=""
            loading="lazy"
            className="h-7 w-7 sm:h-9 sm:w-9 rounded-md object-cover border border-border shrink-0"
          />
        ) : (
          <div className="h-7 w-7 sm:h-9 sm:w-9 rounded-md grid place-items-center bg-background/50 text-foreground/70 shrink-0">
            <BikeIcon className="h-3 w-3 sm:h-4 sm:w-4" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-1.5 sm:gap-2">
            <div className="font-semibold text-xs sm:text-sm truncate">{bike}</div>
            {rego && (
              <span className="hidden sm:inline-block shrink-0 rounded bg-background/60 px-1.5 py-0.5 text-[0.625rem] font-bold uppercase tracking-wider tabular-nums">
                {rego}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 text-[0.65rem] sm:text-xs text-foreground/70 truncate">
            <UserIcon className="h-2.5 w-2.5 sm:h-3 sm:w-3 shrink-0" />
            <span className="truncate">{customer}</span>
          </div>
          <div
            className={cn(
              "flex items-center gap-1 text-[0.65rem] sm:text-xs truncate font-semibold",
              svc.label,
            )}
          >
            <Wrench className="h-2.5 w-2.5 sm:h-3 sm:w-3 shrink-0" />
            <span className="truncate">{work}</span>
          </div>
          <div className="mt-1 sm:mt-1.5 flex items-center gap-1 sm:gap-1.5 flex-wrap">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-1 sm:px-1.5 py-0.5 text-[0.55rem] sm:text-[0.625rem] font-bold uppercase tracking-wider",
                stage.chip,
              )}
            >
              <span className={cn("h-1 sm:h-1.5 w-1 sm:w-1.5 rounded-full", stage.dot)} />
              <span className="hidden sm:inline">{stage.label}</span>
              <span className="sm:hidden">{stage.label.slice(0, 3)}</span>
            </span>
            {b.loan_bike && (
              <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-1 sm:px-1.5 py-0.5 text-[0.55rem] sm:text-[0.625rem] font-bold uppercase tracking-wider text-amber-400">
                Loan
              </span>
            )}
            {techName && (
              <span
                className="inline-flex items-center gap-1 rounded-full border border-primary/50 bg-primary/15 px-1 sm:px-1.5 py-0.5 text-[0.55rem] sm:text-[0.625rem] font-bold uppercase tracking-wider text-primary"
                title={`Assigned to ${techName}`}
              >
                <span className="grid h-3 w-3 place-items-center rounded-full bg-primary text-[0.5rem] font-black text-primary-foreground">
                  {initialsOf(techName).charAt(0)}
                </span>
                <span className="hidden sm:inline">{techName.split(" ")[0]}</span>
              </span>
            )}
            {b.confirmed && (
              <span className="hidden sm:inline-flex rounded-full border border-green-500/40 bg-green-500/10 px-1.5 py-0.5 text-[0.625rem] font-bold uppercase tracking-wider text-green-400">
                Confirmed
              </span>
            )}
          </div>
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
