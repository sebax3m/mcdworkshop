import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Truck, MapPin, Plus, Bike as BikeIcon, Wrench, Trash2, GripVertical } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTechnicians } from "@/hooks/use-active-technician";

import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
/** Formats kilometres with dot thousand separators, e.g. 1000 -> "1.000" */
const fmtKm = (n: number | null | undefined) =>
  n == null ? "" : new Intl.NumberFormat("de-DE").format(n);

/** Parses a possibly dot-formatted km string back to a number */
const parseKm = (v: string): number | null => {
  const digits = v.replace(/\D/g, "");
  return digits ? Number(digits) : null;
};


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

      <CalendarPostBikes
        branches={branches}
        existing={bikes}
        onImported={() => qc.invalidateQueries({ queryKey: ["post-bikes"] })}
      />


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
            {bike.current_km != null && <span>{fmtKm(bike.current_km)} km</span>}
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
              {dueKm <= 0 ? "Service due" : `${fmtKm(dueKm)} km to service`}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

type CalBike = {
  motorcycle_id: string;
  make: string | null;
  model: string | null;
  year: number | null;
  rego: string | null;
  mileage: number | null;
  lastDate: string;
  count: number;
};

function CalendarPostBikes({
  branches,
  existing,
  onImported,
}: {
  branches: Branch[];
  existing: PostBike[];
  onImported: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [sel, setSel] = useState<Record<string, string>>({});

  const { data: calBikes = [], isLoading } = useQuery({
    queryKey: ["post-bike-bookings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("motorcycle_id,scheduled_date,motorcycles(id,make,model,year,rego,mileage)")
        .ilike("service_type", "%post%")
        .order("scheduled_date", { ascending: false })
        .limit(500);
      if (error) throw error;
      const map = new Map<string, CalBike>();
      for (const row of (data ?? []) as unknown as {
        motorcycle_id: string | null;
        scheduled_date: string;
        motorcycles: {
          id: string;
          make: string | null;
          model: string | null;
          year: number | null;
          rego: string | null;
          mileage: number | null;
        } | null;
      }[]) {
        const m = row.motorcycles;
        if (!m || !row.motorcycle_id) continue;
        const prev = map.get(m.id);
        if (prev) {
          prev.count += 1;
          continue;
        }
        map.set(m.id, {
          motorcycle_id: m.id,
          make: m.make,
          model: m.model,
          year: m.year,
          rego: m.rego,
          mileage: m.mileage,
          lastDate: row.scheduled_date,
          count: 1,
        });
      }
      return [...map.values()];
    },
  });

  const takenRegos = new Set(
    existing.map((b) => (b.rego ?? "").trim().toUpperCase()).filter(Boolean),
  );

  async function assign(bike: CalBike, branchId: string | null) {
    setBusy(bike.motorcycle_id);
    const { error } = await supabase.from("post_bikes").insert({
      branch_id: branchId,
      name: null,
      rego: bike.rego?.trim().toUpperCase() || null,
      make: bike.make,
      model: bike.model,
      year: bike.year,
      current_km: bike.mileage,
      service_interval_km: 5000,
    });
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success("Bike added to fleet");
    onImported();
  }

  return (
    <section className="card-surface p-3 space-y-3">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[0.6875rem] font-bold uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-1.5">
          <BikeIcon className="h-3.5 w-3.5" /> Post bikes from the calendar
        </h2>
        <span className="text-[0.6875rem] text-muted-foreground">
          {calBikes.length} bike{calBikes.length === 1 ? "" : "s"} booked as Post Bike
        </span>
      </header>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading book-ins…</div>
      ) : calBikes.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-6 text-center text-xs text-muted-foreground">
          No Post Bike book-ins found in the calendar yet.
        </div>
      ) : (
        <div className="space-y-1.5">
          {calBikes.map((b) => {
            const already = !!b.rego && takenRegos.has(b.rego.trim().toUpperCase());
            const label =
              [b.year ? String(b.year) : "", b.make ?? "", b.model ?? ""].filter(Boolean).join(" ") ||
              b.rego ||
              "Bike";
            return (
              <div
                key={b.motorcycle_id}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-2.5"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{label}</div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[0.6875rem] text-muted-foreground">
                    {b.rego && <span className="font-mono uppercase">{b.rego}</span>}
                    {b.mileage != null && <span>{fmtKm(b.mileage)} km</span>}
                    <span>Last book-in: {format(new Date(b.lastDate), "d MMM yy")}</span>
                    {b.count > 1 && <span>{b.count} book-ins</span>}
                  </div>
                </div>
                {already ? (
                  <span className="text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">
                    In fleet
                  </span>
                ) : (
                  <div className="flex items-center gap-2">
                    <select
                      className="h-8 rounded-lg border border-border bg-background px-2 text-xs outline-none focus:border-primary"
                      value={sel[b.motorcycle_id] ?? branches[0]?.id ?? ""}
                      onChange={(e) =>
                        setSel((s) => ({ ...s, [b.motorcycle_id]: e.target.value }))
                      }
                    >
                      <option value="">Unassigned</option>
                      {branches.map((br) => (
                        <option key={br.id} value={br.id}>
                          {br.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={busy === b.motorcycle_id}
                      onClick={() =>
                        assign(b, (sel[b.motorcycle_id] ?? branches[0]?.id ?? "") || null)
                      }
                      className="h-8 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:opacity-60"
                    >
                      {busy === b.motorcycle_id ? "Adding…" : "Assign"}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
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

const QUICK_ITEMS = [
  "WOF done",
  "Oil & filter change",
  "Chain & sprockets",
  "Brake pads",
  "Tyres",
  "Battery",
  "General service",
  "Wash & check",
];

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
  const { technicians: allTechs } = useTechnicians();
  const technicians = allTechs.filter(
    (t) => t.full_name.trim().toLowerCase() !== "admin" && t.email !== "services@mcdr.co.nz",
  );

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
          <DialogTitle className="flex flex-wrap items-center gap-2">
            <BikeIcon className="h-4 w-4 text-primary" /> {bikeLabel(bike)}
            {bike.rego && (
              <span className="rounded-md border border-border bg-muted px-2 py-0.5 font-mono text-xs uppercase tracking-wider">
                {bike.rego}
              </span>
            )}
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
              type="text"
              inputMode="numeric"
              className={inputCls}
              defaultValue={fmtKm(bike.current_km)}
              onBlur={(e) => {
                const v = parseKm(e.target.value);
                e.target.value = fmtKm(v);
                updateBike({ current_km: v });
              }}
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold text-muted-foreground">Service every (km)</span>
            <input
              type="text"
              inputMode="numeric"
              className={inputCls}
              defaultValue={fmtKm(bike.service_interval_km)}
              onBlur={(e) => {
                const v = parseKm(e.target.value) ?? 5000;
                e.target.value = fmtKm(v);
                updateBike({ service_interval_km: v });
              }}
            />
          </label>

        </div>

        <section className="space-y-2">
          <h3 className="text-[0.6875rem] font-bold uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-1.5">
            <Wrench className="h-3.5 w-3.5" /> Service history ({logs.length})
          </h3>
          <div className="space-y-2 rounded-lg border border-border p-2.5">
            <div className="grid gap-2 sm:grid-cols-6">
              <input
                type="date"
                className={`${inputCls} sm:col-span-3`}
                value={logForm.service_date}
                onChange={(e) => setLogForm((f) => ({ ...f, service_date: e.target.value }))}
              />
              <input
                type="text"
                inputMode="numeric"
                placeholder="km"
                className={`${inputCls} sm:col-span-3`}
                value={fmtKm(parseKm(logForm.km))}
                onChange={(e) =>
                  setLogForm((f) => ({ ...f, km: String(parseKm(e.target.value) ?? "") }))
                }
              />
            </div>


            <div className="space-y-1">
              <span className="text-xs font-semibold text-muted-foreground">What was done</span>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_ITEMS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() =>
                      setLogForm((f) => ({
                        ...f,
                        description: f.description.trim()
                          ? `${f.description.replace(/\s*$/, "")}\n• ${q}`
                          : `• ${q}`,
                      }))
                    }
                    className="rounded-full border border-border px-2.5 py-1 text-[0.6875rem] font-semibold hover:border-primary/60 hover:text-primary"
                  >
                    + {q}
                  </button>
                ))}
              </div>
              <textarea
                rows={6}
                placeholder={"List everything done, one per line:\n• WOF done\n• Oil and filter changed\n• Chain adjusted"}
                className="w-full rounded-lg border border-border bg-background px-2.5 py-2 text-sm leading-relaxed outline-none focus:border-primary"
                value={logForm.description}
                onChange={(e) => setLogForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>

            <div className="grid gap-2 sm:grid-cols-6">
              <label className="space-y-1 sm:col-span-3">
                <span className="text-xs font-semibold text-muted-foreground">By</span>
                <select
                  className={inputCls}
                  value={logForm.performed_by}
                  onChange={(e) => setLogForm((f) => ({ ...f, performed_by: e.target.value }))}
                >
                  <option value="">Select technician…</option>
                  {technicians.map((t) => (
                    <option key={t.id} value={t.full_name}>
                      {t.full_name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="sm:col-span-3 flex items-end">
                <button
                  onClick={addLog}
                  disabled={saving}
                  className="w-full h-9 rounded-lg bg-primary text-xs font-semibold text-primary-foreground disabled:opacity-60"
                >
                  {saving ? "Saving…" : "Add service record"}
                </button>
              </div>
            </div>
          </div>


          {logs.length === 0 ? (
            <div className="py-4 text-center text-xs text-muted-foreground">
              No services recorded yet.
            </div>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {logs.map((l) => (
                <li key={l.id} className="flex items-start gap-2 p-2.5 text-sm">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <span className="text-base font-bold tracking-tight">
                        {l.km != null ? `${fmtKm(l.km)} kms` : "— kms"}
                      </span>
                      <span className="text-sm font-semibold text-muted-foreground">
                        {format(new Date(l.service_date), "d MMM yyyy")}
                      </span>
                      {l.performed_by && (
                        <span className="text-[0.6875rem] text-muted-foreground">
                          by {l.performed_by}
                        </span>
                      )}
                    </div>
                    <div className="whitespace-pre-wrap text-xs text-muted-foreground">
                      {l.description}
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
