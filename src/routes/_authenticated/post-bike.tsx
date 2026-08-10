import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Truck, MapPin, Plus, Bike as BikeIcon, Wrench, Trash2, GripVertical } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

type Branch = {
  id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
};

type PostBike = {
  id: string;
  branch_id: string | null;
  name: string | null;
  rego: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
  color: string | null;
  current_km: number | null;
  service_interval_km: number;
  last_service_date: string | null;
  last_service_km: number | null;
  notes: string | null;
  is_active: boolean;
};

type ServiceLog = {
  id: string;
  post_bike_id: string;
  service_date: string;
  km: number | null;
  service_type: string | null;
  description: string;
  cost: number | null;
  performed_by: string | null;
  notes: string | null;
};

export const Route = createFileRoute("/_authenticated/post-bike")({
  head: () => ({
    meta: [
      { title: "Post Bike fleet — Motorcycle Doctors Workshop" },
      {
        name: "description",
        content:
          "Manage the Post Bike fleet by branch, drag bikes between branches and keep a full service history for each bike.",
      },
      { property: "og:title", content: "Post Bike fleet — Motorcycle Doctors Workshop" },
      {
        property: "og:description",
        content: "Post Bike branches, bikes and independent service history records.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PostBikePage,
});

function bikeLabel(b: PostBike) {
  const parts = [b.year ? String(b.year) : "", b.make ?? "", b.model ?? ""].filter(Boolean);
  return b.name?.trim() || parts.join(" ") || b.rego || "Post bike";
}

function PostBikePage() {
  const qc = useQueryClient();
  const [dragId, setDragId] = useState<string | null>(null);
  const [overBranch, setOverBranch] = useState<string | null>(null);
  const [branchOpen, setBranchOpen] = useState(false);
  const [bikeOpen, setBikeOpen] = useState(false);
  const [bikeBranchId, setBikeBranchId] = useState<string | null>(null);
  const [detailBike, setDetailBike] = useState<PostBike | null>(null);

  const { data: branches = [] } = useQuery({
    queryKey: ["post-bike-branches"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("post_bike_branches")
        .select("id,name,sort_order,is_active")
        .order("sort_order")
        .order("name");
      if (error) throw error;
      return (data ?? []) as Branch[];
    },
  });

  const { data: bikes = [], isLoading } = useQuery({
    queryKey: ["post-bikes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("post_bikes")
        .select(
          "id,branch_id,name,rego,make,model,year,color,current_km,service_interval_km,last_service_date,last_service_km,notes,is_active",
        )
        .order("sort_order")
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as PostBike[];
    },
  });

  const moveBike = useMutation({
    mutationFn: async ({ id, branchId }: { id: string; branchId: string | null }) => {
      const { error } = await supabase.from("post_bikes").update({ branch_id: branchId }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["post-bikes"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const columns: { id: string | null; name: string }[] = [
    ...branches.map((b) => ({ id: b.id as string | null, name: b.name })),
    { id: null, name: "Unassigned" },
  ];

  function onDrop(branchId: string | null) {
    setOverBranch(null);
    const id = dragId;
    setDragId(null);
    if (!id) return;
    const bike = bikes.find((b) => b.id === id);
    if (!bike || bike.branch_id === branchId) return;
    moveBike.mutate({ id, branchId });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl sm:text-2xl font-bold leading-tight flex items-center gap-2">
            <Truck className="h-5 w-5 text-primary" /> Post Bike fleet
          </h1>
          <div className="text-xs text-muted-foreground">
            {bikes.length} bike{bikes.length === 1 ? "" : "s"} across {branches.length} branch
            {branches.length === 1 ? "" : "es"} · drag a bike onto a branch to move it
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setBranchOpen(true)}
            className="h-9 rounded-lg border border-border px-3 text-xs font-semibold hover:border-primary/50 inline-flex items-center gap-1.5"
          >
            <MapPin className="h-3.5 w-3.5" /> New branch
          </button>
          <button
            onClick={() => {
              setBikeBranchId(branches[0]?.id ?? null);
              setBikeOpen(true);
            }}
            className="h-9 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground hover:opacity-90 inline-flex items-center gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" /> New post bike
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading post bikes…</div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {columns.map((col) => {
            const list = bikes.filter((b) => (b.branch_id ?? null) === col.id);
            const active = overBranch === (col.id ?? "__none");
            return (
              <section
                key={col.id ?? "none"}
                onDragOver={(e) => {
                  e.preventDefault();
                  setOverBranch(col.id ?? "__none");
                }}
                onDragLeave={() => setOverBranch((p) => (p === (col.id ?? "__none") ? null : p))}
                onDrop={(e) => {
                  e.preventDefault();
                  onDrop(col.id);
                }}
                className={`card-surface p-3 space-y-2 transition-colors ${
                  active ? "border-primary ring-1 ring-primary/40" : ""
                }`}
              >
                <header className="flex items-center justify-between gap-2">
                  <h2 className="text-[0.6875rem] font-bold uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" /> {col.name}
                  </h2>
                  <span className="font-display text-sm font-bold tabular-nums">{list.length}</span>
                </header>

                {list.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border py-6 text-center text-xs text-muted-foreground">
                    Drop bikes here
                  </div>
                ) : (
                  <div className="space-y-2">
                    {list.map((b) => (
                      <BikeCard
                        key={b.id}
                        bike={b}
                        onDragStart={() => setDragId(b.id)}
                        onDragEnd={() => setDragId(null)}
                        onClick={() => setDetailBike(b)}
                        dragging={dragId === b.id}
                      />
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      <NewBranchDialog
        open={branchOpen}
        onOpenChange={setBranchOpen}
        onCreated={() => qc.invalidateQueries({ queryKey: ["post-bike-branches"] })}
        nextOrder={branches.length + 1}
      />
      <NewBikeDialog
        open={bikeOpen}
        onOpenChange={setBikeOpen}
        branches={branches}
        branchId={bikeBranchId}
        setBranchId={setBikeBranchId}
        onCreated={() => qc.invalidateQueries({ queryKey: ["post-bikes"] })}
      />
      <BikeDetailDialog
        bike={detailBike}
        branches={branches}
        onClose={() => setDetailBike(null)}
        onChanged={() => qc.invalidateQueries({ queryKey: ["post-bikes"] })}
      />
    </div>
  );
}

function BikeCard({
  bike,
  onDragStart,
  onDragEnd,
  onClick,
  dragging,
}: {
  bike: PostBike;
  onDragStart: () => void;
  onDragEnd: () => void;
  onClick: () => void;
  dragging: boolean;
}) {
  const dueKm =
    bike.last_service_km != null && bike.current_km != null
      ? bike.last_service_km + bike.service_interval_km - bike.current_km
      : null;
  return (
    <button
      type="button"
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={`w-full text-left rounded-lg border border-border bg-card p-2.5 hover:border-primary/50 transition-all cursor-grab active:cursor-grabbing ${
        dragging ? "opacity-40" : ""
      }`}
    >
      <div className="flex items-start gap-2">
        <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground/60 mt-0.5" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold flex items-center gap-1.5">
            <BikeIcon className="h-3.5 w-3.5 text-primary shrink-0" />
            {bikeLabel(bike)}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[0.6875rem] text-muted-foreground">
            {bike.rego && <span className="font-mono uppercase">{bike.rego}</span>}
            {bike.current_km != null && <span>{bike.current_km.toLocaleString()} km</span>}
            {bike.last_service_date && (
              <span>Last: {format(new Date(bike.last_service_date), "d MMM yy")}</span>
            )}
          </div>
          {dueKm != null && (
            <div
              className={`mt-1 text-[0.625rem] font-semibold uppercase tracking-wide ${
                dueKm <= 0 ? "text-destructive" : "text-muted-foreground"
              }`}
            >
              {dueKm <= 0 ? "Service due" : `${dueKm.toLocaleString()} km to service`}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

const inputCls =
  "w-full rounded-lg border border-border bg-background px-2.5 h-9 text-sm focus:border-primary outline-none";

function NewBranchDialog({
  open,
  onOpenChange,
  onCreated,
  nextOrder,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
  nextOrder: number;
}) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim()) return toast.error("Branch name is required");
    setSaving(true);
    const { error } = await supabase
      .from("post_bike_branches")
      .insert({ name: name.trim(), sort_order: nextOrder });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Branch created");
    setName("");
    onCreated();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>New branch</DialogTitle>
        </DialogHeader>
        <label className="block space-y-1">
          <span className="text-xs font-semibold text-muted-foreground">Branch name</span>
          <input
            className={inputCls}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Papakura"
          />
        </label>
        <DialogFooter>
          <button
            onClick={save}
            disabled={saving}
            className="h-9 rounded-lg bg-primary px-4 text-xs font-semibold text-primary-foreground disabled:opacity-60"
          >
            {saving ? "Saving…" : "Create branch"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewBikeDialog({
  open,
  onOpenChange,
  branches,
  branchId,
  setBranchId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  branches: Branch[];
  branchId: string | null;
  setBranchId: (v: string | null) => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    name: "",
    rego: "",
    make: "",
    model: "",
    year: "",
    color: "",
    current_km: "",
    service_interval_km: "5000",
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function save() {
    if (!form.name.trim() && !form.make.trim() && !form.rego.trim())
      return toast.error("Add at least a name, make or rego");
    setSaving(true);
    const { error } = await supabase.from("post_bikes").insert({
      branch_id: branchId,
      name: form.name.trim() || null,
      rego: form.rego.trim().toUpperCase() || null,
      make: form.make.trim() || null,
      model: form.model.trim() || null,
      year: form.year ? Number(form.year) : null,
      color: form.color.trim() || null,
      current_km: form.current_km ? Number(form.current_km) : null,
      service_interval_km: form.service_interval_km ? Number(form.service_interval_km) : 5000,
      notes: form.notes.trim() || null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Post bike added");
    setForm({
      name: "",
      rego: "",
      make: "",
      model: "",
      year: "",
      color: "",
      current_km: "",
      service_interval_km: "5000",
      notes: "",
    });
    onCreated();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New post bike</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 sm:col-span-2">
            <span className="text-xs font-semibold text-muted-foreground">Name / rider</span>
            <input className={inputCls} value={form.name} onChange={(e) => set("name", e.target.value)} />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold text-muted-foreground">Rego</span>
            <input
              className={`${inputCls} uppercase`}
              value={form.rego}
              onChange={(e) => set("rego", e.target.value)}
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold text-muted-foreground">Branch</span>
            <select
              className={inputCls}
              value={branchId ?? ""}
              onChange={(e) => setBranchId(e.target.value || null)}
            >
              <option value="">Unassigned</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold text-muted-foreground">Make</span>
            <input className={inputCls} value={form.make} onChange={(e) => set("make", e.target.value)} />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold text-muted-foreground">Model</span>
            <input className={inputCls} value={form.model} onChange={(e) => set("model", e.target.value)} />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold text-muted-foreground">Year</span>
            <input
              type="number"
              className={inputCls}
              value={form.year}
              onChange={(e) => set("year", e.target.value)}
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold text-muted-foreground">Colour</span>
            <input className={inputCls} value={form.color} onChange={(e) => set("color", e.target.value)} />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold text-muted-foreground">Current km</span>
            <input
              type="number"
              className={inputCls}
              value={form.current_km}
              onChange={(e) => set("current_km", e.target.value)}
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold text-muted-foreground">Service every (km)</span>
            <input
              type="number"
              className={inputCls}
              value={form.service_interval_km}
              onChange={(e) => set("service_interval_km", e.target.value)}
            />
          </label>
          <label className="space-y-1 sm:col-span-2">
            <span className="text-xs font-semibold text-muted-foreground">Notes</span>
            <textarea
              className="w-full rounded-lg border border-border bg-background px-2.5 py-2 text-sm outline-none focus:border-primary"
              rows={2}
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
            />
          </label>
        </div>
        <DialogFooter>
          <button
            onClick={save}
            disabled={saving}
            className="h-9 rounded-lg bg-primary px-4 text-xs font-semibold text-primary-foreground disabled:opacity-60"
          >
            {saving ? "Saving…" : "Add bike"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BikeDetailDialog({
  bike,
  branches,
  onClose,
  onChanged,
}: {
  bike: PostBike | null;
  branches: Branch[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const qc = useQueryClient();
  const [logForm, setLogForm] = useState({
    service_date: format(new Date(), "yyyy-MM-dd"),
    km: "",
    service_type: "",
    description: "",
    cost: "",
    performed_by: "",
  });
  const [saving, setSaving] = useState(false);

  const { data: logs = [] } = useQuery({
    queryKey: ["post-bike-services", bike?.id],
    enabled: !!bike,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("post_bike_services")
        .select("id,post_bike_id,service_date,km,service_type,description,cost,performed_by,notes")
        .eq("post_bike_id", bike!.id)
        .order("service_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ServiceLog[];
    },
  });

  if (!bike) return null;

  async function addLog() {
    if (!bike) return;
    if (!logForm.description.trim()) return toast.error("Describe the service");
    setSaving(true);
    const km = logForm.km ? Number(logForm.km) : null;
    const { error } = await supabase.from("post_bike_services").insert({
      post_bike_id: bike.id,
      service_date: logForm.service_date,
      km,
      service_type: logForm.service_type.trim() || null,
      description: logForm.description.trim(),
      cost: logForm.cost ? Number(logForm.cost) : null,
      performed_by: logForm.performed_by.trim() || null,
    });
    if (error) {
      setSaving(false);
      return toast.error(error.message);
    }
    // Keep the bike record up to date with the latest service
    await supabase
      .from("post_bikes")
      .update({
        last_service_date: logForm.service_date,
        last_service_km: km ?? bike.last_service_km,
        current_km: km != null ? Math.max(km, bike.current_km ?? 0) : bike.current_km,
      })
      .eq("id", bike.id);
    setSaving(false);
    setLogForm({
      service_date: format(new Date(), "yyyy-MM-dd"),
      km: "",
      service_type: "",
      description: "",
      cost: "",
      performed_by: "",
    });
    toast.success("Service recorded");
    qc.invalidateQueries({ queryKey: ["post-bike-services", bike.id] });
    onChanged();
  }

  async function removeLog(id: string) {
    const { error } = await supabase.from("post_bike_services").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["post-bike-services", bike!.id] });
  }

  async function updateBike(patch: Partial<PostBike>) {
    const { error } = await supabase.from("post_bikes").update(patch).eq("id", bike!.id);
    if (error) return toast.error(error.message);
    onChanged();
  }

  async function deleteBike() {
    if (!confirm("Delete this post bike and its service history?")) return;
    const { error } = await supabase.from("post_bikes").delete().eq("id", bike!.id);
    if (error) return toast.error(error.message);
    toast.success("Post bike deleted");
    onChanged();
    onClose();
  }

  return (
    <Dialog open={!!bike} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BikeIcon className="h-4 w-4 text-primary" /> {bikeLabel(bike)}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-3">
          <label className="space-y-1">
            <span className="text-xs font-semibold text-muted-foreground">Branch</span>
            <select
              className={inputCls}
              value={bike.branch_id ?? ""}
              onChange={(e) => updateBike({ branch_id: e.target.value || null })}
            >
              <option value="">Unassigned</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold text-muted-foreground">Current km</span>
            <input
              type="number"
              className={inputCls}
              defaultValue={bike.current_km ?? ""}
              onBlur={(e) =>
                updateBike({ current_km: e.target.value ? Number(e.target.value) : null })
              }
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold text-muted-foreground">Service every (km)</span>
            <input
              type="number"
              className={inputCls}
              defaultValue={bike.service_interval_km}
              onBlur={(e) =>
                updateBike({ service_interval_km: Number(e.target.value || 5000) })
              }
            />
          </label>
        </div>

        <section className="space-y-2">
          <h3 className="text-[0.6875rem] font-bold uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-1.5">
            <Wrench className="h-3.5 w-3.5" /> Service history ({logs.length})
          </h3>
          <div className="grid gap-2 sm:grid-cols-6 rounded-lg border border-border p-2.5">
            <input
              type="date"
              className={`${inputCls} sm:col-span-2`}
              value={logForm.service_date}
              onChange={(e) => setLogForm((f) => ({ ...f, service_date: e.target.value }))}
            />
            <input
              type="number"
              placeholder="km"
              className={`${inputCls} sm:col-span-1`}
              value={logForm.km}
              onChange={(e) => setLogForm((f) => ({ ...f, km: e.target.value }))}
            />
            <input
              placeholder="Type (oil, tyres…)"
              className={`${inputCls} sm:col-span-3`}
              value={logForm.service_type}
              onChange={(e) => setLogForm((f) => ({ ...f, service_type: e.target.value }))}
            />
            <input
              placeholder="What was done"
              className={`${inputCls} sm:col-span-3`}
              value={logForm.description}
              onChange={(e) => setLogForm((f) => ({ ...f, description: e.target.value }))}
            />
            <input
              placeholder="By"
              className={`${inputCls} sm:col-span-2`}
              value={logForm.performed_by}
              onChange={(e) => setLogForm((f) => ({ ...f, performed_by: e.target.value }))}
            />
            <input
              type="number"
              placeholder="$"
              className={`${inputCls} sm:col-span-1`}
              value={logForm.cost}
              onChange={(e) => setLogForm((f) => ({ ...f, cost: e.target.value }))}
            />
            <button
              onClick={addLog}
              disabled={saving}
              className="sm:col-span-6 h-9 rounded-lg bg-primary text-xs font-semibold text-primary-foreground disabled:opacity-60"
            >
              {saving ? "Saving…" : "Add service record"}
            </button>
          </div>

          {logs.length === 0 ? (
            <div className="py-4 text-center text-xs text-muted-foreground">
              No services recorded yet.
            </div>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {logs.map((l) => (
                <li key={l.id} className="flex items-start gap-2 p-2.5 text-sm">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">
                      {l.service_type ? `${l.service_type} — ` : ""}
                      {l.description}
                    </div>
                    <div className="text-[0.6875rem] text-muted-foreground flex flex-wrap gap-x-2">
                      <span>{format(new Date(l.service_date), "d MMM yyyy")}</span>
                      {l.km != null && <span>{l.km.toLocaleString()} km</span>}
                      {l.performed_by && <span>by {l.performed_by}</span>}
                      {l.cost != null && <span>${Number(l.cost).toFixed(2)}</span>}
                    </div>
                  </div>
                  <button
                    onClick={() => removeLog(l.id)}
                    className="text-muted-foreground hover:text-destructive"
                    aria-label="Delete service record"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <DialogFooter className="justify-between">
          <button
            onClick={deleteBike}
            className="h-9 rounded-lg border border-destructive/50 px-3 text-xs font-semibold text-destructive hover:bg-destructive/10"
          >
            Delete bike
          </button>
          <button
            onClick={onClose}
            className="h-9 rounded-lg border border-border px-4 text-xs font-semibold"
          >
            Close
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
