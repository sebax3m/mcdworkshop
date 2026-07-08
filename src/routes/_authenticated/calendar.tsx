import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
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
  Trash2,
  ShieldCheck,
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
import { BIKE_MAKES, BIKE_MAKE_NAMES, BIKE_YEARS } from "@/lib/bike-library";

export const Route = createFileRoute("/_authenticated/calendar")({
  component: CalendarPage,
});

const DAILY_CAPACITY_HOURS = 16;

type ViewMode = "month" | "week";

const SERVICE_COLORS: Record<string, { bg: string; ring: string; label: string; text: string; hex: string }> = {
  basic: { bg: "bg-status-new/70", ring: "ring-status-new", label: "text-status-new", text: "text-white", hex: "#22c55e" },
  standard: { bg: "bg-primary/70", ring: "ring-primary", label: "text-primary", text: "text-white", hex: "#3b82f6" },
  full: { bg: "bg-status-assigned/70", ring: "ring-status-assigned", label: "text-status-assigned", text: "text-white", hex: "#f59e0b" },
  dyno: { bg: "bg-status-dyno/70", ring: "ring-status-dyno", label: "text-status-dyno", text: "text-black", hex: "#a855f7" },
  diagnostic: { bg: "bg-status-progress/70", ring: "ring-status-progress", label: "text-status-progress", text: "text-black", hex: "#14b8a6" },
  insurance: { bg: "bg-status-insurance/70", ring: "ring-status-insurance", label: "text-status-insurance", text: "text-white", hex: "#ef4444" },
  postbike: { bg: "bg-cyan-400/70", ring: "ring-cyan-400", label: "text-cyan-400", text: "text-black", hex: "#06b6d4" },
  other: { bg: "bg-muted-foreground/70", ring: "ring-muted-foreground", label: "text-muted-foreground", text: "text-white", hex: "#64748b" },
  default: { bg: "bg-muted", ring: "ring-border", label: "text-foreground", text: "text-white", hex: "#3b82f6" },
};

function serviceColor(t: string | null | undefined) {
  if (!t) return SERVICE_COLORS.default;
  const k = t.toLowerCase();
  if (k.includes("post") && k.includes("bike")) return SERVICE_COLORS.postbike;
  if (k.includes("collision") || k.includes("insurance") || k.includes("crash")) return SERVICE_COLORS.insurance;
  if (k.includes("tuning") || k.includes("dyno")) return SERVICE_COLORS.dyno;
  if (k.includes("full")) return SERVICE_COLORS.full;
  if (k.includes("standard")) return SERVICE_COLORS.standard;
  if (k.includes("basic")) return SERVICE_COLORS.basic;
  if (k.includes("diag")) return SERVICE_COLORS.diagnostic;
  if (k === "other") return SERVICE_COLORS.other;
  return SERVICE_COLORS.default;
}

const SERVICE_TYPES = [
  "Basic Service",
  "Standard Service",
  "Full Service",
  "Tuning",
  "Diagnostic",
  "Insurance / Crash",
  "Post Bike",
  "Other",
];


function isSunday(d: Date) {
  return d.getDay() === 0;
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
  const [qSearch, setQSearch] = useState("");
  const [qCustomerId, setQCustomerId] = useState<string | null>(null);
  const [qBikeId, setQBikeId] = useState<string | null>(null);
  const [qFirst, setQFirst] = useState("");
  const [qLast, setQLast] = useState("");
  const [qPhone, setQPhone] = useState("");
  const [qBikeMake, setQBikeMake] = useState("");
  const [qBikeModel, setQBikeModel] = useState("");
  const [qBikeYear, setQBikeYear] = useState("");
  const [qBikeRego, setQBikeRego] = useState("");
  const [qService, setQService] = useState<string>("Standard Service");
  const [qServiceOther, setQServiceOther] = useState<string>("");
  const [qEstHours, setQEstHours] = useState<string>("1");
  const [qWofNeeded, setQWofNeeded] = useState(false);
  const [qWofExpiry, setQWofExpiry] = useState<string>("");
  const [qLoanBike, setQLoanBike] = useState(false);
  const [qLoanBikeId, setQLoanBikeId] = useState<string | null>(null);
  const [qLoanBikeReturn, setQLoanBikeReturn] = useState<string>("");
  const [creatingQuick, setCreatingQuick] = useState(false);
  const [hoverSlot, setHoverSlot] = useState<{ dayKey: string; slotIdx: number } | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [gridH, setGridH] = useState(560);
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const h = Math.max(560, Math.round(entry.contentRect.height));
        setGridH((prev) => (prev !== h ? h : prev));
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [viewMode]);

  const quickCustomers = useQuery({
    queryKey: ["quick-customers"],
    enabled: !!quickSlot || !!selectedBooking,
    queryFn: async () => {
      const { data } = await supabase
        .from("customers")
        .select("id, first_name, last_name, phone, email")
        .order("first_name");
      return data ?? [];
    },
  });

  const editBikes = useQuery({
    queryKey: ["edit-bikes", selectedBooking?.customer_id],
    enabled: !!selectedBooking?.customer_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("motorcycles")
        .select("id, year, make, model, rego")
        .eq("customer_id", selectedBooking!.customer_id);
      return data ?? [];
    },
  });


  const quickBikes = useQuery({
    queryKey: ["quick-bikes", qCustomerId],
    enabled: !!qCustomerId,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("motorcycles")
        .select("id, make, model, year, rego")
        .eq("customer_id", qCustomerId);
      return data ?? [];
    },
  });

  const qLoanBikesQ = useQuery({
    queryKey: ["quick-loan-bikes"],
    enabled: !!quickSlot,
    queryFn: async () =>
      (await supabase.from("loan_bikes").select("id, name, current_km, active").eq("active", true).order("name")).data ?? [],
  });
  const qActiveLoansQ = useQuery({
    queryKey: ["quick-active-loans"],
    enabled: !!quickSlot,
    queryFn: async () =>
      (await supabase
        .from("bookings")
        .select("loan_bike_id, loan_bike_expected_return, customers(first_name,last_name)")
        .not("loan_bike_id", "is", null)
        .is("loan_bike_returned_at", null)).data ?? [],
  });

  const customerMatches = useMemo(() => {
    const term = qSearch.trim().toLowerCase();
    if (!term || qCustomerId) return [];
    const list = (quickCustomers.data ?? []) as any[];
    return list
      .filter((c) => {
        const name = `${c.first_name ?? ""} ${c.last_name ?? ""}`.toLowerCase();
        const phone = (c.phone ?? "").toLowerCase();
        return name.includes(term) || phone.includes(term);
      })
      .slice(0, 6);
  }, [qSearch, qCustomerId, quickCustomers.data]);

  function pickCustomer(c: any) {
    setQCustomerId(c.id);
    setQFirst(c.first_name ?? "");
    setQLast(c.last_name ?? "");
    setQPhone(c.phone ?? "");
    setQSearch(`${c.first_name ?? ""} ${c.last_name ?? ""}`.trim());
    setQBikeId(null);
    setQBikeMake(""); setQBikeModel(""); setQBikeYear(""); setQBikeRego("");
  }

  function pickBike(b: any) {
    setQBikeId(b.id);
    setQBikeMake(b.make ?? "");
    setQBikeModel(b.model ?? "");
    setQBikeYear(b.year ? String(b.year) : "");
    setQBikeRego(b.rego ?? "");
  }

  function clearCustomerSelection() {
    setQCustomerId(null);
    setQBikeId(null);
    setQFirst(""); setQLast(""); setQPhone("");
    setQBikeMake(""); setQBikeModel(""); setQBikeYear(""); setQBikeRego("");
    setQSearch("");
  }

  function resetQuickForm() {
    setQSearch("");
    setQCustomerId(null); setQBikeId(null);
    setQFirst(""); setQLast(""); setQPhone("");
    setQBikeMake(""); setQBikeModel(""); setQBikeYear(""); setQBikeRego("");
    setQService("Standard Service"); setQServiceOther(""); setQEstHours("1");
    setQWofNeeded(false); setQWofExpiry("");
    setQLoanBike(false); setQLoanBikeId(null); setQLoanBikeReturn("");
  }

  async function createQuickBooking() {
    if (!quickSlot) return;
    if (!qFirst.trim()) return toast.error("First name required");
    if (!qBikeMake.trim() || !qBikeModel.trim()) return toast.error("Bike make and model required");
    const [qh, qm] = quickSlot.time.split(":");
    const startMin = (Number(qh) || 0) * 60 + (Number(qm) || 0);
    const clash = findOverlap(format(quickSlot.date, "yyyy-MM-dd"), startMin, Number(qEstHours) || 1);
    if (clash) return toast.error(`Slot already booked (${clash.service_type} at ${String(clash.drop_off_time).slice(0,5)})`);
    setCreatingQuick(true);
    try {
      let customerId = qCustomerId;
      if (!customerId) {
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
        customerId = cust.id;
      }

      let bikeId = qBikeId;
      if (!bikeId) {
        const { data: bike, error: bErr } = await (supabase as any)
          .from("motorcycles")
          .insert({
            customer_id: customerId,
            make: qBikeMake.trim(),
            model: qBikeModel.trim(),
            year: qBikeYear ? Number(qBikeYear) : null,
            rego: qBikeRego.trim().toUpperCase() || null,
          })
          .select("id")
          .single();
        if (bErr) throw bErr;
        bikeId = bike.id;
      }

      const { error: bkErr } = await supabase.from("bookings").insert({
        customer_id: customerId!,
        motorcycle_id: bikeId!,
        service_type: qService,
        service_type_other: qService === "Other" ? qServiceOther.trim() || null : null,
        scheduled_date: format(quickSlot.date, "yyyy-MM-dd"),
        drop_off_time: quickSlot.time,
        estimated_hours: Number(qEstHours) || 1,
        rego: qBikeRego.trim().toUpperCase() || null,
        loan_bike: qLoanBike,
        loan_bike_id: qLoanBike ? qLoanBikeId : null,
        loan_bike_expected_return: qLoanBike && qLoanBikeReturn ? qLoanBikeReturn : null,
        status: "booked",
        wof_expiry: qWofNeeded && qWofExpiry ? qWofExpiry : null,
        notes: qWofNeeded ? "WOF required" : null,
      });
      if (bkErr) throw bkErr;

      toast.success("Booking created");
      setQuickSlot(null);
      resetQuickForm();
      qc.invalidateQueries({ queryKey: ["calendar-bookings"] });
      qc.invalidateQueries({ queryKey: ["quick-customers"] });
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
          "id, service_type, service_type_other, scheduled_date, drop_off_time, estimated_hours, status, color, complaints, notes, assigned_tech_id, customer_id, motorcycle_id, confirmed, loan_bike, loan_bike_id, loan_bike_expected_return, job_id, customers(first_name,last_name,phone,email), motorcycles(year,make,model,rego), loan_bikes(id,name)",
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

  function findOverlap(
    dayKey: string,
    startMin: number,
    hours: number,
    excludeId?: string,
  ): any | null {
    const endMin = startMin + Math.max(0.25, hours) * 60;
    for (const bk of bookings as any[]) {
      if (bk.id === excludeId) continue;
      if (bk.scheduled_date !== dayKey) continue;
      if (!bk.drop_off_time) continue;
      const [hh, mm] = String(bk.drop_off_time).split(":");
      const bs = (Number(hh) || 0) * 60 + (Number(mm) || 0);
      const be = bs + Math.max(0.25, Number(bk.estimated_hours || 1)) * 60;
      if (startMin < be && endMin > bs) return bk;
    }
    return null;
  }

  async function moveBooking(bookingId: string, newDate: Date, newTime?: string) {
    const dateStr = format(newDate, "yyyy-MM-dd");
    const current = (bookings as any[]).find((b) => b.id === bookingId);
    const hours = Math.max(0.25, Number(current?.estimated_hours || 1));
    if (newTime) {
      const [hh, mm] = newTime.split(":");
      const startMin = (Number(hh) || 0) * 60 + (Number(mm) || 0);
      const clash = findOverlap(dateStr, startMin, hours, bookingId);
      if (clash) {
        toast.error(`Slot already booked (${clash.service_type} at ${String(clash.drop_off_time).slice(0,5)})`);
        return;
      }
    }
    const patch: any = { scheduled_date: dateStr };
    if (newTime) patch.drop_off_time = newTime;
    const { error } = await supabase.from("bookings").update(patch).eq("id", bookingId);
    if (error) return toast.error(error.message);
    toast.success(
      "Booking moved to " + format(newDate, "EEE d MMM") + (newTime ? ` · ${newTime}` : ""),
    );
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
    <div className="flex flex-col gap-3 h-full">
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
        <div className="overflow-x-auto min-w-full">
          <div className="space-y-1 min-w-[720px]">
          {/* Day headers */}
          <div className="grid grid-cols-7 gap-2" style={{ gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
            {dayNames.map((name) => (
              <div key={name} className={`text-center text-[10px] font-bold uppercase tracking-wider py-1 rounded ${
                name === "Sunday" ? "bg-primary/[0.05] text-primary" : "text-muted-foreground"
              }`}>
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
                  } ${isSunday(day) ? "bg-primary/[0.14]" : ""} ${draggingId ? "border-dashed" : ""} ${!inMonth ? "opacity-40" : ""}`}
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
                          <div
                            className={`h-2 w-2 rounded-full ${b.color ? "" : `${c.bg} ring-1 ${c.ring}`}`}
                            style={b.color ? { backgroundColor: b.color, boxShadow: `0 0 0 1px ${b.color}` } : undefined}
                          />
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
        </div>
      )}

      {/* WEEK VIEW — Google-Calendar-style time grid */}
      {viewMode === "week" && (() => {
        const START_HOUR = 8;
        const END_HOUR = 18; // exclusive last label; grid ends at 18:00
        const HOURS = END_HOUR - START_HOUR;
        const SLOT_H = gridH / HOURS;
        const GRID_H = gridH;

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
          const dayKey = format(day, "yyyy-MM-dd");
          const clash = findOverlap(dayKey, totalMin, 0.5);
          if (clash) {
            setSelectedBooking(clash);
            return;
          }
          resetQuickForm();
          setQuickSlot({ date: day, time });
        };

        return (
          <div className="card-surface p-0 overflow-hidden flex flex-col flex-1 min-h-[560px]">
            <div className="overflow-x-auto min-w-full min-h-0 flex-1">
              <div className="min-w-[900px] h-full flex flex-col">
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
                const dayKey = format(day, "yyyy-MM-dd");
                const isHovered = hoverSlot?.dayKey === dayKey;
                return (
                  <div
                    key={dayKey}
                    className={`text-center py-2 border-r border-border/40 last:border-r-0 transition-colors ${
                      today ? "bg-primary/5" : isSunday(day) ? "bg-primary/[0.14]" : ""
                    } ${isHovered ? "bg-primary/10" : ""}`}
                  >
                    <div
                      className={`text-[10px] font-semibold uppercase tracking-wider transition-colors ${
                        today ? "text-primary" : isSunday(day) ? "text-primary" : isHovered ? "text-foreground" : "text-muted-foreground"
                      }`}
                    >
                      {format(day, "EEEE")}
                    </div>
                    <div
                      className={`mt-0.5 mx-auto grid place-items-center font-display font-bold text-lg leading-none ${
                        today
                          ? "h-8 w-8 rounded-full bg-primary text-primary-foreground"
                          : isHovered ? "text-primary" : ""
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
              ref={bodyRef}
              className="grid relative flex-1 min-h-[560px]"
              style={{
                gridTemplateColumns: `56px repeat(7, minmax(0, 1fr))`,
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
                  const activeHour = hoverSlot && Math.floor(hoverSlot.slotIdx / 2) === i;
                  return (
                    <div
                      key={hh}
                      className={`text-[10px] tabular-nums text-right pr-2 -translate-y-1.5 transition-colors ${
                        activeHour ? "text-primary font-bold" : "text-muted-foreground"
                      }`}
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
                    onMouseMove={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const y = e.clientY - rect.top;
                      const slotIdx = Math.max(
                        0,
                        Math.min(HOURS * 2 - 1, Math.floor(y / (SLOT_H / 2))),
                      );
                      if (hoverSlot?.dayKey !== dayKey || hoverSlot?.slotIdx !== slotIdx) {
                        setHoverSlot({ dayKey, slotIdx });
                      }
                    }}
                    onMouseLeave={() => setHoverSlot(null)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const id = e.dataTransfer.getData("text/booking-id");
                      if (!id) return;
                      const offsetY = Number(e.dataTransfer.getData("text/grab-offset")) || 0;
                      const rect = e.currentTarget.getBoundingClientRect();
                      const y = e.clientY - rect.top - offsetY;
                      const hourFloat = START_HOUR + y / SLOT_H;
                      const totalMin = Math.max(
                        START_HOUR * 60,
                        Math.min(END_HOUR * 60 - 30, Math.round((hourFloat * 60) / 30) * 30),
                      );
                      const nh = Math.floor(totalMin / 60);
                      const nm = totalMin % 60;
                      const time = `${String(nh).padStart(2, "0")}:${String(nm).padStart(2, "0")}`;
                      moveBooking(id, day, time);
                      setDraggingId(null);
                    }}
                    className={`relative border-r border-border/40 last:border-r-0 cursor-pointer ${
                      today ? "bg-primary/[0.03]" : isSunday(day) ? "bg-primary/[0.14]" : ""
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

                    {/* Hover slot highlight */}
                    {hoverSlot?.dayKey === dayKey && (
                      <div
                        className="absolute left-0.5 right-0.5 pointer-events-none rounded-md bg-primary/15 ring-1 ring-primary/50 shadow-[0_0_12px_rgba(59,130,246,0.35)] transition-[top] duration-75"
                        style={{
                          top: `${hoverSlot.slotIdx * (SLOT_H / 2)}px`,
                          height: `${SLOT_H / 2}px`,
                        }}
                      />
                    )}

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
                        ? `${b.customers.first_name ?? ""} ${b.customers.last_name ?? ""}`.trim() || "—"
                        : "—";
                      return (
                        <div
                          key={b.id}
                          role="button"
                          tabIndex={0}
                          draggable
                          onMouseEnter={() => setHoverSlot(null)}
                          onMouseMove={(e) => e.stopPropagation()}
                          onDragStart={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            const grabY = e.clientY - rect.top;
                            e.dataTransfer.effectAllowed = "move";
                            e.dataTransfer.setData("text/booking-id", b.id);
                            e.dataTransfer.setData("text/grab-offset", String(grabY));
                            setDraggingId(b.id);
                          }}
                          onDragEnd={() => setDraggingId(null)}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedBooking(b);
                          }}
                          className={`group absolute left-1 right-1 z-10 rounded-md p-2 text-left ring-1 overflow-hidden select-none transition-all hover:z-30 hover:brightness-110 hover:ring-2 hover:ring-primary hover:shadow-[0_8px_24px_rgba(0,0,0,0.35)] cursor-grab active:cursor-grabbing ${
                            b.color ? "text-foreground" : `${c.bg} ${c.ring} ${c.text}`
                          } ${draggingId === b.id ? "opacity-40" : ""} ${b.loan_bike ? "!ring-2 !ring-amber-400" : ""}`}
                          style={{
                            top: `${top}px`,
                            height: `${height}px`,
                            ...(b.color ? { backgroundColor: `${b.color}B3`, boxShadow: `inset 0 0 0 1px ${b.color}` } : {}),
                          }}
                        >
                          {/* Drag grip indicator — visible on hover */}
                          <div className="absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-70 transition-opacity pointer-events-none text-current text-[9px] leading-none font-black">
                            ⋮⋮
                          </div>
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[9px] font-bold uppercase tracking-wider truncate">
                              {b.drop_off_time
                                ? b.drop_off_time.slice(0, 5)
                                : ""}{" "}
                              · {b.service_type}
                              {b.service_type === "Other" && b.service_type_other ? ` — ${b.service_type_other}` : ""}
                            </span>
                            {b.confirmed && (
                              <span className="h-1.5 w-1.5 rounded-full bg-green-500 shrink-0" />
                            )}
                          </div>
                          {height > 32 && (
                            <div className="text-[10px] font-semibold text-current/90 truncate">
                              {bike}
                            </div>
                          )}
                          {height > 48 && (
                            <div className="text-[9px] text-current/80 truncate">
                              {customer}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
              </div>
            </div>
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
                const customer = b.customers ? (`${b.customers.first_name ?? ""} ${b.customers.last_name ?? ""}`.trim() || "—") : "—";
                return (
                  <>
                    <div className="flex items-center gap-2 pr-8">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 ring-1 text-[11px] font-bold uppercase tracking-wider ${c.bg} ${c.ring} ${c.text}`}>
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
                      <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-1.5">Scheduled</div>
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="date"
                          defaultValue={b.scheduled_date}
                          onBlur={async (e) => {
                            const v = e.target.value;
                            if (!v || v === b.scheduled_date) return;
                            const [th, tm] = String(b.drop_off_time || "00:00").split(":");
                            const clash = findOverlap(v, (Number(th)||0)*60 + (Number(tm)||0), Number(b.estimated_hours) || 1, b.id);

                            if (clash) return toast.error(`Slot taken (${clash.service_type} at ${String(clash.drop_off_time).slice(0,5)})`);
                            const { error } = await supabase.from("bookings").update({ scheduled_date: v }).eq("id", b.id);
                            if (error) return toast.error(error.message);
                            setSelectedBooking({ ...b, scheduled_date: v });
                            qc.invalidateQueries({ queryKey: ["calendar-bookings"] });
                            toast.success("Date updated");
                          }}
                          className="rounded-md border border-border bg-background px-2 py-1 text-sm tabular-nums focus:border-primary/60 outline-none"
                        />
                        <input
                          type="time"
                          defaultValue={b.drop_off_time ? String(b.drop_off_time).slice(0,5) : ""}
                          onBlur={async (e) => {
                            const v = e.target.value;
                            if (!v || v === (b.drop_off_time ? String(b.drop_off_time).slice(0,5) : "")) return;
                            const [hh, mm] = v.split(":");
                            const totalMin = Number(hh) * 60 + Number(mm);
                            const clash = findOverlap(b.scheduled_date, totalMin, Number(b.estimated_hours) || 1, b.id);
                            if (clash) return toast.error(`Slot taken (${clash.service_type} at ${String(clash.drop_off_time).slice(0,5)})`);
                            const { error } = await supabase.from("bookings").update({ drop_off_time: v + ":00" }).eq("id", b.id);
                            if (error) return toast.error(error.message);
                            setSelectedBooking({ ...b, drop_off_time: v + ":00" });
                            qc.invalidateQueries({ queryKey: ["calendar-bookings"] });
                            toast.success("Time updated");
                          }}
                          className="rounded-md border border-border bg-background px-2 py-1 text-sm tabular-nums focus:border-primary/60 outline-none"
                        />
                      </div>
                      <div className="text-xs text-muted-foreground mt-2 flex items-center gap-2">
                        <span>Estimated:</span>
                        <input
                          type="number"
                          min="0.25"
                          step="0.25"
                          defaultValue={b.estimated_hours ?? 1}
                          onBlur={async (e) => {
                            const v = Number(e.target.value);
                            if (!v || v === Number(b.estimated_hours)) return;
                            const { error } = await supabase
                              .from("bookings")
                              .update({ estimated_hours: v })
                              .eq("id", b.id);
                            if (error) return toast.error(error.message);
                            setSelectedBooking({ ...b, estimated_hours: v });
                            qc.invalidateQueries({ queryKey: ["calendar-bookings"] });
                            toast.success("Estimated hours updated");
                          }}
                          onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                          className="w-16 rounded-md border border-border bg-background px-2 py-0.5 text-xs tabular-nums text-foreground focus:border-primary/60 outline-none"
                        />
                        <span>h</span>
                      </div>

                      <div className="mt-3">
                        <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-1.5">Service type</div>
                        <div className="flex flex-wrap gap-1.5">
                          {SERVICE_TYPES.map((s) => {
                            const sc = serviceColor(s);
                            const active = (b.service_type ?? "").toLowerCase() === s.toLowerCase();
                            return (
                              <button
                                key={s}
                                type="button"
                                onClick={async () => {
                                  const { error } = await supabase
                                    .from("bookings")
                                    .update({ service_type: s, color: sc.hex })
                                    .eq("id", b.id);
                                  if (error) return toast.error(error.message);
                                  setSelectedBooking({ ...b, service_type: s, color: sc.hex });
                                  qc.invalidateQueries({ queryKey: ["calendar-bookings"] });
                                  toast.success(`Set to ${s}`);
                                }}
                                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider ring-1 transition-all ${sc.bg} ${sc.ring} ${sc.text} ${active ? "ring-2 scale-[1.03]" : "opacity-75 hover:opacity-100"}`}
                              >
                                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                                {s}
                              </button>
                            );
                          })}
                        </div>
                        {(b.service_type ?? "").toLowerCase() === "other" && (
                          <div className="mt-2">
                            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Other service details</label>
                            <textarea
                              key={`other-${b.id}`}
                              defaultValue={b.service_type_other ?? ""}
                              placeholder="Describe the service..."
                              onBlur={async (e) => {
                                const v = e.target.value.trim();
                                if (v === (b.service_type_other ?? "")) return;
                                const { error } = await supabase
                                  .from("bookings")
                                  .update({ service_type_other: v || null })
                                  .eq("id", b.id);
                                if (error) return toast.error(error.message);
                                setSelectedBooking({ ...b, service_type_other: v || null });
                                qc.invalidateQueries({ queryKey: ["calendar-bookings"] });
                                toast.success("Service details updated");
                              }}
                              className="mt-1 w-full min-h-[64px] rounded-lg border border-border bg-background/60 px-3 py-2 text-sm focus:border-primary/60 focus:outline-none resize-y"
                            />
                          </div>
                        )}
                      </div>
                    </div>


                    <div className="grid grid-cols-1 gap-3 pt-1 border-t border-border/60">
                      <div className="rounded-lg border border-border/60 bg-muted/20 p-3 space-y-2">
                        <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground flex items-center gap-1.5">
                          <UserIcon className="h-3 w-3" /> Customer assigned
                        </div>
                        <div className="text-sm font-semibold">{customer}</div>
                        <div className="flex items-center gap-2">
                          <Phone className="h-3 w-3 text-muted-foreground shrink-0" />
                          <input
                            key={`phone-${b.customer_id}`}
                            type="tel"
                            defaultValue={b.customers?.phone ?? ""}
                            placeholder="Phone number"
                            disabled={!b.customer_id}
                            onBlur={async (e) => {
                              const v = e.target.value.trim();
                              if (!b.customer_id) return;
                              if ((v || null) === (b.customers?.phone ?? null)) return;
                              const { error } = await supabase
                                .from("customers")
                                .update({ phone: v || null })
                                .eq("id", b.customer_id);
                              if (error) return toast.error(error.message);
                              setSelectedBooking({
                                ...b,
                                customers: { ...(b.customers ?? {}), phone: v || null },
                              });
                              qc.invalidateQueries({ queryKey: ["calendar-bookings"] });
                              qc.invalidateQueries({ queryKey: ["quick-customers"] });
                              toast.success("Phone updated");
                            }}
                            className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-sm focus:border-primary/60 outline-none disabled:opacity-50"
                          />
                        </div>
                        <div>
                          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Change customer</div>
                          <select
                            value={b.customer_id || ""}
                            onChange={async (e) => {
                              const newCustomerId = e.target.value || null;
                              if (!newCustomerId || newCustomerId === b.customer_id) return;
                              const { error } = await supabase
                                .from("bookings")
                                .update({ customer_id: newCustomerId, motorcycle_id: undefined })
                                .eq("id", b.id);
                              if (error) return toast.error(error.message);
                              const pick = (quickCustomers.data ?? []).find((x: any) => x.id === newCustomerId);
                              setSelectedBooking({
                                ...b,
                                customer_id: newCustomerId,
                                motorcycle_id: null,
                                customers: pick
                                  ? { first_name: pick.first_name, last_name: pick.last_name, phone: pick.phone, email: pick.email }
                                  : null,
                                motorcycles: null,
                              });
                              qc.invalidateQueries({ queryKey: ["calendar-bookings"] });
                              toast.success("Customer updated");
                            }}
                            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm focus:border-primary/60 outline-none"
                          >
                            <option value="">— Select customer —</option>
                            {(quickCustomers.data ?? []).map((c: any) => (
                              <option key={c.id} value={c.id}>
                                {`${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || c.email || c.phone || "Unnamed"}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="rounded-lg border border-border/60 bg-muted/20 p-3 space-y-2">
                        <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground flex items-center gap-1.5">
                          <BikeIcon className="h-3 w-3" /> Motorcycle assigned
                        </div>
                        <div className="text-sm font-semibold">{bike}</div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground shrink-0">Rego</span>
                          <input
                            key={`rego-${b.motorcycle_id}`}
                            type="text"
                            defaultValue={b.motorcycles?.rego ?? ""}
                            placeholder="Registration"
                            disabled={!b.motorcycle_id}
                            onBlur={async (e) => {
                              const v = e.target.value.trim();
                              if (!b.motorcycle_id) return;
                              if ((v || null) === (b.motorcycles?.rego ?? null)) return;
                              const { error } = await supabase
                                .from("motorcycles")
                                .update({ rego: v || null })
                                .eq("id", b.motorcycle_id);
                              if (error) return toast.error(error.message);
                              setSelectedBooking({
                                ...b,
                                motorcycles: { ...(b.motorcycles ?? {}), rego: v || null },
                              });
                              qc.invalidateQueries({ queryKey: ["calendar-bookings"] });
                              qc.invalidateQueries({ queryKey: ["edit-bikes", b.customer_id] });
                              toast.success("Rego updated");
                            }}
                            className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-sm uppercase focus:border-primary/60 outline-none disabled:opacity-50"
                          />
                        </div>
                        <div>
                          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Change motorcycle</div>
                          <select
                            value={b.motorcycle_id || ""}
                            disabled={!b.customer_id}
                            onChange={async (e) => {
                              const newBikeId = e.target.value || null;
                              if (newBikeId === b.motorcycle_id) return;
                              const { error } = await supabase
                                .from("bookings")
                                .update({ motorcycle_id: newBikeId ?? undefined })
                                .eq("id", b.id);
                              if (error) return toast.error(error.message);
                              const pick = (editBikes.data ?? []).find((x: any) => x.id === newBikeId);
                              setSelectedBooking({
                                ...b,
                                motorcycle_id: newBikeId,
                                motorcycles: pick
                                  ? { year: pick.year, make: pick.make, model: pick.model, rego: pick.rego }
                                  : null,
                              });
                              qc.invalidateQueries({ queryKey: ["calendar-bookings"] });
                              toast.success("Motorcycle updated");
                            }}
                            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm focus:border-primary/60 outline-none disabled:opacity-50"
                          >
                            <option value="">{b.customer_id ? "— Select motorcycle —" : "Pick a customer first"}</option>
                            {(editBikes.data ?? []).map((m: any) => (
                              <option key={m.id} value={m.id}>
                                {`${m.year ?? ""} ${m.make ?? ""} ${m.model ?? ""}`.trim()}
                                {m.rego ? ` · ${m.rego}` : ""}
                              </option>
                            ))}
                          </select>
                        </div>
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

                      <div>
                        <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-1">Notes</div>
                        <textarea
                          key={`notes-${b.id}`}
                          defaultValue={b.notes ?? ""}
                          rows={3}
                          placeholder="Add notes…"
                          onBlur={async (e) => {
                            const v = e.target.value;
                            if ((v ?? "") === (b.notes ?? "")) return;
                            const { error } = await supabase
                              .from("bookings")
                              .update({ notes: v || null })
                              .eq("id", b.id);
                            if (error) return toast.error(error.message);
                            setSelectedBooking({ ...b, notes: v || null });
                            qc.invalidateQueries({ queryKey: ["calendar-bookings"] });
                            toast.success("Notes updated");
                          }}
                          className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm focus:border-primary/60 outline-none resize-y"
                        />
                      </div>
                    </div>

                    <div className="flex flex-row flex-wrap gap-2 pt-2 border-t border-border/60">
                      <button
                        onClick={() => {
                          const id = b.id;
                          setSelectedBooking(null);
                          nav({ to: "/bookings/$bookingId", params: { bookingId: id } });
                        }}
                        className="flex-1 min-w-0 inline-flex items-center justify-center gap-1.5 rounded-lg border border-border px-2 py-2 text-xs font-semibold hover:border-primary/50 hover:bg-primary/5 transition-colors whitespace-nowrap"
                      >
                        <FileText className="h-3.5 w-3.5" /> Booking
                      </button>
                      {b.job_id ? (
                        <button
                          onClick={() => {
                            const jid = b.job_id;
                            setSelectedBooking(null);
                            nav({ to: "/jobs/$jobId", params: { jobId: jid } });
                          }}
                          className="flex-1 min-w-0 inline-flex items-center justify-center gap-1.5 rounded-lg red-surface px-2 py-2 text-xs font-semibold hover:scale-[1.02] transition-transform whitespace-nowrap"
                        >
                          <Wrench className="h-3.5 w-3.5" /> Open Job
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            const id = b.id;
                            setSelectedBooking(null);
                            nav({ to: "/bookings/$bookingId", params: { bookingId: id } });
                          }}
                          className="flex-1 min-w-0 inline-flex items-center justify-center gap-1.5 rounded-lg red-surface px-2 py-2 text-xs font-semibold hover:scale-[1.02] transition-transform whitespace-nowrap"
                        >
                          <Wrench className="h-3.5 w-3.5" /> Create Job
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setDeleteBooking(b);
                          setSelectedBooking(null);
                        }}
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-status-parts/50 text-status-parts px-2 py-2 text-xs font-semibold hover:bg-status-parts/10 transition-colors whitespace-nowrap"
                        aria-label="Delete booking"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>


                  </>
                );
              })()}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* QUICK-CREATE BOOKING POPUP */}
      <AnimatePresence>
        {quickSlot && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-md p-4"
            onClick={() => !creatingQuick && setQuickSlot(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.15 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl border border-border/60 bg-background/70 backdrop-blur-xl shadow-2xl p-5 space-y-4 relative"
            >
              <button
                onClick={() => !creatingQuick && setQuickSlot(null)}
                className="absolute top-3 right-3 grid h-8 w-8 place-items-center rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>

              <div>
                <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Quick booking</div>
                <div className="font-display text-lg font-bold">
                  {format(quickSlot.date, "EEE d MMM")}
                  <span className="ml-2 text-sm text-muted-foreground tabular-nums">
                    <Clock className="inline h-3.5 w-3.5 mr-1" />
                    {quickSlot.time}
                  </span>
                </div>
              </div>

              {/* Customer search */}
              <div className="relative">
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Search customer (name or phone)</label>
                <div className="mt-1 flex gap-2">
                  <input
                    value={qSearch}
                    onChange={(e) => {
                      setQSearch(e.target.value);
                      if (qCustomerId) setQCustomerId(null);
                    }}
                    placeholder="Start typing…"
                    className="flex-1 rounded-lg border border-border bg-background/60 px-3 py-2 text-sm focus:border-primary/60 focus:outline-none"
                  />
                  {qCustomerId && (
                    <button
                      type="button"
                      onClick={clearCustomerSelection}
                      className="rounded-lg border border-border px-2 text-xs font-semibold hover:border-primary/50 hover:bg-primary/5"
                    >
                      Clear
                    </button>
                  )}
                </div>
                {customerMatches.length > 0 && (
                  <div className="absolute z-10 left-0 right-0 mt-1 rounded-lg border border-border bg-popover shadow-xl max-h-56 overflow-y-auto">
                    {customerMatches.map((c: any) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => pickCustomer(c)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-primary/10 border-b border-border/40 last:border-b-0"
                      >
                        <div className="font-semibold">
                          {`${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || "—"}
                        </div>
                        {c.phone && (
                          <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                            <Phone className="h-3 w-3" /> {c.phone}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
                {qCustomerId && (quickBikes.data ?? []).length > 0 && (
                  <div className="mt-2">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Customer bikes</div>
                    <div className="flex flex-wrap gap-1.5">
                      {((quickBikes.data ?? []) as any[]).map((bk) => {
                        const active = qBikeId === bk.id;
                        const label = `${bk.year ?? ""} ${bk.make ?? ""} ${bk.model ?? ""}`.trim() || "—";
                        return (
                          <button
                            key={bk.id}
                            type="button"
                            onClick={() => (active ? (setQBikeId(null), setQBikeMake(""), setQBikeModel(""), setQBikeYear(""), setQBikeRego("")) : pickBike(bk))}
                            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                              active ? "border-primary bg-primary/15 text-primary" : "border-border hover:border-primary/50"
                            }`}
                          >
                            <BikeIcon className="h-3 w-3" />
                            {label}
                            {bk.rego && <span className="opacity-60">· {bk.rego}</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="col-span-1">
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground">First name *</label>
                  <input
                    value={qFirst}
                    onChange={(e) => setQFirst(e.target.value)}
                    className="w-full mt-1 rounded-lg border border-border bg-background/60 px-3 py-2 text-sm focus:border-primary/60 focus:outline-none"
                  />
                </div>
                <div className="col-span-1">
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Last name</label>
                  <input
                    value={qLast}
                    onChange={(e) => setQLast(e.target.value)}
                    className="w-full mt-1 rounded-lg border border-border bg-background/60 px-3 py-2 text-sm focus:border-primary/60 focus:outline-none"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" /> Phone</label>
                  <input
                    value={qPhone}
                    onChange={(e) => setQPhone(e.target.value)}
                    className="w-full mt-1 rounded-lg border border-border bg-background/60 px-3 py-2 text-sm focus:border-primary/60 focus:outline-none"
                  />
                </div>
                <div className="col-span-1">
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1"><BikeIcon className="h-3 w-3" /> Make *</label>
                  <input
                    list="bike-makes-list"
                    value={qBikeMake}
                    onChange={(e) => {
                      setQBikeMake(e.target.value);
                      // reset model if make changed
                      setQBikeModel("");
                    }}
                    placeholder="e.g. Yamaha"
                    className="w-full mt-1 rounded-lg border border-border bg-background/60 px-3 py-2 text-sm focus:border-primary/60 focus:outline-none"
                  />
                  <datalist id="bike-makes-list">
                    {BIKE_MAKE_NAMES.map((m) => (
                      <option key={m} value={m} />
                    ))}
                  </datalist>
                </div>
                <div className="col-span-1">
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Model *</label>
                  <input
                    list="bike-models-list"
                    value={qBikeModel}
                    onChange={(e) => setQBikeModel(e.target.value)}
                    placeholder="e.g. MT-07"
                    className="w-full mt-1 rounded-lg border border-border bg-background/60 px-3 py-2 text-sm focus:border-primary/60 focus:outline-none"
                  />
                  <datalist id="bike-models-list">
                    {(BIKE_MAKES[qBikeMake] ?? []).map((m) => (
                      <option key={m} value={m} />
                    ))}
                  </datalist>
                </div>
                <div className="col-span-1">
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Year</label>
                  <input
                    list="bike-years-list"
                    value={qBikeYear}
                    onChange={(e) => setQBikeYear(e.target.value)}
                    inputMode="numeric"
                    placeholder="e.g. 2022"
                    className="w-full mt-1 rounded-lg border border-border bg-background/60 px-3 py-2 text-sm focus:border-primary/60 focus:outline-none"
                  />
                  <datalist id="bike-years-list">
                    {BIKE_YEARS.map((y) => (
                      <option key={y} value={String(y)} />
                    ))}
                  </datalist>
                </div>
                <div className="col-span-1">
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Rego</label>
                  <input
                    value={qBikeRego}
                    onChange={(e) => setQBikeRego(e.target.value.toUpperCase())}
                    className="w-full mt-1 rounded-lg border border-border bg-background/60 px-3 py-2 text-sm uppercase tracking-wider focus:border-primary/60 focus:outline-none"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Est. hours</label>
                  <input
                    value={qEstHours}
                    onChange={(e) => setQEstHours(e.target.value)}
                    inputMode="decimal"
                    className="w-full mt-1 rounded-lg border border-border bg-background/60 px-3 py-2 text-sm focus:border-primary/60 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Service</label>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {SERVICE_TYPES.map((s) => {
                    const c = serviceColor(s);
                    const active = qService === s;
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setQService(s)}
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider ring-1 transition-all ${c.bg} ${c.ring} ${c.text} ${active ? "ring-2 scale-[1.03]" : "opacity-75 hover:opacity-100"}`}
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-current" />
                        {s}
                      </button>
                    );
                  })}
                </div>
                {qService === "Other" && (
                  <div className="mt-2">
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Other service details</label>
                    <textarea
                      value={qServiceOther}
                      onChange={(e) => setQServiceOther(e.target.value)}
                      placeholder="Describe the service..."
                      className="mt-1 w-full min-h-[64px] rounded-lg border border-border bg-background/60 px-3 py-2 text-sm focus:border-primary/60 focus:outline-none resize-y"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="h-4 w-4 accent-primary" checked={qWofNeeded} onChange={(e) => setQWofNeeded(e.target.checked)} />
                  <span className="text-sm font-semibold">📋 Needs WOF</span>
                </label>
                {qWofNeeded && (
                  <div className="mt-2 rounded-xl border border-primary/40 bg-primary/5 p-3">
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Current WOF expiry (optional)</label>
                    <input
                      type="date"
                      value={qWofExpiry}
                      onChange={(e) => setQWofExpiry(e.target.value)}
                      className="w-full mt-1 rounded-lg border border-border bg-background/60 px-3 py-2 text-sm"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="h-4 w-4 accent-amber-500" checked={qLoanBike} onChange={(e) => setQLoanBike(e.target.checked)} />
                  <span className="text-sm font-semibold">🏍️ Customer needs a loan bike</span>
                </label>
                {qLoanBike && (
                  <div className="mt-2 space-y-2 rounded-xl border border-amber-400/40 bg-amber-400/5 p-3">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Assign loan bike</div>
                    <div className="grid gap-1.5">
                      {(qLoanBikesQ.data ?? []).map((lb: any) => {
                        const outWith = (qActiveLoansQ.data ?? []).find((a: any) => a.loan_bike_id === lb.id);
                        const busy = !!outWith;
                        const active = qLoanBikeId === lb.id;
                        return (
                          <button
                            key={lb.id}
                            type="button"
                            onClick={() => setQLoanBikeId(active ? null : lb.id)}
                            className={`rounded-lg border p-2 text-left flex items-center gap-2 ${
                              active ? "border-amber-400 bg-amber-400/10" : busy ? "border-destructive/40 opacity-70" : "border-border"
                            }`}
                          >
                            <span className="flex-1">
                              <span className="block text-sm font-semibold">{lb.name}</span>
                              <span className="block text-[11px] text-muted-foreground">
                                {lb.current_km?.toLocaleString?.() ?? 0} km
                                {busy && outWith?.customers && ` · Out with ${outWith.customers.first_name} ${outWith.customers.last_name}`}
                                {busy && outWith?.loan_bike_expected_return && ` · back ${outWith.loan_bike_expected_return}`}
                              </span>
                            </span>
                            {busy && <span className="rounded-full bg-destructive/15 text-destructive px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">Out</span>}
                          </button>
                        );
                      })}
                      {(qLoanBikesQ.data ?? []).length === 0 && (
                        <div className="text-xs text-muted-foreground">No loan bikes registered.</div>
                      )}
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Expected return</label>
                      <input
                        type="date"
                        value={qLoanBikeReturn}
                        onChange={(e) => setQLoanBikeReturn(e.target.value)}
                        className="w-full mt-1 rounded-lg border border-border bg-background/60 px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                )}
              </div>



              <div className="flex gap-2 pt-2 border-t border-border/60">
                <button
                  onClick={() => !creatingQuick && setQuickSlot(null)}
                  className="flex-1 rounded-lg border border-border px-3 py-2 text-sm font-semibold hover:border-primary/50 hover:bg-primary/5 transition-colors"
                >
                  Cancel
                </button>
                <button
                  disabled={creatingQuick}
                  onClick={createQuickBooking}
                  className="flex-1 rounded-lg red-surface px-3 py-2 text-sm font-semibold hover:scale-[1.02] transition-transform disabled:opacity-50 disabled:hover:scale-100"
                >
                  {creatingQuick ? "Creating…" : "Create booking"}
                </button>
              </div>
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
                      ? (`${deleteBooking.customers.first_name ?? ""} ${deleteBooking.customers.last_name ?? ""}`.trim() || "this customer")
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
