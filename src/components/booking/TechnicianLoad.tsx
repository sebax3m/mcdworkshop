/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import { User2, Users } from "lucide-react";
import { useTechnicians } from "@/hooks/use-active-technician";
import { fullBike } from "@/lib/format";

type Props = {
  /** Bookings for the day being displayed. */
  bookings: any[];
  /** Called when a booking is dropped onto a technician (drag & drop assignment). */
  onAssign?: (bookingId: string, techId: string | null) => void;
  /** Enables drop targets. */
  droppable?: boolean;
  /** Click a booking row. */
  onOpenBooking?: (bookingId: string) => void;
  className?: string;
};

/**
 * Technician load panel — each technician is a drop target; dropping a
 * book-in assigns it to that technician. Clicking a technician expands the
 * jobs currently assigned to them for the day.
 */
export function TechnicianLoad({
  bookings,
  onAssign,
  droppable,
  onOpenBooking,
  className = "",
}: Props) {
  const { technicians, loading } = useTechnicians();
  const [openId, setOpenId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const forTech = (id: string) => bookings.filter((b) => b.assigned_tech_id === id);
  const unassigned = bookings.filter((b) => !b.assigned_tech_id);

  return (
    <section className={"card-surface p-3 space-y-2 " + className}>
      <div className="flex items-center justify-between">
        <h2 className="text-[0.6875rem] font-bold uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5" /> Technician load
        </h2>
        <span className="text-xs font-bold tabular-nums text-muted-foreground">
          {bookings.length - unassigned.length}/{bookings.length}
        </span>
      </div>

      {loading ? (
        <div className="text-xs text-muted-foreground py-3 text-center">Loading technicians…</div>
      ) : (
        <div className="space-y-1.5">
          {technicians.map((t) => {
            const list = forTech(t.id);
            const isOpen = openId === t.id;
            return (
              <div
                key={t.id}
                onDragOver={(e) => {
                  if (!droppable) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  setOverId(t.id);
                }}
                onDragLeave={(e) => {
                  if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                  setOverId((c) => (c === t.id ? null : c));
                }}
                onDrop={(e) => {
                  if (!droppable) return;
                  e.preventDefault();
                  e.stopPropagation();
                  setOverId(null);
                  const id = e.dataTransfer.getData("text/plain");
                  if (id) onAssign?.(id, t.id);
                }}
                className={
                  "rounded-lg border transition-colors " +
                  (overId === t.id
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-primary/40")
                }
              >
                <button
                  type="button"
                  onClick={() => setOpenId(isOpen ? null : t.id)}
                  className="w-full flex items-center gap-2 px-2.5 py-2 text-left"
                >
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-muted text-[0.625rem] font-bold uppercase">
                    {t.full_name.slice(0, 2)}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block truncate text-sm font-semibold">{t.full_name}</span>
                    <span className="block text-[0.625rem] uppercase tracking-wider text-muted-foreground">
                      {list.length} {list.length === 1 ? "job" : "jobs"}
                    </span>
                  </span>
                  <span className="rounded-full bg-primary/15 text-primary px-2 py-0.5 text-xs font-bold tabular-nums">
                    {list.length}
                  </span>
                </button>
                {isOpen && (
                  <div className="border-t border-border px-2.5 py-2 space-y-1">
                    {list.length === 0 ? (
                      <div className="text-xs text-muted-foreground">Nothing assigned yet</div>
                    ) : (
                      list.map((b) => (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => onOpenBooking?.(b.id)}
                          className="w-full text-left rounded-md px-2 py-1 hover:bg-muted"
                        >
                          <div className="text-xs font-semibold truncate">
                            {fullBike(b.motorcycles) || b.rego || "Bike"}
                          </div>
                          <div className="text-[0.625rem] text-muted-foreground truncate">
                            {b.service_type === "other"
                              ? b.service_type_other || "Other"
                              : b.service_type}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Unassigned bucket, also a drop target to clear the assignment */}
          <div
            onDragOver={(e) => {
              if (!droppable) return;
              e.preventDefault();
              setOverId("none");
            }}
            onDrop={(e) => {
              if (!droppable) return;
              e.preventDefault();
              e.stopPropagation();
              setOverId(null);
              const id = e.dataTransfer.getData("text/plain");
              if (id) onAssign?.(id, null);
            }}
            className={
              "rounded-lg border border-dashed px-2.5 py-2 text-xs text-muted-foreground flex items-center gap-2 " +
              (overId === "none" ? "border-primary bg-primary/10" : "border-border")
            }
          >
            <User2 className="h-3.5 w-3.5" /> Unassigned
            <span className="ml-auto font-bold tabular-nums">{unassigned.length}</span>
          </div>
        </div>
      )}
    </section>
  );
}
