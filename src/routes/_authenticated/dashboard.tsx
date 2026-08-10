/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { addDays, format, isToday } from "date-fns";
import { TechnicianLoad } from "@/components/booking/TechnicianLoad";
import { supabase } from "@/integrations/supabase/client";
import { Bike, Wrench, Clock, AlertCircle, CheckCircle2, Plus, CalendarDays, Search } from "lucide-react";
import { useCurrentUser } from "@/hooks/use-current-user";
import { BookInCard, CapacityBadge } from "@/components/booking/BookInCard";
import { useWorkshopCapacity } from "@/hooks/useWorkshopCapacity";
import { TechnicianDashboard } from "./my-work";


export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Today in the workshop — Motorcycle Doctors" },
      {
        name: "description",
        content:
          "Today's motorcycle book-ins, workshop capacity for the week ahead and active jobs at a glance.",
      },
      { property: "og:title", content: "Today in the workshop — Motorcycle Doctors" },
      {
        property: "og:description",
        content: "Today's book-ins, workshop load for the week ahead and active jobs.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { fullName, isAdmin, loading } = useCurrentUser();
  // Technicians get their own focused dashboard (only their assigned work).
  if (!loading && !isAdmin) return <TechnicianDashboard />;

  const counts = useQuery({
    queryKey: ["dashboard-counts"],
    queryFn: async () => {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const todayKey = new Date().toISOString().slice(0, 10);
      const [todayJobs, inShop, waitingParts, ready, awaiting] = await Promise.all([
        supabase
          .from("jobs")
          .select("id", { count: "exact", head: true })
          .gte("created_at", startOfDay.toISOString()),
        supabase
          .from("jobs")
          .select("id", { count: "exact", head: true })
          .in("status", ["new", "assigned", "in_progress", "waiting_parts", "ready_for_pickup"]),
        supabase
          .from("jobs")
          .select("id", { count: "exact", head: true })
          .eq("status", "waiting_parts"),
        supabase
          .from("jobs")
          .select("id", { count: "exact", head: true })
          .eq("status", "ready_for_pickup"),
        supabase
          .from("bookings")
          .select("id", { count: "exact", head: true })
          .lte("scheduled_date", todayKey)
          .is("job_id", null)
          .neq("status", "cancelled"),
      ]);
      const { data: clockData } = await supabase
        .from("clock_events")
        .select("user_id, event_type, occurred_at")
        .order("occurred_at", { ascending: false })
        .limit(200);
      const latestByUser = new Map<string, string>();
      (clockData ?? []).forEach((e) => {
        if (!latestByUser.has(e.user_id)) latestByUser.set(e.user_id, e.event_type);
      });
      const onClock = [...latestByUser.values()].filter(
        (t) => t === "clock_in" || t === "break_end",
      ).length;
      return {
        jobsToday: todayJobs.count ?? 0,
        bikesIn: inShop.count ?? 0,
        waitingParts: waitingParts.count ?? 0,
        ready: ready.count ?? 0,
        awaiting: awaiting.count ?? 0,
        activeTechs: onClock,
      };
    },
  });

  return (
    <div className="space-y-6">
      <TodayBookIns />

      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Today</div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold mt-1">
            Hey {fullName.split(" ")[0] || "there"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Here's what's moving in the shop.</p>
        </div>
        {isAdmin && (
          <Link
            to="/jobs/new"
            className="sm:hidden inline-flex items-center gap-1.5 rounded-lg gold-surface px-3 py-2 text-sm font-semibold shrink-0"
          >
            <Plus className="h-4 w-4" /> Job
          </Link>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <KpiCard
          label="Jobs Today"
          value={counts.data?.jobsToday ?? 0}
          icon={Wrench}
          accent="primary"
        />
        <KpiCard
          label="Bikes In Shop"
          value={counts.data?.bikesIn ?? 0}
          icon={Bike}
          accent="blue"
        />
        <KpiCard
          label="Waiting Parts"
          value={counts.data?.waitingParts ?? 0}
          icon={AlertCircle}
          accent="red"
        />
        <KpiCard
          label="Ready For Pickup"
          value={counts.data?.ready ?? 0}
          icon={CheckCircle2}
          accent="green"
        />
        <KpiCard
          label="Awaiting Assessment"
          value={counts.data?.awaiting ?? 0}
          icon={Search}
          accent="blue"
        />
        <KpiCard
          label="Active Techs"
          value={counts.data?.activeTechs ?? 0}
          icon={Clock}
          accent="primary"
        />
      </div>

    </div>
  );
}

function KpiCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: number;
  icon: any;
  accent: "primary" | "blue" | "red" | "green";
}) {
  const accentCls = {
    primary: "text-primary",
    blue: "text-status-new",
    red: "text-status-parts",
    green: "text-status-ready",
  }[accent];
  return (
    <div className="card-surface p-4">
      <div className="flex items-center justify-between">
        <span className="text-[0.625rem] uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <Icon className={`h-4 w-4 ${accentCls}`} />
      </div>
      <div className={`mt-2 font-display text-3xl font-bold tabular-nums ${accentCls}`}>
        {value}
      </div>
    </div>
  );
}

/**
 * Today panel: motorcycles booked in today + the workshop load for the
 * next 7 days, driven by the configurable daily book-in capacity.
 */
function TodayBookIns() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [dragId, setDragId] = useState<string | null>(null);
  const { capacityFor } = useWorkshopCapacity();
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const from = format(days[0], "yyyy-MM-dd");
  const to = format(days[6], "yyyy-MM-dd");

  const q = useQuery({
    queryKey: ["today-bookings", from, to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select(
          "id, scheduled_date, service_type, service_type_other, status, confirmed, bike_arrived, loan_bike, assigned_tech_id, rego, customers(first_name,last_name,phone), motorcycles(make,model,year,rego,photos)",
        )
        .gte("scheduled_date", from)
        .lte("scheduled_date", to)
        .order("scheduled_date", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const rows = (q.data ?? []) as any[];
  const todayKey = format(start, "yyyy-MM-dd");
  const todays = rows.filter((b) => b.scheduled_date === todayKey);
  const assignedToday = todays.filter((b: any) => b.assigned_tech_id);

  async function assignTech(bookingId: string, techId: string | null) {
    const { error } = await supabase
      .from("bookings")
      .update({ assigned_tech_id: techId })
      .eq("id", bookingId);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(techId ? "Assigned" : "Unassigned");
    qc.invalidateQueries({ queryKey: ["today-bookings"] });
  }

  const arrived = todays.filter((b) => b.bike_arrived).length;
  const cap = capacityFor(start);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="font-display text-lg font-semibold flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-primary" />
          Booked in today
          <span className="text-sm font-normal text-muted-foreground">
            {arrived}/{todays.length} arrived
          </span>
        </h2>
        <div className="flex items-center gap-3">
          <CapacityBadge booked={todays.length} capacity={cap} />
          <Link
            to="/book-ins/$date"
            params={{ date: todayKey }}
            className="text-xs uppercase tracking-wider text-muted-foreground hover:text-primary"
          >
            Day view →
          </Link>
        </div>
      </div>

      {q.isLoading ? (
        <div className="card-surface p-6 text-center text-sm text-muted-foreground">Loading…</div>
      ) : todays.length === 0 ? (
        <div className="card-surface p-6 text-center text-sm text-muted-foreground">
          No motorcycles booked in today.
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {todays.map((b) => (
            <BookInCard
              key={b.id}
              booking={b}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData("text/plain", b.id);
                e.dataTransfer.effectAllowed = "move";
                setDragId(b.id);
              }}
              onDragEnd={() => setDragId(null)}
              className={dragId === b.id ? "opacity-50" : undefined}
              onClick={() => nav({ to: "/book-ins/$date", params: { date: todayKey } })}
            />
          ))}
        </div>
      )}

      {/* Assigned jobs today */}
      {assignedToday.length > 0 && (
        <div className="card-surface p-3 space-y-2">
          <div className="text-[0.625rem] font-bold uppercase tracking-wider text-muted-foreground">
            Assigned today · {assignedToday.length}
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {assignedToday.map((b: any) => (
              <BookInCard
                key={b.id}
                booking={b}
                onClick={() => nav({ to: "/bookings/$bookingId", params: { bookingId: b.id } })}
              />
            ))}
          </div>
        </div>
      )}

      {/* Active techs — drop a book-in on a name to assign it */}
      <TechnicianLoad
        title="Active techs"
        bookings={todays}
        droppable
        onAssign={assignTech}
        onOpenBooking={(id) => nav({ to: "/bookings/$bookingId", params: { bookingId: id } })}
      />

      {/* Next 7 days load */}
      <div className="card-surface p-3">
        <div className="text-[0.625rem] font-bold uppercase tracking-wider text-muted-foreground mb-2">
          Workshop load — next 7 days
        </div>
        <div className="grid grid-cols-7 gap-2">
          {days.map((d) => {
            const key = format(d, "yyyy-MM-dd");
            const count = rows.filter((b) => b.scheduled_date === key).length;
            const c = capacityFor(d);
            const pct = c > 0 ? Math.min(100, (count / c) * 100) : count ? 100 : 0;
            const full = c > 0 && count >= c;
            return (
              <Link
                key={key}
                to="/book-ins/$date"
                params={{ date: key }}
                className={`rounded-lg border p-2 text-center transition-colors hover:border-primary/50 ${
                  isToday(d) ? "border-primary/50 bg-primary/5" : "border-border"
                }`}
              >
                <div className="text-[0.5625rem] font-bold uppercase tracking-wider text-muted-foreground">
                  {format(d, "EEE")}
                </div>
                <div className="font-display text-base font-bold tabular-nums leading-tight">
                  {count}
                  <span className="text-[0.625rem] text-muted-foreground">/{c}</span>
                </div>
                <div className="mt-1 h-1 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full ${full ? "bg-amber-500" : "bg-primary"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
