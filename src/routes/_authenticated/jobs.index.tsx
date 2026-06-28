import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { STATUS_META, STATUS_ORDER, fullBike } from "@/lib/format";
import { Plus, Search, Trash2, X } from "lucide-react";
import { useCurrentUser } from "@/hooks/use-current-user";
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

export const Route = createFileRoute("/_authenticated/jobs/")({
  component: JobsList,
});

function JobsList() {
  const { isAdmin } = useCurrentUser();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<string>("active");
  const [search, setSearch] = useState("");
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteJobId, setDeleteJobId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

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

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const exitSelect = () => {
    setSelectMode(false);
    setSelected(new Set());
  };

  const handleDelete = async () => {
    setDeleting(true);
    const ids = deleteJobId ? [deleteJobId] : Array.from(selected);
    const { error } = await supabase.from("jobs").delete().in("id", ids);
    setDeleting(false);
    setConfirmOpen(false);
    setDeleteJobId(null);
    if (error) {
      toast.error(`Failed to delete: ${error.message}`);
      return;
    }
    toast.success(`Deleted ${ids.length} job${ids.length === 1 ? "" : "s"}`);
    exitSelect();
    qc.invalidateQueries({ queryKey: ["jobs"] });
  };

  return (
    <div className="space-y-5">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 items-center">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Workshop</div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold truncate">Job Board</h1>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isAdmin && (
            selectMode ? (
              <>
                <button
                  onClick={() => setConfirmOpen(true)}
                  disabled={selected.size === 0}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-destructive text-destructive-foreground px-3 py-2 text-sm font-semibold disabled:opacity-40"
                >
                  <Trash2 className="h-4 w-4" /> Delete{selected.size > 0 ? ` (${selected.size})` : ""}
                </button>
                <button
                  onClick={exitSelect}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-semibold"
                >
                  <X className="h-4 w-4" /> Cancel
                </button>
              </>
            ) : (
              <button
                onClick={() => setSelectMode(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-semibold"
              >
                Select
              </button>
            )
          )}
          {isAdmin && !selectMode && (
            <Link to="/jobs/new" className="inline-flex items-center gap-1.5 rounded-lg gold-surface px-3 py-2 text-sm font-semibold">
              <Plus className="h-4 w-4" /> New
            </Link>
          )}
        </div>
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
            const isSelected = selected.has(j.id);
            const baseRowClass = `card-surface p-4 flex items-center gap-3 transition-colors ${
              selectMode
                ? isSelected
                  ? "border-primary/60 bg-primary/5 cursor-pointer"
                  : "hover:border-primary/40 cursor-pointer"
                : "hover:border-primary/40"
            }`;
            const inner = (
              <>
                {selectMode && (
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggle(j.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="h-5 w-5 shrink-0 accent-primary"
                  />
                )}
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
              </>
            );
            if (selectMode) {
              return (
                <div key={j.id} className={baseRowClass} onClick={() => toggle(j.id)}>
                  {inner}
                </div>
              );
            }
            return (
              <div key={j.id} className="relative group">
                {isAdmin && (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setDeleteJobId(j.id);
                      setConfirmOpen(true);
                    }}
                    className="absolute right-2 top-2 z-10 rounded-full bg-destructive text-destructive-foreground p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/90"
                    title="Delete job"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
                <Link to="/jobs/$jobId" params={{ jobId: j.id }} className={baseRowClass}>
                  {inner}
                </Link>
              </div>
            );
          })}
        </div>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={(open) => { setConfirmOpen(open); if (!open) setDeleteJobId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteJobId
                ? `Delete job #${jobs.find((j: any) => j.id === deleteJobId)?.job_number ?? ""}?`
                : `Delete ${selected.size} job${selected.size === 1 ? "" : "s"}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the {deleteJobId ? "job" : `selected job${selected.size === 1 ? "" : "s"}`} and any related tasks, time entries, photos and invoices. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting} onClick={() => setDeleteJobId(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
