import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  dyno: { bg: "bg-status-dyno/20", ring: "ring-status-dyno/40", label: "text-status-dyno" },
  diagnostic: { bg: "bg-status-progress/20", ring: "ring-status-progress/40", label: "text-status-progress" },
  insurance: { bg: "bg-status-insurance/20", ring: "ring-status-insurance/40", label: "text-status-insurance" },
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
  const [deleteBooking, setDeleteBooking] = useState<any | null>(null);
  const [now, setNow] = useState<Date>(() => new Date());
  const [quickSlot, setQuickSlot] = useState<{ date: Date; time: string } | null>(null);
  const [qFirst, setQFirst] = useState("");
  const [qLast, setQLast] = useState("");
  const [qPhone, setQPhone] = useState("");
  const [qBikeMake, setQBikeMake] = useState("");
  const [qBikeModel, setQBikeModel] = useState("");
  const [qBikeYear, setQBikeYear] = useState("");
  const [qService, setQService] = useState<string>("Standard Service");
  const [qEstHours, setQEstHours] = useState<string>("1");
  const [creatingQuick, setCreatingQuick] = useState(false);
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  function resetQuickForm() {
    setQFirst(""); setQLast(""); setQPhone("");
    setQBikeMake(""); setQBikeModel(""); setQBikeYear("");
    setQService("Standard Service"); setQEstHours("1");
  }

  async function createQuickBooking() {
    if (!quickSlot) return;
    if (!qFirst.trim()) return toast.error("First name required");
    if (!qBikeMake.trim() || !qBikeModel.trim()) return toast.error("Bike make and model required");
    setCreatingQuick(true);
    try {
      const { data: cust, error: cErr } = await supabase
        .from("customers")
        .insert({
          first_name: qFirst.trim(),
          last_name: qLast.trim() || null,
          phone: qPhone.trim() || null,
        })
        .select("id")
        .single();
      if (cErr) throw cErr;

      const { data: bike, error: bErr } = await (supabase as any)
        .from("motorcycles")
        .insert({
          customer_id: cust.id,
          make: qBikeMake.trim(),
          model: qBikeModel.trim(),
          year: qBikeYear ? Number(qBikeYear) : null,
        })
        .select("id")
        .single();
      if (bErr) throw bErr;

      const { error: bkErr } = await supabase.from("bookings").insert({
        customer_id: cust.id,
        motorcycle_id: bike.id,
        service_type: qService,
        scheduled_date: format(quickSlot.date, "yyyy-MM-dd"),
        drop_off_time: quickSlot.time,
        estimated_hours: Number(qEstHours) || 1,
        status: "booked",
      });
      if (bkErr) throw bkErr;

      toast.success("Booking created");
      setQuickSlot(null);
      resetQuickForm();
      qc.invalidateQueries({ queryKey: ["calendar-bookings"] });
    } catch (err: any) {
      toast.error(err.message ?? "Failed to create booking");
    } finally {
      setCreatingQuick(false);
    }
  }

  async function confirmDeleteBooking() {
    if (!deleteBooking) return;
    const { error } = await supabase.from("bookings").delete().eq("id", deleteBooking.id);
    if (error) return toast.error(error.message);
    toast.success("Booking deleted");
    setDeleteBooking(null);
    qc.invalidateQueries({ queryKey: ["calendar-bookings"] });
  }

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
          "id, service_type, scheduled_date, drop_off_time, estimated_hours, status, color, complaints, notes, assigned_tech_id, customer_id, motorcycle_id, confirmed, loan_bike, loan_bike_id, loan_bike_expected_return, job_id, customers(first_name,last_name,phone,email), motorcycles(year,make,model,rego), loan_bikes(id,name)",
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
                  className={`card-surface p-2 min-h-[160px] flex flex-col cursor-pointer transition-colors hover:ring-1 hover:ring-primary/30 ${
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

      {/* WEEK VIEW — Google-Calendar-style time grid */}
      {viewMode === "week" && (() => {
        const START_HOUR = 8;
        const END_HOUR = 18; // exclusive last label; grid ends at 18:00
        const HOURS = END_HOUR - START_HOUR;
        const SLOT_H = 56; // px per hour
        const GRID_H = HOURS * SLOT_H;

        const parseTime = (t?: string | null) => {
          if (!t) return { h: 9, m: 0 };
          const [hh, mm] = t.split(":");
          return { h: Number(hh) || 0, m: Number(mm) || 0 };
        };

        const nowMinutes = now.getHours() * 60 + now.getMinutes();
        const nowTop =
          ((nowMinutes - START_HOUR * 60) / 60) * SLOT_H;
        const showNow = nowTop >= 0 && nowTop <= GRID_H;

        const handleSlotClick = (e: React.MouseEvent<HTMLDivElement>, day: Date) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const y = e.clientY - rect.top;
          const hourFloat = START_HOUR + y / SLOT_H;
          // snap to 30 min
          const totalMin = Math.max(START_HOUR * 60, Math.round((hourFloat * 60) / 30) * 30);
          const h = Math.floor(totalMin / 60);
          const m = totalMin % 60;
          const time = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
          resetQuickForm();
          setQuickSlot({ date: day, time });
        };

        return (
          <div className="card-surface p-0 overflow-hidden">
            {/* Day headers */}
            <div
              className="grid border-b border-border/60"
              style={{ gridTemplateColumns: `56px repeat(7, minmax(0, 1fr))` }}
            >
              <div className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-wider text-center py-2 border-r border-border/60">
                GMT
              </div>
              {weekDays.map((day) => {
                const today = isToday(day);
                return (
                  <div
                    key={format(day, "yyyy-MM-dd")}
                    className={`text-center py-2 border-r border-border/40 last:border-r-0 ${
                      today ? "bg-primary/5" : ""
                    }`}
                  >
                    <div
                      className={`text-[10px] font-semibold uppercase tracking-wider ${
                        today ? "text-primary" : "text-muted-foreground"
                      }`}
                    >
                      {format(day, "EEE")}
                    </div>
                    <div
                      className={`mt-0.5 mx-auto grid place-items-center font-display font-bold text-lg leading-none ${
                        today
                          ? "h-8 w-8 rounded-full bg-primary text-primary-foreground"
                          : ""
                      }`}
                    >
                      {format(day, "d")}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Time grid body */}
            <div
              className="grid relative"
              style={{
                gridTemplateColumns: `56px repeat(7, minmax(0, 1fr))`,
                height: `${GRID_H}px`,
              }}
            >
              {/* Hours column */}
              <div className="relative border-r border-border/60">
                {Array.from({ length: HOURS }, (_, i) => {
                  const hh = START_HOUR + i;
                  const label =
                    hh === 12
                      ? "12 PM"
                      : hh > 12
                        ? `${hh - 12} PM`
                        : `${hh} AM`;
                  return (
                    <div
                      key={hh}
                      className="text-[10px] text-muted-foreground tabular-nums text-right pr-2 -translate-y-1.5"
                      style={{
                        position: "absolute",
                        top: `${i * SLOT_H}px`,
                        right: 0,
                        left: 0,
                      }}
                    >
                      {label}
                    </div>
                  );
                })}
              </div>

              {/* Day columns */}
              {weekDays.map((day) => {
                const dayKey = format(day, "yyyy-MM-dd");
                const dayBookings = (bookings as any[]).filter(
                  (b) => b.scheduled_date === dayKey,
                );
                const today = isToday(day);
                return (
                  <div
                    key={dayKey}
                    onClick={(e) => handleSlotClick(e, day)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const id = e.dataTransfer.getData("text/booking-id");
                      if (id) moveBooking(id, day);
                      setDraggingId(null);
                    }}
                    className={`relative border-r border-border/40 last:border-r-0 cursor-pointer ${
                      today ? "bg-primary/[0.03]" : ""
                    } ${draggingId ? "bg-primary/5" : ""}`}
                    style={{
                      backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${SLOT_H - 1}px, var(--border) ${SLOT_H - 1}px, var(--border) ${SLOT_H}px)`,
                    }}
                    title="Click to create booking"
                  >
                    {/* Half-hour lighter guides */}
                    <div
                      className="absolute inset-0 pointer-events-none opacity-40"
                      style={{
                        backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${SLOT_H / 2 - 1}px, var(--border) ${SLOT_H / 2 - 1}px, var(--border) ${SLOT_H / 2}px)`,
                      }}
                    />

                    {/* Current-time line */}
                    {today && showNow && (
                      <div
                        className="absolute left-0 right-0 z-20 pointer-events-none"
                        style={{ top: `${nowTop}px` }}
                      >
                        <div className="relative h-0">
                          <div className="absolute -left-1 -top-1 h-2.5 w-2.5 rounded-full bg-status-parts shadow-[0_0_8px_rgba(239,68,68,0.7)]" />
                          <div className="absolute left-0 right-0 h-[2px] bg-status-parts shadow-[0_0_6px_rgba(239,68,68,0.6)]" />
                        </div>
                      </div>
                    )}

                    {/* Bookings positioned by drop_off_time + estimated_hours */}
                    {dayBookings.map((b: any) => {
                      const { h, m } = parseTime(b.drop_off_time);
                      const top =
                        ((h + m / 60 - START_HOUR) * SLOT_H);
                      const hoursDur = Math.max(0.5, Number(b.estimated_hours || 1));
                      const height = Math.max(24, hoursDur * SLOT_H - 2);
                      // clamp to grid
                      if (top + height < 0 || top > GRID_H) return null;
                      const c = serviceColor(b.service_type);
                      const bike = b.motorcycles
                        ? `${b.motorcycles.year ?? ""} ${b.motorcycles.make} ${b.motorcycles.model}`.trim()
                        : "—";
                      const customer = b.customers
                        ? `${b.customers.first_name} ${b.customers.last_name}`
                        : "—";
                      return (
                        <motion.button
                          key={b.id}
                          layout
                          initial={{ opacity: 0, scale: 0.98 }}
                          animate={{ opacity: 1, scale: 1 }}
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
                          className={`absolute left-1 right-1 z-10 rounded-md p-1.5 text-left ring-1 overflow-hidden ${c.bg} ${c.ring} ${c.label} hover:ring-2 transition-all cursor-grab active:cursor-grabbing ${
                            b.loan_bike ? "!ring-2 !ring-amber-400" : ""
                          }`}
                          style={{ top: `${top}px`, height: `${height}px` }}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[9px] font-bold uppercase tracking-wider truncate">
                              {b.drop_off_time
                                ? b.drop_off_time.slice(0, 5)
                                : ""}{" "}
                              · {b.service_type}
                            </span>
                            {b.confirmed && (
                              <span className="h-1.5 w-1.5 rounded-full bg-green-500 shrink-0" />
                            )}
                          </div>
                          {height > 32 && (
                            <div className="text-[10px] font-semibold text-foreground truncate">
                              {bike}
                            </div>
                          )}
                          {height > 48 && (
                            <div className="text-[9px] text-muted-foreground truncate">
                              {customer}
                            </div>
                          )}
                        </motion.button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* LEGEND moved to sidebar (only visible on /calendar) */}


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
                      {b.loan_bike && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/20 border border-amber-400/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300">
                          🏍️ Loan bike {b.loan_bikes?.name ? `· ${b.loan_bikes.name}` : ""}
                          {b.loan_bike_expected_return ? ` · back ${format(new Date(b.loan_bike_expected_return + "T00:00:00"), "d MMM")}` : ""}
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

      <AlertDialog open={!!deleteBooking} onOpenChange={(o) => !o && setDeleteBooking(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this booking?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteBooking && (
                <>
                  Are you sure you want to delete the booking for{" "}
                  <span className="font-semibold text-foreground">
                    {deleteBooking.customers
                      ? `${deleteBooking.customers.first_name} ${deleteBooking.customers.last_name}`
                      : "this customer"}
                  </span>{" "}
                  on{" "}
                  <span className="font-semibold text-foreground">
                    {format(new Date(deleteBooking.scheduled_date + "T00:00:00"), "EEE d MMM yyyy")}
                  </span>
                  ? This cannot be undone.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteBooking}
              className="bg-status-parts text-white hover:bg-status-parts/90"
            >
              Delete booking
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
