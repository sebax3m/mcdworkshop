import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { STATUS_META, STATUS_ORDER, fullBike } from "@/lib/format";
import { Plus, Search } from "lucide-react";
import { useCurrentUser } from "@/hooks/use-current-user";

export const Route = createFileRoute("/_authenticated/jobs/")({
  component: JobsList,
});

function JobsList() {
  const { isAdmin } = useCurrentUser();
  const [filter, setFilter] = useState<string>("active");
  const [search, setSearch] = useState("");

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ["jobs", filter],
    queryFn: async () => {
      let q = supabase
        .from("jobs")
        .select("id, job_number, title, status, technician_id, customers(first_name,last_name), motorcycles(year,make,model,rego)")
        .order("created_at", { ascending: false });
      if (filter === "active") q = q.in("status", ["new", "assigned", "in_progress", "waiting_parts", "ready_for_pickup"]);
      else if (filter !== "all") q = q.eq("status", filter as any);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = jobs.filter((j: any) => {
    if (!search) return true;
    const hay = `${j.job_number} ${j.title} ${j.customers?.first_name ?? ""} ${j.customers?.last_name ?? ""} ${j.motorcycles?.make ?? ""} ${j.motorcycles?.model ?? ""} ${j.motorcycles?.rego ?? ""}`.toLowerCase();
    return hay.includes(search.toLowerCase());
  });

  return (
    <div className="space-y-5">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 items-center">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Workshop</div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold truncate">Job Board</h1>
        </div>
        {isAdmin && (
          <Link to="/jobs/new" className="shrink-0 inline-flex items-center gap-1.5 rounded-lg gold-surface px-3 py-2 text-sm font-semibold">
            <Plus className="h-4 w-4" /> New
          </Link>
        )}
      </header>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by customer, bike, rego, #"
          className="w-full rounded-xl bg-card border border-border pl-10 pr-3 py-3 text-sm focus:outline-none focus:border-primary/60"
        />
      </div>

      <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-1 scrollbar-none">
        {[
          { id: "active", label: "Active" },
          { id: "all", label: "All" },
          ...STATUS_ORDER.map((s) => ({ id: s, label: STATUS_META[s].label })),
        ].map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider border transition-colors ${
              filter === f.id ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="card-surface p-8 text-center text-sm text-muted-foreground">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="card-surface p-10 text-center">
          <p className="text-muted-foreground">No jobs match.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((j: any) => {
            const meta = STATUS_META[j.status];
            return (
              <Link
                key={j.id}
                to="/jobs/$jobId"
                params={{ jobId: j.id }}
                className="card-surface p-4 flex items-center gap-3 hover:border-primary/40 transition-colors"
              >
                <div className="w-12 shrink-0 text-center">
                  <div className="text-[10px] uppercase text-muted-foreground">Job</div>
                  <div className="font-display text-lg font-bold tabular-nums">#{j.job_number}</div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold truncate">{j.title}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {j.customers ? `${j.customers.first_name} ${j.customers.last_name}` : "—"} · {j.motorcycles ? fullBike(j.motorcycles) : "—"}
                    {j.motorcycles?.rego ? ` · ${j.motorcycles.rego}` : ""}
                  </div>
                </div>
                <span className={`shrink-0 inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-wider ${meta.cls}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                  {meta.label}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}