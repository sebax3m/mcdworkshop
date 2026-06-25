import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  addDays,
  addWeeks,
  format,
  isSameDay,
  isToday,
  startOfWeek,
} from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Clock,
  User as UserIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { initials } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/calendar")({
  component: CalendarPage,
});

const DAILY_CAPACITY_HOURS = 16; // 2 techs × 8h default

const SERVICE_COLORS: Record<string, { bg: string; ring: string; label: string }> = {
  basic: { bg: "bg-status-new/20", ring: "ring-status-new/40", label: "text-status-new" },
  standard: { bg: "bg-primary/20", ring: "ring-primary/40", label: "text-primary" },
  full: { bg: "bg-status-assigned/20", ring: "ring-status-assigned/40", label: "text-status-assigned" },
  dyno: { bg: "bg-status-parts/20", ring: "ring-status-parts/40", label: "text-status-parts" },
  diagnostic: { bg: "bg-status-progress/20", ring: "ring-status-progress/40", label: "text-status-progress" },
  default: { bg: "bg-muted", ring: "ring-border", label: "text-foreground" },
};

function serviceColor(t: string | null | undefined) {
  if (!t) return SERVICE_COLORS.default;
  const k = t.toLowerCase();
  if (k.includes("dyno")) return SERVICE_COLORS.dyno;
  if (k.includes("full")) return SERVICE_COLORS.full;
  if (k.includes("standard")) return SERVICE_COLORS.standard;
  if (k.includes("basic")) return SERVICE_COLORS.basic;
  if (k.includes("diag")) return SERVICE_COLORS.diagnostic;
  return SERVICE_COLORS.default;
}

function CalendarPage() {
  const qc = useQueryClient();
  const nav = useNavigate();
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );
  const weekEnd = addDays(weekStart, 6);

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ["calendar-bookings", weekStart.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select(
          "id, service_type, scheduled_date, drop_off_time, estimated_hours, status, color, complaints, notes, assigned_tech_id, customer_id, motorcycle_id, customers(first_name,last_name), motorcycles(year,make,model,rego)",
        )
        .gte("scheduled_date", format(weekStart, "yyyy-MM-dd"))
        .lte("scheduled_date", format(weekEnd, "yyyy-MM-dd"))
        .order("drop_off_time", { ascending: true });
      if (error) throw error;
      const rows = data ?? [];
      const techIds = [...new Set(rows.map((r: any) => r.assigned_tech_id).filter(Boolean))];
      let techMap = new Map<string, string>();
      if (techIds.length) {
        const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", techIds);
        (profs ?? []).forEach((p: any) => techMap.set(p.id, p.full_name || ""));
      }
      return rows.map((r: any) => ({ ...r, tech_name: r.assigned_tech_id ? techMap.get(r.assigned_tech_id) : null }));
    },
  });

  async function moveBooking(bookingId: string, newDate: Date) {
    const dateStr = format(newDate, "yyyy-MM-dd");
    const { error } = await supabase.from("bookings").update({ scheduled_date: dateStr }).eq("id", bookingId);
    if (error) return toast.error(error.message);
    toast.success("Booking moved to " + format(newDate, "EEE d MMM"));
    qc.invalidateQueries({ queryKey: ["calendar-bookings"] });
  }

  const totals = useMemo(() => {
    const byDay = new Map<string, number>();
    for (const b of bookings as any[]) {
      const k = b.scheduled_date;
      byDay.set(k, (byDay.get(k) ?? 0) + Number(b.estimated_hours || 0));
    }
    return byDay;
  }, [bookings]);

  return (
    <div className="space-y-3">
      {/* WEEK NAV */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWeekStart((d) => addWeeks(d, -1))}
            className="grid h-10 w-10 place-items-center rounded-xl border border-border hover:border-primary/50 hover:bg-primary/5 transition-colors"
            aria-label="Previous week"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}
            className="inline-flex items-center px-3 h-10 rounded-xl border border-border hover:border-primary/50 text-xs font-semibold uppercase tracking-wider"
          >
            Today
          </button>
          <button
            onClick={() => setWeekStart((d) => addWeeks(d, 1))}
            className="grid h-10 w-10 place-items-center rounded-xl border border-border hover:border-primary/50 hover:bg-primary/5 transition-colors"
            aria-label="Next week"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="text-sm font-semibold text-muted-foreground">
          {format(weekStart, "MMM d")} — {format(weekEnd, "MMM d, yyyy")}
          <span className="ml-3 text-xs tabular-nums">
            {bookings.length} bookings · {[...totals.values()].reduce((a, b) => a + b, 0).toFixed(1)}h
          </span>
        </div>
      </div>

      {/* WEEK GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-7 gap-3">
        {days.map((day, idx) => {
          const dayKey = format(day, "yyyy-MM-dd");
          const dayBookings = (bookings as any[]).filter((b) => b.scheduled_date === dayKey);
          const loadHours = totals.get(dayKey) ?? 0;
          const loadPct = Math.min(100, (loadHours / DAILY_CAPACITY_HOURS) * 100);
          const over = loadHours > DAILY_CAPACITY_HOURS;
          const today = isToday(day);
          return (
            <motion.div
              key={dayKey}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: idx * 0.04 }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData("text/booking-id");
                if (id) moveBooking(id, day);
                setDraggingId(null);
              }}
              className={`card-surface p-3 min-h-[260px] flex flex-col transition-colors ${
                today ? "ring-2 ring-primary/40" : ""
              } ${draggingId ? "border-dashed" : ""}`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div
                    className={`text-[10px] uppercase tracking-[0.2em] ${
                      today ? "text-primary" : "text-muted-foreground"
                    }`}
                  >
                    {format(day, "EEE")}
                  </div>
                  <div className={`font-display text-2xl font-bold leading-none mt-0.5 ${today ? "red-gradient-text" : ""}`}>
                    {format(day, "d")}
                  </div>
                </div>
                {over && (
                  <span title="Overbooked" className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-status-parts">
                    <AlertTriangle className="h-3 w-3" /> Over
                  </span>
                )}
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${loadPct}%` }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                  className={`h-full rounded-full ${over ? "bg-status-parts" : "bg-gradient-to-r from-[color:var(--primary)] to-[color:var(--md-blue)]"}`}
                />
              </div>
              <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground tabular-nums">
                <span>{loadHours.toFixed(1)}h / {DAILY_CAPACITY_HOURS}h</span>
                <span>{dayBookings.length} job{dayBookings.length === 1 ? "" : "s"}</span>
              </div>

              <div className="mt-3 flex-1 space-y-1.5 overflow-y-auto pr-0.5">
                <AnimatePresence>
                  {dayBookings.map((b: any) => {
                    const c = serviceColor(b.service_type);
                    const bike = b.motorcycles ? `${b.motorcycles.year ?? ""} ${b.motorcycles.make} ${b.motorcycles.model}`.trim() : "—";
                    const customer = b.customers ? `${b.customers.first_name} ${b.customers.last_name}` : "—";
                    return (
                      <motion.button
                        key={b.id}
                        layout
                        initial={{ opacity: 0, scale: 0.96 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.96 }}
                        whileHover={{ y: -1 }}
                        draggable
                        onDragStart={(e) => {
                          (e as any).dataTransfer?.setData("text/booking-id", b.id);
                          setDraggingId(b.id);
                        }}
                        onDragEnd={() => setDraggingId(null)}
                        onClick={() => nav({ to: "/bookings/$bookingId", params: { bookingId: b.id } })}
                        className={`w-full text-left rounded-lg p-2 ring-1 ${c.bg} ${c.ring} hover:ring-2 transition-all cursor-grab active:cursor-grabbing`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className={`text-[9px] font-bold uppercase tracking-wider ${c.label}`}>
                            {b.service_type}
                          </span>
                          {b.drop_off_time && (
                            <span className="text-[9px] text-muted-foreground tabular-nums flex items-center gap-0.5">
                              <Clock className="h-2.5 w-2.5" />
                              {b.drop_off_time.slice(0, 5)}
                            </span>
                          )}
                        </div>
                        <div className="text-xs font-semibold truncate mt-0.5">{bike}</div>
                        <div className="text-[10px] text-muted-foreground truncate">{customer}</div>
                        <div className="mt-1 flex items-center justify-between">
                          <span className="text-[10px] text-muted-foreground tabular-nums">{b.estimated_hours ?? 1}h</span>
                          {b.tech_name ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-background/60 px-1.5 py-0.5 text-[9px] font-semibold">
                              <span className="grid h-3.5 w-3.5 place-items-center rounded-full red-surface text-[8px]">
                                {initials(b.tech_name)}
                              </span>
                              <span className="max-w-[60px] truncate">{b.tech_name.split(" ")[0]}</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[9px] text-muted-foreground italic">
                              <UserIcon className="h-2.5 w-2.5" /> Unassigned
                            </span>
                          )}
                        </div>
                      </motion.button>
                    );
                  })}
                </AnimatePresence>
                {!isLoading && dayBookings.length === 0 && (
                  <Link
                    to="/bookings/new"
                    search={{ date: dayKey }}
                    className="block rounded-lg border border-dashed border-border/60 p-3 text-center text-[10px] uppercase tracking-wider text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors"
                  >
                    + Book
                  </Link>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* LEGEND */}
      <div className="card-surface p-4">
        <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-2">Service legend</div>
        <div className="flex flex-wrap gap-2">
          {[
            { label: "Basic", k: "basic" },
            { label: "Standard", k: "standard" },
            { label: "Full", k: "full" },
            { label: "Dyno", k: "dyno" },
            { label: "Diagnostic", k: "diagnostic" },
          ].map((s) => {
            const c = SERVICE_COLORS[s.k];
            return (
              <span key={s.k} className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 ring-1 text-[10px] font-semibold uppercase tracking-wider ${c.bg} ${c.ring} ${c.label}`}>
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                {s.label}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}