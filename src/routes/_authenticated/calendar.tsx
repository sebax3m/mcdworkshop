import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Clock,
  User as UserIcon,
  X,
  Wrench,
  FileText,
  Bike as BikeIcon,
  Phone,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { initials } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/calendar")({
  component: CalendarPage,
});

const DAILY_CAPACITY_HOURS = 16;

type ViewMode = "month" | "week";

const SERVICE_COLORS: Record<string, { bg: string; ring: string; label: string }> = {
  basic: { bg: "bg-status-new/20", ring: "ring-status-new/40", label: "text-status-new" },
  standard: { bg: "bg-primary/20", ring: "ring-primary/40", label: "text-primary" },
  full: { bg: "bg-status-assigned/20", ring: "ring-status-assigned/40", label: "text-status-assigned" },
  dyno: { bg: "bg-status-parts/20", ring: "ring-status-parts/40", label: "text-status-parts" },
  diagnostic: { bg: "bg-status-progress/20", ring: "ring-status-progress/40", label: "text-status-progress" },
  insurance: { bg: "bg-amber-500/20", ring: "ring-amber-500/50", label: "text-amber-400" },
  default: { bg: "bg-muted", ring: "ring-border", label: "text-foreground" },
};

function serviceColor(t: string | null | undefined) {
  if (!t) return SERVICE_COLORS.default;
  const k = t.toLowerCase();
  if (k.includes("collision") || k.includes("insurance") || k.includes("crash")) return SERVICE_COLORS.insurance;
  if (k.includes("dyno")) return SERVICE_COLORS.dyno;
  if (k.includes("full")) return SERVICE_COLORS.full;
  if (k.includes("standard")) return SERVICE_COLORS.standard;
  if (k.includes("basic")) return SERVICE_COLORS.basic;
  if (k.includes("diag")) return SERVICE_COLORS.diagnostic;
  return SERVICE_COLORS.default;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const res: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    res.push(arr.slice(i, i + size));
  }
  return res;
}

function CalendarPage() {
  const qc = useQueryClient();
  const nav = useNavigate();
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [monthStart, setMonthStart] = useState<Date>(() => startOfMonth(new Date()));
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<any | null>(null);

  const visibleRange = useMemo(() => {
    if (viewMode === "week") {
      return { start: weekStart, end: addDays(weekStart, 6) };
    }
    const start = startOfWeek(startOfMonth(monthStart), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(monthStart), { weekStartsOn: 1 });
    return { start, end };
  }, [viewMode, weekStart, monthStart]);

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ["calendar-bookings", visibleRange.start.toISOString(), visibleRange.end.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select(
          "id, service_type, scheduled_date, drop_off_time, estimated_hours, status, color, complaints, notes, assigned_tech_id, customer_id, motorcycle_id, confirmed, job_id, customers(first_name,last_name,phone,email), motorcycles(year,make,model,rego)",
        )
        .gte("scheduled_date", format(visibleRange.start, "yyyy-MM-dd"))
        .lte("scheduled_date", format(visibleRange.end, "yyyy-MM-dd"))
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

  const goPrev = () => {
    if (viewMode === "week") setWeekStart((d) => addWeeks(d, -1));
    else setMonthStart((d) => subMonths(d, 1));
  };

  const goNext = () => {
    if (viewMode === "week") setWeekStart((d) => addWeeks(d, 1));
    else setMonthStart((d) => addMonths(d, 1));
  };

  const goToday = () => {
    const now = new Date();
    setWeekStart(startOfWeek(now, { weekStartsOn: 1 }));
    setMonthStart(startOfMonth(now));
  };

  const weekEnd = addDays(weekStart, 6);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const monthDays = useMemo(() => {
    if (viewMode !== "month") return [];
    const start = startOfWeek(startOfMonth(monthStart), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(monthStart), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [viewMode, monthStart]);

  const monthWeeks = useMemo(() => chunk(monthDays, 7), [monthDays]);

  const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

  return (
    <div className="space-y-3">
      {/* NAV + TOGGLE */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={goPrev}
            className="grid h-10 w-10 place-items-center rounded-xl border border-border hover:border-primary/50 hover:bg-primary/5 transition-colors"
            aria-label="Previous"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={goToday}
            className="inline-flex items-center px-3 h-10 rounded-xl border border-border hover:border-primary/50 text-xs font-semibold uppercase tracking-wider"
          >
            Today
          </button>
          <button
            onClick={goNext}
            className="grid h-10 w-10 place-items-center rounded-xl border border-border hover:border-primary/50 hover:bg-primary/5 transition-colors"
            aria-label="Next"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-sm font-semibold text-muted-foreground">
            {viewMode === "week" ? (
              <>
                {format(weekStart, "MMM d")} — {format(weekEnd, "MMM d, yyyy")}
              </>
            ) : (
              <>{format(monthStart, "MMMM yyyy")}</>
            )}
            <span className="ml-3 text-xs tabular-nums">
              {bookings.length} bookings · {[...totals.values()].reduce((a, b) => a + b, 0).toFixed(1)}h
            </span>
          </div>

          <div className="flex items-center rounded-xl border border-border overflow-hidden">
            <button
              onClick={() => setViewMode("month")}
              className={`px-3 h-8 text-xs font-semibold uppercase tracking-wider transition-colors ${
                viewMode === "month" ? "bg-primary text-primary-foreground" : "hover:bg-primary/5"
              }`}
            >
              Month
            </button>
            <button
              onClick={() => setViewMode("week")}
              className={`px-3 h-8 text-xs font-semibold uppercase tracking-wider transition-colors ${
                viewMode === "week" ? "bg-primary text-primary-foreground" : "hover:bg-primary/5"
              }`}
            >
              Week
            </button>
          </div>
        </div>
      </div>

      {/* MONTH VIEW */}
      {viewMode === "month" && (
        <div className="space-y-1">
          {/* Day headers */}
          <div className="grid grid-cols-7 gap-2" style={{ gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
            {dayNames.map((name) => (
              <div key={name} className="text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground py-1">
                {name}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-2" style={{ gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
            {monthDays.map((day, idx) => {
              const dayKey = format(day, "yyyy-MM-dd");
              const dayBookings = (bookings as any[]).filter((b) => b.scheduled_date === dayKey);
              const loadHours = totals.get(dayKey) ?? 0;
              const loadPct = Math.min(100, (loadHours / DAILY_CAPACITY_HOURS) * 100);
              const over = loadHours > DAILY_CAPACITY_HOURS;
              const today = isToday(day);
              const inMonth = isSameMonth(day, monthStart);

              return (
                <motion.div
                  key={dayKey}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: idx * 0.01 }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const id = e.dataTransfer.getData("text/booking-id");
                    if (id) moveBooking(id, day);
                    setDraggingId(null);
                  }}
                  onClick={() => {
                    setWeekStart(startOfWeek(day, { weekStartsOn: 1 }));
                    setViewMode("week");
                  }}
                  className={`card-surface p-2 min-h-[120px] flex flex-col cursor-pointer transition-colors hover:ring-1 hover:ring-primary/30 ${
                    today ? "ring-2 ring-primary/40" : ""
                  } ${draggingId ? "border-dashed" : ""} ${!inMonth ? "opacity-40" : ""}`}
                >
                  <div className="flex items-center justify-between">
                    <div
                      className={`font-display text-lg font-bold leading-none ${
                        today ? "red-gradient-text" : inMonth ? "text-foreground" : "text-muted-foreground"
                      }`}
                    >
                      {format(day, "d")}
                    </div>
                    {over && (
                      <span title="Overbooked" className="text-[9px] font-bold uppercase tracking-wider text-status-parts">
                        <AlertTriangle className="h-3 w-3 inline" />
                      </span>
                    )}
                  </div>

                  {loadHours > 0 && (
                    <div className="mt-1.5 h-1 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full ${over ? "bg-status-parts" : "bg-gradient-to-r from-[color:var(--primary)] to-[color:var(--md-blue)]"}`}
                        style={{ width: `${loadPct}%` }}
                      />
                    </div>
                  )}

                  <div className="mt-1.5 flex-1 flex flex-wrap gap-1 content-start">
                    {dayBookings.slice(0, 6).map((b: any) => {
                      const c = serviceColor(b.service_type);
                      return (
                        <div
                          key={b.id}
                          className="relative"
                          title={`${b.service_type} — ${b.motorcycles?.make ?? ""} ${b.motorcycles?.model ?? ""}${b.confirmed ? " · Confirmed" : ""}`}
                        >
                          <div className={`h-2 w-2 rounded-full ${c.bg} ring-1 ${c.ring}`} />
                          {b.confirmed && (
                            <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-green-500 ring-1 ring-background" />
                          )}
                        </div>
                      );
                    })}
                    {dayBookings.length > 6 && (
                      <span className="text-[9px] text-muted-foreground font-semibold">+{dayBookings.length - 6}</span>
                    )}
                  </div>

                  <div className="mt-auto flex items-center justify-between text-[9px] text-muted-foreground tabular-nums">
                    <span>{loadHours.toFixed(1)}h</span>
                    <span>{dayBookings.length} job{dayBookings.length === 1 ? "" : "s"}</span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* WEEK VIEW */}
      {viewMode === "week" && (
        <div className="grid grid-cols-1 lg:grid-cols-7 gap-3">
          {weekDays.map((day, idx) => {
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
                className={`card-surface p-4 min-h-[480px] flex flex-col transition-colors ${
                  today ? "ring-2 ring-primary/40" : ""
                } ${draggingId ? "border-dashed" : ""}`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div
                      className={`text-sm font-semibold uppercase tracking-wide ${
                        today ? "text-primary" : "text-muted-foreground"
                      }`}
                    >
                      {format(day, "EEEE")}
                    </div>
                    <div className={`font-display text-3xl font-bold leading-none mt-0.5 ${today ? "red-gradient-text" : ""}`}>
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
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedBooking(b);
                          }}
                          className={`relative w-full text-left rounded-lg p-2 ring-1 ${c.bg} ${c.ring} hover:ring-2 transition-all cursor-grab active:cursor-grabbing`}
                        >
                          {b.confirmed && (
                            <span
                              title="Confirmed"
                              className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-background"
                            />
                          )}
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
      )}

      {/* LEGEND */}
      <div className="card-surface p-4">
        <div className="text-xs uppercase tracking-[0.25em] text-muted-foreground mb-3">Service legend</div>
        <div className="flex flex-wrap gap-2.5">
          {[
            { label: "Basic", k: "basic" },
            { label: "Standard", k: "standard" },
            { label: "Full", k: "full" },
            { label: "Dyno", k: "dyno" },
            { label: "Diagnostic", k: "diagnostic" },
            { label: "Insurance", k: "insurance" },
          ].map((s) => {
            const c = SERVICE_COLORS[s.k];
            return (
              <span key={s.k} className={`inline-flex items-center gap-2 rounded-full px-4 py-2 ring-1 text-sm font-semibold uppercase tracking-wider ${c.bg} ${c.ring} ${c.label}`}>
                <span className="h-2.5 w-2.5 rounded-full bg-current" />
                {s.label}
              </span>
            );
          })}
        </div>
      </div>

      {/* BOOKING QUICK-VIEW POPUP */}
      <AnimatePresence>
        {selectedBooking && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setSelectedBooking(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.15 }}
              onClick={(e) => e.stopPropagation()}
              className="card-surface w-full max-w-md p-5 space-y-4 relative"
            >
              <button
                onClick={() => setSelectedBooking(null)}
                className="absolute top-3 right-3 grid h-8 w-8 place-items-center rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>

              {(() => {
                const b = selectedBooking;
                const c = serviceColor(b.service_type);
                const bike = b.motorcycles
                  ? `${b.motorcycles.year ?? ""} ${b.motorcycles.make} ${b.motorcycles.model}`.trim()
                  : "—";
                const customer = b.customers ? `${b.customers.first_name} ${b.customers.last_name}` : "—";
                return (
                  <>
                    <div className="flex items-center gap-2 pr-8">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 ring-1 text-[11px] font-bold uppercase tracking-wider ${c.bg} ${c.ring} ${c.label}`}>
                        <span className="h-1.5 w-1.5 rounded-full bg-current" />
                        {b.service_type}
                      </span>
                      {b.confirmed && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-green-500">
                          <span className="h-1.5 w-1.5 rounded-full bg-green-500" /> Confirmed
                        </span>
                      )}
                    </div>

                    <div>
                      <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Scheduled</div>
                      <div className="font-display text-lg font-bold">
                        {format(new Date(b.scheduled_date + "T00:00:00"), "EEE d MMM yyyy")}
                        {b.drop_off_time && (
                          <span className="ml-2 text-sm text-muted-foreground tabular-nums">
                            <Clock className="inline h-3.5 w-3.5 mr-1" />
                            {b.drop_off_time.slice(0, 5)}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {b.estimated_hours ?? 1}h estimated
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 pt-1 border-t border-border/60">
                      <div>
                        <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-1 flex items-center gap-1.5">
                          <BikeIcon className="h-3 w-3" /> Motorcycle
                        </div>
                        <div className="text-sm font-semibold">{bike}</div>
                        {b.motorcycles?.rego && (
                          <div className="text-xs text-muted-foreground">Rego: {b.motorcycles.rego}</div>
                        )}
                      </div>

                      <div>
                        <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-1 flex items-center gap-1.5">
                          <UserIcon className="h-3 w-3" /> Customer
                        </div>
                        <div className="text-sm font-semibold">{customer}</div>
                        {b.customers?.phone && (
                          <a
                            href={`tel:${b.customers.phone}`}
                            className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                          >
                            <Phone className="h-3 w-3" /> {b.customers.phone}
                          </a>
                        )}
                      </div>

                      {b.tech_name && (
                        <div>
                          <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-1">Technician</div>
                          <div className="text-sm font-semibold">{b.tech_name}</div>
                        </div>
                      )}

                      {b.complaints && (
                        <div>
                          <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-1">Complaints</div>
                          <div className="text-sm">{b.complaints}</div>
                        </div>
                      )}

                      {b.notes && (
                        <div>
                          <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-1">Notes</div>
                          <div className="text-sm">{b.notes}</div>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-border/60">
                      <button
                        onClick={() => {
                          const id = b.id;
                          setSelectedBooking(null);
                          nav({ to: "/bookings/$bookingId", params: { bookingId: id } });
                        }}
                        className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-semibold hover:border-primary/50 hover:bg-primary/5 transition-colors"
                      >
                        <FileText className="h-4 w-4" /> Booking
                      </button>
                      {b.job_id ? (
                        <button
                          onClick={() => {
                            const jid = b.job_id;
                            setSelectedBooking(null);
                            nav({ to: "/jobs/$jobId", params: { jobId: jid } });
                          }}
                          className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg red-surface px-3 py-2 text-sm font-semibold hover:scale-[1.02] transition-transform"
                        >
                          <Wrench className="h-4 w-4" /> Open Job Card
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            const id = b.id;
                            setSelectedBooking(null);
                            nav({ to: "/bookings/$bookingId", params: { bookingId: id } });
                          }}
                          className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg red-surface px-3 py-2 text-sm font-semibold hover:scale-[1.02] transition-transform"
                        >
                          <Wrench className="h-4 w-4" /> Create Job Card
                        </button>
                      )}
                    </div>
                  </>
                );
              })()}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
