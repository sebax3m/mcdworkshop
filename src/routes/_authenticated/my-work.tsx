/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Bike, Wrench, CalendarDays, CheckCircle2, AlertCircle, Timer } from "lucide-react";
import { useCurrentUser } from "@/hooks/use-current-user";
import { BookInCard } from "@/components/booking/BookInCard";
import { displayCustomerName } from "@/lib/display";
import { fullBike } from "@/lib/format";

/**
 * Technician home: everything a tech needs on sign-in — the book-ins assigned
 * to them today, what is coming up, and their open job cards.
 */
export function TechnicianDashboard() {
  const nav = useNavigate();
  const { user, fullName } = useCurrentUser();
  const userId = user?.id ?? null;
  const todayKey = format(new Date(), "yyyy-MM-dd");

  const bookings = useQuery({
    enabled: !!userId,
    queryKey: ["my-bookings", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select(
          "id, scheduled_date, service_type, service_type_other, status, confirmed, bike_arrived, loan_bike, assigned_tech_id, job_id, rego, customers(first_name,last_name,phone), motorcycles(make,model,year,rego,photos), jobs(id,status)",
        )
        .eq("assigned_tech_id", userId!)
        .gte("scheduled_date", todayKey)
        .neq("status", "cancelled")
        .order("scheduled_date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const jobs = useQuery({
    enabled: !!userId,
    queryKey: ["my-jobs", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("jobs")
        .select(
          "id, job_number, title, status, scheduled_for, customers(first_name,last_name), motorcycles(make,model,year,rego)",
        )
        .or(`assigned_tech_id.eq.${userId},technician_id.eq.${userId}`)
        .neq("status", "completed")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const all = bookings.data ?? [];
  const today = all.filter((b) => b.scheduled_date === todayKey);
  const upcoming = all.filter((b) => b.scheduled_date > todayKey);
  const myJobs = jobs.data ?? [];
  const waitingParts = myJobs.filter((j) => j.status === "waiting_parts").length;
  const ready = myJobs.filter((j) => j.status === "ready_for_pickup").length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
            My workshop
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold mt-1">
            Hey {fullName.split(" ")[0] || "there"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Everything assigned to you, in one place.
          </p>
        </div>
        <Link
          to="/clock"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-semibold hover:border-primary/50"
        >
          <Timer className="h-4 w-4 text-status-ready" /> Clock
        </Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <TechKpi label="Assigned Today" value={today.length} icon={CalendarDays} accent="primary" />
        <TechKpi label="My Open Jobs" value={myJobs.length} icon={Wrench} accent="blue" />
        <TechKpi label="Waiting Parts" value={waitingParts} icon={AlertCircle} accent="red" />
        <TechKpi label="Ready For Pickup" value={ready} icon={CheckCircle2} accent="green" />
      </div>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold flex items-center gap-2">
          <Bike className="h-4 w-4 text-primary" /> Assigned to me today
        </h2>
        {bookings.isLoading ? (
          <div className="card-surface p-6 text-center text-sm text-muted-foreground">Loading…</div>
        ) : today.length === 0 ? (
          <div className="card-surface p-6 text-center text-sm text-muted-foreground">
            Nothing assigned to you today.
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {today.map((b) => (
              <BookInCard
                key={b.id}
                booking={b}
                onClick={() => nav({ to: "/bookings/$bookingId", params: { bookingId: b.id } })}
              />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold flex items-center gap-2">
          <Wrench className="h-4 w-4 text-status-parts" /> My job cards
        </h2>
        {myJobs.length === 0 ? (
          <div className="card-surface p-6 text-center text-sm text-muted-foreground">
            No open job cards assigned to you.
          </div>
        ) : (
          <div className="card-surface divide-y divide-border">
            {myJobs.map((j) => (
              <Link
                key={j.id}
                to="/jobs/$jobId"
                params={{ jobId: j.id }}
                className="flex items-center gap-3 p-3 hover:bg-muted/40 transition-colors"
              >
                <span className="font-display text-sm font-bold tabular-nums text-muted-foreground w-12 shrink-0">
                  #{j.job_number}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold truncate">{j.title}</span>
                  <span className="block text-xs text-muted-foreground truncate">
                    {displayCustomerName(j.customers)} · {fullBike(j.motorcycles)}
                  </span>
                </span>
                <span className="text-[0.625rem] font-bold uppercase tracking-wider text-muted-foreground shrink-0">
                  {String(j.status).replace(/_/g, " ")}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {upcoming.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-lg font-semibold flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-status-new" /> Coming up
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {upcoming.slice(0, 12).map((b) => (
              <BookInCard
                key={b.id}
                booking={b}
                onClick={() => nav({ to: "/bookings/$bookingId", params: { bookingId: b.id } })}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function TechKpi({
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
      <div className={`mt-2 font-display text-3xl font-bold tabular-nums ${accentCls}`}>{value}</div>
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/my-work")({
  head: () => ({
    meta: [
      { title: "My work — Motorcycle Doctors" },
      {
        name: "description",
        content: "Your assigned motorcycle book-ins and open job cards for today at the workshop.",
      },
      { property: "og:title", content: "My work — Motorcycle Doctors" },
      {
        property: "og:description",
        content: "Your assigned book-ins and open job cards at Motorcycle Doctors.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TechnicianDashboard,
});
