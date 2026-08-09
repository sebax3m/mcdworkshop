/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { addDays, format, isToday } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { STATUS_META, fullBike, initials } from "@/lib/format";
import { Bike, Wrench, Clock, AlertCircle, CheckCircle2, Plus, CalendarDays } from "lucide-react";
import { useCurrentUser } from "@/hooks/use-current-user";
import { BookInCard, CapacityBadge } from "@/components/booking/BookInCard";
import { useWorkshopCapacity } from "@/hooks/useWorkshopCapacity";

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
  const { fullName, isAdmin } = useCurrentUser();
  const today = useQuery({
    queryKey: ["dashboard-jobs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("jobs")
        .select(
          "id, job_number, title, status, technician_id, customers(first_name,last_name), motorcycles(year,make,model)",
        )
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      const rows = data ?? [];
      const techIds = [...new Set(rows.map((r: any) => r.technician_id).filter(Boolean))];
      const techMap = new Map<string, string>();
      if (techIds.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", techIds);
        (profs ?? []).forEach((p) => techMap.set(p.id, p.full_name));
      }
      return rows.map((r: any) => ({
        ...r,
        technician_name: r.technician_id ? techMap.get(r.technician_id) : null,
      }));
    },
  });

  const counts = useQuery({
    queryKey: ["dashboard-counts"],
    queryFn: async () => {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const [todayJobs, inShop, waitingParts, ready] = await Promise.all([
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
        activeTechs: onClock,
      };
    },
  });

  const jobs = today.data ?? [];

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

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
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
          label="Active Techs"
          value={counts.data?.activeTechs ?? 0}
          icon={Clock}
          accent="primary"
        />
      </div>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-lg font-semibold">Active Jobs</h2>
          <Link
            to="/jobs"
            className="text-xs uppercase tracking-wider text-muted-foreground hover:text-primary"
          >
            View all →
          </Link>
        </div>
        {today.isLoading ? (
          <div className="card-surface p-8 text-center text-sm text-muted-foreground">Loading…</div>
        ) : jobs.length === 0 ? (
          <EmptyJobs />
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {jobs.map((j: any) => (
              <JobCard key={j.id} job={j} />
            ))}
          </div>
        )}
      </section>
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
        <span className="text-[0.625rem] uppercase tracking-wider text-muted-foreground">{label}</span>
        <Icon className={`h-4 w-4 ${accentCls}`} />
      </div>
      <div className={`mt-2 font-display text-3xl font-bold tabular-nums ${accentCls}`}>
        {value}
      </div>
    </div>
  );
}

function JobCard({ job }: { job: any }) {
  const meta = STATUS_META[job.status];
  const customer = job.customers
    ? `${job.customers.first_name} ${job.customers.last_name}`.trim()
    : "—";
  const bike = job.motorcycles ? fullBike(job.motorcycles) : "—";
  const tech = job.technician_name;
  return (
    <Link
      to="/jobs/$jobId"
      params={{ jobId: job.id }}
      className="card-surface p-4 hover:border-primary/40 transition-colors block"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[0.625rem] uppercase tracking-wider text-muted-foreground">
            Job #{job.job_number}
          </div>
          <div className="font-semibold truncate mt-0.5">{job.title}</div>
          <div className="text-sm text-muted-foreground truncate">{customer}</div>
          <div className="text-xs text-muted-foreground truncate mt-0.5">{bike}</div>
        </div>
        <span
          className={`shrink-0 inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[0.625rem] font-semibold uppercase tracking-wider ${meta.cls}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
          {meta.label}
        </span>
      </div>
      <div className="mt-3 flex items-center justify-between text-xs">
        {tech ? (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-muted text-[0.625rem] font-semibold text-foreground">
              {initials(tech)}
            </span>
            {tech}
          </div>
        ) : (
          <span className="text-muted-foreground italic">Unassigned</span>
        )}
      </div>
    </Link>
  );
}

function EmptyJobs() {
  return (
    <div className="card-surface p-10 text-center">
      <div className="mx-auto h-12 w-12 grid place-items-center rounded-xl bg-muted">
        <Wrench className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="font-display text-lg font-semibold mt-4">No jobs yet</h3>
      <p className="text-sm text-muted-foreground mt-1">
        Create your first job card in under 15 seconds.
      </p>
      <Link
        to="/jobs/new"
        className="inline-flex items-center gap-1.5 rounded-lg gold-surface px-4 py-2 text-sm font-semibold mt-4"
      >
        <Plus className="h-4 w-4" /> New job
      </Link>
    </div>
  );
}

/**
 * Today panel: motorcycles booked in today + the workshop load for the
 * next 7 days, driven by the configurable daily book-in capacity.
 */
function TodayBookIns() {
  const nav = useNavigate();
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
          "id, scheduled_date, service_type, service_type_other, status, confirmed, bike_arrived, loan_bike, customers(first_name,last_name,phone), motorcycles(make,model,year,rego,photos)",
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
              onClick={() => nav({ to: "/book-ins/$date", params: { date: todayKey } })}
            />
          ))}
        </div>
      )}

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
