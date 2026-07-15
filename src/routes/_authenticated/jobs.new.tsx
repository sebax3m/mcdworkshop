/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowLeft,
  ChevronRight,
  Search,
  Bike as BikeIcon,
  Calendar as CalendarIcon,
  Clock,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { fullBike, initials } from "@/lib/format";
import { format } from "date-fns";
import { useCurrentUser } from "@/hooks/use-current-user";

export const Route = createFileRoute("/_authenticated/jobs/new")({
  component: NewJob,
});

function NewJob() {
  const nav = useNavigate();
  const { isAdmin, loading: userLoading } = useCurrentUser();
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const bookings = useQuery({
    queryKey: ["bookings-pending"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("*, customers(first_name,last_name,phone), motorcycles(year,make,model,rego)")
        .is("job_id", null)
        .order("scheduled_date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const filtered = useMemo(() => {
    const s = search.toLowerCase().trim();
    if (!s) return bookings.data ?? [];
    return (bookings.data ?? []).filter((b) => {
      const cust = b.customers ? `${b.customers.first_name} ${b.customers.last_name}` : "";
      const bike = b.motorcycles
        ? `${b.motorcycles.make} ${b.motorcycles.model} ${b.motorcycles.rego ?? ""}`
        : "";
      return `${cust} ${bike} ${b.service_type}`.toLowerCase().includes(s);
    });
  }, [bookings.data, search]);

  if (userLoading) {
    return <div className="card-surface p-8 text-center text-muted-foreground">Loading…</div>;
  }

  if (!isAdmin) {
    return (
      <div className="card-surface p-8 text-center">
        <p className="text-muted-foreground">Only admins can create jobs.</p>
        <Link to="/jobs" className="text-primary text-sm font-semibold mt-3 inline-block">
          Back to jobs
        </Link>
      </div>
    );
  }

  async function allocate(b: any) {
    setBusyId(b.id);
    try {
      const { data: tmpl } = await supabase
        .from("service_templates")
        .select("*")
        .ilike("name", `%${(b.service_type ?? "").split(" ")[0]}%`)
        .limit(1)
        .maybeSingle();
      const { data: job, error } = await supabase
        .from("jobs")
        .insert({
          customer_id: b.customer_id,
          motorcycle_id: b.motorcycle_id,
          template_id: tmpl?.id ?? null,
          technician_id: b.assigned_tech_id,
          assigned_tech_id: b.assigned_tech_id,
          title: b.service_type,
          description: tmpl?.description ?? null,
          complaint: b.complaints,
          estimated_hours: b.estimated_hours,
          status: b.assigned_tech_id ? "assigned" : "new",
          scheduled_at: b.scheduled_date,
        })
        .select("id")
        .single();
      if (error) throw error;
      if (tmpl?.tasks) {
        const tasks = (tmpl.tasks as any[]).map((t: any, i: number) => ({
          job_id: job.id,
          label: t.label,
          sort_order: i,
        }));
        if (tasks.length) await supabase.from("job_tasks").insert(tasks);
      }
      await supabase
        .from("bookings")
        .update({ job_id: job.id, status: "checked_in" })
        .eq("id", b.id);
      toast.success("Job card allocated");
      nav({ to: "/jobs/$jobId", params: { jobId: job.id } });
    } catch (err: any) {
      toast.error(err.message ?? "Failed to allocate job");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      <header className="flex items-center gap-3">
        <Link
          to="/jobs"
          className="grid h-9 w-9 place-items-center rounded-lg border border-border"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
            Allocate Job Card
          </div>
          <h1 className="font-display text-2xl font-bold">Pick a Booking</h1>
        </div>
        <Link
          to="/bookings/new"
          className="hidden sm:inline-flex items-center gap-2 rounded-xl border border-border px-3 h-9 text-xs font-semibold hover:border-primary/50"
        >
          <Plus className="h-3.5 w-3.5" /> New booking
        </Link>
      </header>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by customer, bike, or service"
          className="w-full rounded-xl bg-card border border-border pl-10 pr-3 py-3 text-sm"
        />
      </div>

      {bookings.isLoading ? (
        <div className="card-surface p-8 text-center text-sm text-muted-foreground">
          Loading bookings…
        </div>
      ) : filtered.length === 0 ? (
        <div className="card-surface p-8 text-center space-y-3">
          <div className="text-sm text-muted-foreground">No pending bookings to allocate.</div>
          <Link
            to="/bookings/new"
            className="inline-flex items-center gap-2 rounded-xl gold-surface px-4 h-10 text-sm font-bold"
          >
            <Plus className="h-4 w-4" /> Create booking
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((b, i) => {
            const cust = b.customers ? `${b.customers.first_name} ${b.customers.last_name}` : "—";
            const busy = busyId === b.id;
            return (
              <motion.button
                key={b.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                onClick={() => allocate(b)}
                disabled={busy}
                className="w-full card-surface p-4 text-left hover:border-primary/50 transition-colors flex items-center gap-3 disabled:opacity-60"
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-muted font-semibold text-sm">
                  {initials(cust)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 text-xs text-muted-foreground">
                    <CalendarIcon className="h-3 w-3" />
                    {format(new Date(b.scheduled_date), "EEE d MMM")}
                    {b.drop_off_time && (
                      <>
                        <Clock className="h-3 w-3 ml-1" />
                        {b.drop_off_time.slice(0, 5)}
                      </>
                    )}
                    <span className="ml-1 rounded-full bg-primary/10 text-primary px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
                      {b.service_type}
                    </span>
                  </span>
                  <span className="block font-semibold truncate mt-0.5">{cust}</span>
                  <span className="block text-xs text-muted-foreground truncate flex items-center gap-1.5">
                    <BikeIcon className="h-3 w-3" /> {fullBike(b.motorcycles)}
                    {b.motorcycles?.rego ? ` · ${b.motorcycles.rego}` : ""}
                  </span>
                </span>
                <span className="text-xs font-bold text-primary whitespace-nowrap flex items-center gap-1">
                  {busy ? "Allocating…" : "Allocate"} <ChevronRight className="h-4 w-4" />
                </span>
              </motion.button>
            );
          })}
        </div>
      )}
    </div>
  );
}
