import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { STATUS_META, STATUS_ORDER, formatMinutes, fullBike, initials } from "@/lib/format";
import { useCurrentUser } from "@/hooks/use-current-user";
import { toast } from "sonner";
import { ArrowLeft, Play, Square, User, Bike as BikeIcon, ChevronDown, Check, Droplet, Wrench, Package, Plus, X } from "lucide-react";
import { detectServiceKind, KIND_META, SERVICE_PARTS } from "@/lib/service-kinds";

export const Route = createFileRoute("/_authenticated/jobs/$jobId")({
  component: JobDetail,
});

function JobDetail() {
  const { jobId } = Route.useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { user, isAdmin } = useCurrentUser();

  const job = useQuery({
    queryKey: ["job", jobId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("jobs")
        .select("*, customers(*), motorcycles(*), service_templates(name)")
        .eq("id", jobId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const tasks = useQuery({
    queryKey: ["job-tasks", jobId],
    queryFn: async () => (await supabase.from("job_tasks").select("*").eq("job_id", jobId).order("sort_order")).data ?? [],
  });
  const notes = useQuery({
    queryKey: ["job-notes", jobId],
    queryFn: async () => {
      const { data } = await supabase.from("job_notes").select("*").eq("job_id", jobId).order("created_at", { ascending: false });
      const ids = [...new Set((data ?? []).map((n) => n.author_id))];
      const { data: profs } = ids.length ? await supabase.from("profiles").select("id, full_name").in("id", ids) : { data: [] as any[] };
      const map = new Map<string, string>(); (profs ?? []).forEach((p: any) => map.set(p.id, p.full_name));
      return (data ?? []).map((n) => ({ ...n, author_name: map.get(n.author_id) ?? "Staff" }));
    },
  });
  const time = useQuery({
    queryKey: ["job-time", jobId],
    queryFn: async () => (await supabase.from("time_entries").select("*").eq("job_id", jobId)).data ?? [],
  });
  const techProfile = useQuery({
    queryKey: ["job-tech", job.data?.technician_id],
    enabled: !!job.data?.technician_id,
    queryFn: async () => (await supabase.from("profiles").select("full_name").eq("id", job.data!.technician_id!).maybeSingle()).data,
  });
  const partsUsed = useQuery({
    queryKey: ["job-parts", jobId],
    queryFn: async () => (await supabase.from("parts").select("*").eq("job_id", jobId).order("created_at")).data ?? [],
  });

  const activeTimer = useMemo(() => (time.data ?? []).find((t) => !t.ended_at && t.technician_id === user?.id), [time.data, user]);
  const totalMinutes = useMemo(() => (time.data ?? []).reduce((s, t) => s + (t.minutes ?? (t.ended_at ? Math.round((+new Date(t.ended_at) - +new Date(t.started_at)) / 60000) : 0)), 0), [time.data]);

  if (job.isLoading) return <div className="card-surface p-8 text-center text-sm text-muted-foreground">Loading…</div>;
  if (!job.data) return <div className="card-surface p-8 text-center text-sm text-muted-foreground">Job not found.</div>;

  const j = job.data;
  const meta = STATUS_META[j.status];
  const canEdit = isAdmin || j.technician_id === user?.id;
  const kind = detectServiceKind(j.title);
  const kindMeta = KIND_META[kind];
  const cylinders = Math.max(1, Math.min(6, (j.motorcycles as any)?.cylinders ?? 4));

  async function toggleTask(taskId: string, isDone: boolean) {
    if (!canEdit) return;
    const { error } = await supabase.from("job_tasks").update({
      is_done: !isDone, done_by: !isDone ? user!.id : null, done_at: !isDone ? new Date().toISOString() : null,
    }).eq("id", taskId);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["job-tasks", jobId] });
  }

  async function setStatus(status: string) {
    if (!canEdit) return;
    const patch: any = { status };
    if (status === "in_progress" && !j.started_at) patch.started_at = new Date().toISOString();
    if (status === "completed") patch.completed_at = new Date().toISOString();
    const { error } = await supabase.from("jobs").update(patch).eq("id", jobId);
    if (error) return toast.error(error.message);
    toast.success(`Marked ${STATUS_META[status].label}`);
    qc.invalidateQueries({ queryKey: ["job", jobId] });
    qc.invalidateQueries({ queryKey: ["jobs"] });
    qc.invalidateQueries({ queryKey: ["dashboard-jobs"] });
    qc.invalidateQueries({ queryKey: ["dashboard-counts"] });
  }

  async function startTimer() {
    if (!user) return;
    const { error } = await supabase.from("time_entries").insert({ job_id: jobId, technician_id: user.id });
    if (error) return toast.error(error.message);
    if (j.status === "new" || j.status === "assigned") await setStatus("in_progress");
    qc.invalidateQueries({ queryKey: ["job-time", jobId] });
  }

  async function stopTimer() {
    if (!activeTimer) return;
    const ended = new Date();
    const minutes = Math.max(1, Math.round((+ended - +new Date(activeTimer.started_at)) / 60000));
    const { error } = await supabase.from("time_entries").update({ ended_at: ended.toISOString(), minutes }).eq("id", activeTimer.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["job-time", jobId] });
    toast.success(`Logged ${formatMinutes(minutes)}`);
  }

  const completion = tasks.data && tasks.data.length ? Math.round((tasks.data.filter((t) => t.is_done).length / tasks.data.length) * 100) : 0;

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      <header className="flex items-center gap-3">
        <button onClick={() => nav({ to: "/jobs" })} className="grid h-9 w-9 place-items-center rounded-lg border border-border">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="text-xs uppercase tracking-[0.25em] text-muted-foreground flex items-center gap-2">
            Job #{j.job_number}
            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${kindMeta.cls}`}>
              {kindMeta.label}
            </span>
          </div>
          <h1 className="font-display text-xl sm:text-2xl font-bold truncate">{j.title}</h1>
        </div>
        <StatusDropdown current={j.status} onChange={setStatus} disabled={!canEdit} />
      </header>

      <div className="card-surface p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <InfoRow icon={User} label="Customer" value={`${j.customers?.first_name ?? ""} ${j.customers?.last_name ?? ""}`} hint={j.customers?.phone} />
        <InfoRow icon={BikeIcon} label="Motorcycle" value={fullBike(j.motorcycles as any)} hint={j.motorcycles?.rego ?? undefined} />
      </div>

      {/* Live timer */}
      <div className="card-surface p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Labour logged</div>
            <div className="font-display text-3xl font-bold gold-gradient-text">{formatMinutes(totalMinutes)}</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Tech: {techProfile.data?.full_name ?? <span className="italic">Unassigned</span>}
              {j.estimated_hours ? ` · est. ${j.estimated_hours}h` : ""}
            </div>
          </div>
          {canEdit && (
            activeTimer ? (
              <LiveTimerButton startedAt={activeTimer.started_at} onStop={stopTimer} />
            ) : (
              <Button onClick={startTimer} className="gold-surface h-12 px-5 font-bold gap-2">
                <Play className="h-4 w-4" /> Start Job
              </Button>
            )
          )}
        </div>
      </div>

      {/* Checklist */}
      <section className="card-surface p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-lg font-semibold">Checklist</h2>
          <span className="text-xs text-muted-foreground">{tasks.data?.filter((t) => t.is_done).length ?? 0}/{tasks.data?.length ?? 0} · {completion}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden mb-3">
          <div className="h-full gold-surface transition-all" style={{ width: `${completion}%` }} />
        </div>
        <div className="space-y-1.5">
          {(tasks.data ?? []).map((t) => (
            <TaskRow
              key={t.id}
              task={t}
              canEdit={canEdit}
              onToggle={() => toggleTask(t.id, t.is_done)}
              onNoteSaved={() => qc.invalidateQueries({ queryKey: ["job-tasks", jobId] })}
            />
          ))}
          {(!tasks.data || tasks.data.length === 0) && (
            <p className="text-sm text-muted-foreground text-center py-4">No checklist items.</p>
          )}
        </div>
      </section>

      {/* Parts used (service-kind aware) */}
      {SERVICE_PARTS[kind].length > 0 && (
        <PartsSection
          jobId={jobId}
          canEdit={canEdit}
          serviceData={(j.service_data as any) ?? {}}
          fields={SERVICE_PARTS[kind]}
          parts={partsUsed.data ?? []}
          onChanged={() => {
            qc.invalidateQueries({ queryKey: ["job", jobId] });
            qc.invalidateQueries({ queryKey: ["job-parts", jobId] });
            qc.invalidateQueries({ queryKey: ["inventory"] });
          }}
        />
      )}

      {/* Valve clearance diagram for Full service */}
      {kind === "full" && (
        <ValveClearanceSection
          jobId={jobId}
          cylinders={cylinders}
          canEdit={canEdit}
          data={((j.service_data as any) ?? {}).valves ?? {}}
          onChanged={() => qc.invalidateQueries({ queryKey: ["job", jobId] })}
        />
      )}

      {/* Notes */}
      <section className="card-surface p-4">
        <h2 className="font-display text-lg font-semibold mb-3">Notes</h2>
        {canEdit && <AddNote jobId={jobId} onAdded={() => qc.invalidateQueries({ queryKey: ["job-notes", jobId] })} />}
        <div className="space-y-2 mt-3">
          {(notes.data ?? []).map((n: any) => (
            <div key={n.id} className="rounded-lg border border-border bg-background/40 p-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-muted text-[10px] font-semibold">{initials(n.author_name)}</span>
                <span className="text-xs font-semibold">{n.author_name}</span>
                <span className="text-[10px] text-muted-foreground">{new Date(n.created_at).toLocaleString()}</span>
              </div>
              <p className="text-sm whitespace-pre-wrap">{n.body}</p>
            </div>
          ))}
          {(!notes.data || notes.data.length === 0) && (
            <p className="text-sm text-muted-foreground">No notes yet.</p>
          )}
        </div>
      </section>

      {j.complaint && (
        <section className="card-surface p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Customer Complaint</div>
          <p className="text-sm whitespace-pre-wrap">{j.complaint}</p>
        </section>
      )}
    </div>
  );
}

function InfoRow({ icon: Icon, label, value, hint }: { icon: any; label: string; value: string; hint?: string | null }) {
  return (
    <div className="flex items-start gap-3">
      <span className="grid h-9 w-9 place-items-center rounded-lg bg-muted text-primary shrink-0"><Icon className="h-4 w-4" /></span>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="font-semibold truncate">{value || "—"}</div>
        {hint && <div className="text-xs text-muted-foreground truncate">{hint}</div>}
      </div>
    </div>
  );
}

function StatusDropdown({ current, onChange, disabled }: { current: string; onChange: (s: string) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const meta = STATUS_META[current];
  return (
    <div className="relative">
      <button
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={`shrink-0 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-wider ${meta.cls} disabled:opacity-60`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
        {meta.label}
        {!disabled && <ChevronDown className="h-3 w-3" />}
      </button>
      {open && !disabled && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 z-40 w-48 rounded-xl border border-border bg-card shadow-xl p-1">
            {STATUS_ORDER.map((s) => {
              const m = STATUS_META[s];
              return (
                <button
                  key={s}
                  onClick={() => { onChange(s); setOpen(false); }}
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-semibold hover:bg-muted text-left"
                >
                  <span className={`h-2 w-2 rounded-full ${m.dot}`} />
                  {m.label}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function LiveTimerButton({ startedAt, onStop }: { startedAt: string; onStop: () => void }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);
  const sec = Math.max(0, Math.floor((now - +new Date(startedAt)) / 1000));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return (
    <Button onClick={onStop} className="bg-status-parts hover:bg-status-parts/90 text-white h-12 px-5 font-bold gap-2">
      <Square className="h-4 w-4 fill-white" />
      <span className="tabular-nums">{String(h).padStart(2,"0")}:{String(m).padStart(2,"0")}:{String(s).padStart(2,"0")}</span>
      <span>Stop</span>
    </Button>
  );
}

function AddNote({ jobId, onAdded }: { jobId: string; onAdded: () => void }) {
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const { user } = useCurrentUser();
  async function save() {
    if (!body.trim() || !user) return;
    setSaving(true);
    const { error } = await supabase.from("job_notes").insert({ job_id: jobId, body, author_id: user.id });
    setSaving(false);
    if (error) return toast.error(error.message);
    setBody(""); onAdded();
  }
  return (
    <div className="space-y-2">
      <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={2} placeholder="Add a note for the team…" />
      <Button onClick={save} disabled={saving || !body.trim()} className="gold-surface w-full sm:w-auto">Post note</Button>
    </div>
  );
}

function TaskRow({ task, canEdit, onToggle, onNoteSaved }: { task: any; canEdit: boolean; onToggle: () => void; onNoteSaved: () => void }) {
  const [note, setNote] = useState(task.note ?? "");
  const [dirty, setDirty] = useState(false);
  useEffect(() => { setNote(task.note ?? ""); setDirty(false); }, [task.note]);

  async function saveNote() {
    const { error } = await supabase.from("job_tasks").update({ note: note || null }).eq("id", task.id);
    if (error) return toast.error(error.message);
    setDirty(false);
    onNoteSaved();
  }

  return (
    <div className={`rounded-lg border p-2.5 transition-colors ${task.is_done ? "border-status-ready/30 bg-status-ready/5" : "border-border"}`}>
      <button
        onClick={onToggle}
        disabled={!canEdit}
        className="w-full flex items-center gap-3 text-left"
      >
        <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-md border ${task.is_done ? "bg-status-ready border-status-ready text-background" : "border-border"}`}>
          {task.is_done && <Check className="h-3.5 w-3.5" />}
        </span>
        <span className={`text-sm font-medium ${task.is_done ? "text-muted-foreground line-through" : ""}`}>{task.label}</span>
      </button>
      {canEdit && (
        <div className="mt-1.5 pl-9 flex items-center gap-2">
          <input
            value={note}
            onChange={(e) => { setNote(e.target.value); setDirty(true); }}
            onBlur={() => dirty && saveNote()}
            onKeyDown={(e) => { if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur(); }}
            placeholder="Quick note…"
            maxLength={140}
            className="flex-1 bg-transparent border-0 border-b border-border/50 text-xs py-1 focus:outline-none focus:border-primary placeholder:text-muted-foreground/60"
          />
          {dirty && <span className="text-[10px] text-primary">unsaved</span>}
        </div>
      )}
      {!canEdit && note && <p className="mt-1 pl-9 text-xs text-muted-foreground italic">{note}</p>}
    </div>
  );
}

function PartsSection({
  jobId, canEdit, serviceData, fields, parts, onChanged,
}: {
  jobId: string; canEdit: boolean; serviceData: any;
  fields: Array<{ key: string; label: string; category: string; unitHint?: string }>;
  parts: any[]; onChanged: () => void;
}) {
  const [picker, setPicker] = useState<{ key: string; category: string; label: string } | null>(null);
  const used = serviceData?.parts_used ?? {};

  async function clearField(key: string) {
    const next = { ...used };
    delete next[key];
    const { error } = await supabase.from("jobs").update({ service_data: { ...serviceData, parts_used: next } }).eq("id", jobId);
    if (error) return toast.error(error.message);
    onChanged();
  }

  async function updateQty(key: string, qty: number) {
    const current = used[key];
    if (!current) return;
    const next = { ...used, [key]: { ...current, quantity: qty } };
    await supabase.from("jobs").update({ service_data: { ...serviceData, parts_used: next } }).eq("id", jobId);
    onChanged();
  }

  return (
    <section className="card-surface p-4">
      <div className="flex items-center gap-2 mb-3">
        <Droplet className="h-4 w-4 text-primary" />
        <h2 className="font-display text-lg font-semibold">Parts & Fluids Used</h2>
      </div>
      <div className="space-y-2">
        {fields.map((f) => {
          const u = used[f.key];
          return (
            <div key={f.key} className="rounded-lg border border-border p-3">
              <div className="flex items-center gap-2 justify-between">
                <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">{f.label}</div>
                {canEdit && (
                  u ? (
                    <button onClick={() => clearField(f.key)} className="text-[10px] text-destructive flex items-center gap-1">
                      <X className="h-3 w-3" /> Remove
                    </button>
                  ) : (
                    <button
                      onClick={() => setPicker({ key: f.key, category: f.category, label: f.label })}
                      className="text-[11px] font-semibold text-primary flex items-center gap-1 hover:underline"
                    >
                      <Plus className="h-3 w-3" /> Pick from inventory
                    </button>
                  )
                )}
              </div>
              {u ? (
                <div className="mt-2 flex items-center gap-2 flex-wrap">
                  <span className="grid h-9 w-9 place-items-center rounded-md bg-muted text-primary"><Package className="h-4 w-4" /></span>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate">{u.name}</div>
                    <div className="text-xs text-muted-foreground truncate">{[u.brand, u.type].filter(Boolean).join(" · ")}</div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Input
                      type="number"
                      step="0.1"
                      value={u.quantity ?? 1}
                      onChange={(e) => updateQty(f.key, Number(e.target.value))}
                      disabled={!canEdit}
                      className="h-9 w-20"
                    />
                    <span className="text-xs text-muted-foreground">{u.unit || f.unitHint || ""}</span>
                  </div>
                </div>
              ) : (
                <div className="mt-1 text-sm text-muted-foreground italic">Not recorded yet.</div>
              )}
            </div>
          );
        })}
      </div>

      {parts.length > 0 && (
        <div className="mt-4 pt-3 border-t border-border">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 font-semibold">Stock movements logged</div>
          <ul className="text-xs space-y-1">
            {parts.map((p) => (
              <li key={p.id} className="flex justify-between text-muted-foreground">
                <span>{p.name} × {Number(p.quantity)}</span>
                <span>${(Number(p.retail) * Number(p.quantity)).toFixed(2)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {picker && (
        <InventoryPicker
          jobId={jobId}
          fieldKey={picker.key}
          category={picker.category}
          label={picker.label}
          serviceData={serviceData}
          onClose={() => setPicker(null)}
          onPicked={() => { setPicker(null); onChanged(); }}
        />
      )}
    </section>
  );
}

function InventoryPicker({ jobId, fieldKey, category, label, serviceData, onClose, onPicked }: {
  jobId: string; fieldKey: string; category: string; label: string; serviceData: any;
  onClose: () => void; onPicked: () => void;
}) {
  const { user } = useCurrentUser();
  const [qty, setQty] = useState("1");
  const [pickedId, setPickedId] = useState<string | null>(null);

  const items = useQuery({
    queryKey: ["inventory-pick", category],
    queryFn: async () => (await supabase.from("inventory_items").select("*").eq("category", category).order("name")).data ?? [],
  });

  async function confirm() {
    const item = (items.data ?? []).find((i: any) => i.id === pickedId);
    if (!item) return toast.error("Pick an item");
    const n = Number(qty);
    if (!n || n <= 0) return toast.error("Quantity must be > 0");

    const used = serviceData?.parts_used ?? {};
    const next = {
      ...used,
      [fieldKey]: {
        inventory_item_id: item.id,
        name: item.name,
        brand: item.brand,
        type: item.type,
        unit: item.unit,
        quantity: n,
        unit_price: Number(item.unit_price),
      },
    };

    const updates = await Promise.all([
      supabase.from("jobs").update({ service_data: { ...serviceData, parts_used: next } }).eq("id", jobId),
      supabase.from("parts").insert({
        job_id: jobId, name: `${item.name}${item.brand ? ` (${item.brand})` : ""}`,
        quantity: n, supplier: item.brand, cost: Number(item.unit_price), retail: Number(item.unit_price),
        added_by: user?.id,
      }),
      supabase.from("inventory_items").update({ stock_qty: Math.max(0, Number(item.stock_qty) - n) }).eq("id", item.id),
    ]);
    const err = updates.find((u) => u.error)?.error;
    if (err) return toast.error(err.message);
    toast.success(`${item.name} added to job`);
    onPicked();
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/80 p-4" onClick={onClose}>
      <div className="card-surface p-5 w-full max-w-md space-y-3 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-display text-lg font-bold">Pick {label}</h3>
        {items.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (items.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No inventory items in this category. Add some in the Inventory page.</p>
        ) : (
          <div className="space-y-1.5 max-h-72 overflow-y-auto">
            {(items.data ?? []).map((i: any) => (
              <button
                key={i.id}
                onClick={() => setPickedId(i.id)}
                className={`w-full text-left rounded-lg border p-2.5 transition-colors ${
                  pickedId === i.id ? "border-primary bg-primary/10" : "border-border hover:border-primary/40"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold text-sm truncate">{i.name}</div>
                    <div className="text-xs text-muted-foreground truncate">{[i.brand, i.type].filter(Boolean).join(" · ")}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs font-bold">${Number(i.unit_price).toFixed(2)}</div>
                    <div className="text-[10px] text-muted-foreground">{Number(i.stock_qty)} {i.unit}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground">Quantity</label>
          <Input type="number" step="0.1" value={qty} onChange={(e) => setQty(e.target.value)} className="h-9 w-24" />
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={confirm} disabled={!pickedId} className="gold-surface">Add to job</Button>
        </div>
      </div>
    </div>
  );
}

function ValveClearanceSection({ jobId, cylinders, canEdit, data, onChanged }: {
  jobId: string; cylinders: number; canEdit: boolean; data: any; onChanged: () => void;
}) {
  const [values, setValues] = useState<any>(data ?? {});
  const [saving, setSaving] = useState(false);
  useEffect(() => { setValues(data ?? {}); }, [data]);

  const intakePerCyl = 2;
  const exhaustPerCyl = 2;

  function set(cyl: number, side: "intake" | "exhaust", idx: number, v: string) {
    const key = `c${cyl}_${side}_${idx}`;
    setValues((s: any) => ({ ...s, [key]: v }));
  }

  async function save() {
    setSaving(true);
    const { data: job } = await supabase.from("jobs").select("service_data").eq("id", jobId).maybeSingle();
    const next = { ...(job?.service_data as any ?? {}), valves: values };
    const { error } = await supabase.from("jobs").update({ service_data: next }).eq("id", jobId);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Valve clearances saved");
    onChanged();
  }

  return (
    <section className="card-surface p-4">
      <div className="flex items-center gap-2 mb-1">
        <Wrench className="h-4 w-4 text-primary" />
        <h2 className="font-display text-lg font-semibold">Valve Clearance Check</h2>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        {cylinders}-cylinder engine. Record measured clearance in mm for each valve (intake & exhaust).
      </p>

      <div className="rounded-xl border border-border bg-background/40 p-3 overflow-x-auto">
        <div className="flex gap-3 min-w-fit">
          {Array.from({ length: cylinders }).map((_, c) => {
            const cyl = c + 1;
            return (
              <div key={cyl} className="rounded-lg border border-border bg-card/60 p-2.5 min-w-[150px]">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-2 text-center">
                  Cyl {cyl}
                </div>
                <div className="space-y-2">
                  <div>
                    <div className="text-[10px] text-status-progress font-semibold mb-1">INTAKE</div>
                    <div className="grid grid-cols-2 gap-1">
                      {Array.from({ length: intakePerCyl }).map((_, i) => (
                        <input
                          key={i}
                          disabled={!canEdit}
                          value={values[`c${cyl}_intake_${i}`] ?? ""}
                          onChange={(e) => set(cyl, "intake", i, e.target.value)}
                          placeholder="mm"
                          className="h-9 rounded-md bg-background border border-border text-center text-xs font-mono focus:outline-none focus:border-primary"
                        />
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-1 px-2">
                    <div className="h-6 rounded-sm bg-status-progress/20 border border-status-progress/40" title="Intake valve" />
                    <div className="h-6 rounded-sm bg-status-progress/20 border border-status-progress/40" title="Intake valve" />
                  </div>
                  <div className="h-px bg-border my-1" />
                  <div className="grid grid-cols-2 gap-1 px-2">
                    <div className="h-6 rounded-sm bg-destructive/20 border border-destructive/40" title="Exhaust valve" />
                    <div className="h-6 rounded-sm bg-destructive/20 border border-destructive/40" title="Exhaust valve" />
                  </div>
                  <div>
                    <div className="text-[10px] text-destructive font-semibold mb-1 mt-1">EXHAUST</div>
                    <div className="grid grid-cols-2 gap-1">
                      {Array.from({ length: exhaustPerCyl }).map((_, i) => (
                        <input
                          key={i}
                          disabled={!canEdit}
                          value={values[`c${cyl}_exhaust_${i}`] ?? ""}
                          onChange={(e) => set(cyl, "exhaust", i, e.target.value)}
                          placeholder="mm"
                          className="h-9 rounded-md bg-background border border-border text-center text-xs font-mono focus:outline-none focus:border-primary"
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-3 flex items-center gap-3 text-[10px] text-muted-foreground">
        <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-status-progress/40 border border-status-progress/60" /> Intake</span>
        <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-destructive/40 border border-destructive/60" /> Exhaust</span>
        <span className="ml-auto">Spec usually: intake 0.10–0.20mm · exhaust 0.20–0.30mm</span>
      </div>
      {canEdit && (
        <div className="mt-3 flex justify-end">
          <Button onClick={save} disabled={saving} className="gold-surface">{saving ? "Saving…" : "Save measurements"}</Button>
        </div>
      )}
    </section>
  );
}