import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { STATUS_META, fullBike, initials } from "@/lib/format";
import { Bike, Wrench, Clock, AlertCircle, CheckCircle2, Plus } from "lucide-react";
import { useCurrentUser } from "@/hooks/use-current-user";

export const Route = createFileRoute("/_authenticated/dashboard")({
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
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
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
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Job #{job.job_number}
          </div>
          <div className="font-semibold truncate mt-0.5">{job.title}</div>
          <div className="text-sm text-muted-foreground truncate">{customer}</div>
          <div className="text-xs text-muted-foreground truncate mt-0.5">{bike}</div>
        </div>
        <span
          className={`shrink-0 inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-wider ${meta.cls}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
          {meta.label}
        </span>
      </div>
      <div className="mt-3 flex items-center justify-between text-xs">
        {tech ? (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-muted text-[10px] font-semibold text-foreground">
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
