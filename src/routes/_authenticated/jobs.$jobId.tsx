import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { STATUS_META, STATUS_ORDER, formatMinutes, fullBike, initials } from "@/lib/format";
import { useCurrentUser } from "@/hooks/use-current-user";
import { toast } from "sonner";
import { ArrowLeft, Phone, Play, Square, User, Camera, Bike as BikeIcon, ChevronDown, Check } from "lucide-react";

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

  const activeTimer = useMemo(() => (time.data ?? []).find((t) => !t.ended_at && t.technician_id === user?.id), [time.data, user]);
  const totalMinutes = useMemo(() => (time.data ?? []).reduce((s, t) => s + (t.minutes ?? (t.ended_at ? Math.round((+new Date(t.ended_at) - +new Date(t.started_at)) / 60000) : 0)), 0), [time.data]);

  if (job.isLoading) return <div className="card-surface p-8 text-center text-sm text-muted-foreground">Loading…</div>;
  if (!job.data) return <div className="card-surface p-8 text-center text-sm text-muted-foreground">Job not found.</div>;

  const j = job.data;
  const meta = STATUS_META[j.status];
  const canEdit = isAdmin || j.technician_id === user?.id;

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
          <div className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Job #{j.job_number}</div>
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
            <button
              key={t.id}
              onClick={() => toggleTask(t.id, t.is_done)}
              disabled={!canEdit}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg border text-left transition-colors ${
                t.is_done ? "border-status-ready/30 bg-status-ready/5 text-muted-foreground line-through" : "border-border hover:border-primary/40"
              }`}
            >
              <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-md border ${t.is_done ? "bg-status-ready border-status-ready text-background" : "border-border"}`}>
                {t.is_done && <Check className="h-3.5 w-3.5" />}
              </span>
              <span className="text-sm font-medium">{t.label}</span>
            </button>
          ))}
          {(!tasks.data || tasks.data.length === 0) && (
            <p className="text-sm text-muted-foreground text-center py-4">No checklist items.</p>
          )}
        </div>
      </section>

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