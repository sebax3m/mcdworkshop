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
import { ArrowLeft, Play, Square, User, Bike as BikeIcon, ChevronDown, Check, Droplet, Wrench, Package, Plus, X, FileText, Printer } from "lucide-react";
import { detectServiceKind, KIND_META, SERVICE_PARTS } from "@/lib/service-kinds";
import { getValveSpec, formatRange, type ValveSpec } from "@/lib/valve-specs";
import { DamageSection } from "@/components/DamageSection";


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
  const existingInvoice = useQuery({
    queryKey: ["job-invoice", jobId],
    queryFn: async () => (await supabase.from("invoices").select("id, invoice_number, status, total").eq("job_id", jobId).maybeSingle()).data,
  });
  const booking = useQuery({
    queryKey: ["job-booking", jobId],
    queryFn: async () => (await supabase.from("bookings").select("notes, complaints, instructions").eq("job_id", jobId).maybeSingle()).data,
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
    // Also log a clock_in event so it appears on the Clock page and floating widget
    await supabase.from("clock_events").insert({ user_id: user.id, event_type: "clock_in", job_id: jobId });
    if (j.status === "new" || j.status === "assigned") await setStatus("in_progress");
    qc.invalidateQueries({ queryKey: ["job-time", jobId] });
    qc.invalidateQueries({ queryKey: ["clock-events-floating", user.id] });
    qc.invalidateQueries({ queryKey: ["clock-events"] });
  }

  async function stopTimer() {
    if (!activeTimer || !user) return;
    const ended = new Date();
    const minutes = Math.max(1, Math.round((+ended - +new Date(activeTimer.started_at)) / 60000));
    const { error } = await supabase.from("time_entries").update({ ended_at: ended.toISOString(), minutes }).eq("id", activeTimer.id);
    if (error) return toast.error(error.message);
    await supabase.from("clock_events").insert({ user_id: user.id, event_type: "clock_out", job_id: jobId });
    qc.invalidateQueries({ queryKey: ["job-time", jobId] });
    qc.invalidateQueries({ queryKey: ["clock-events-floating", user.id] });
    qc.invalidateQueries({ queryKey: ["clock-events"] });
    toast.success(`Logged ${formatMinutes(minutes)}`);
  }

  const completion = tasks.data && tasks.data.length ? Math.round((tasks.data.filter((t) => t.is_done).length / tasks.data.length) * 100) : 0;

  // $130/hr GST-inclusive (NZ 15%). Stored amounts on the invoice are inc-GST;
  // the GST line on the invoice shows the embedded component.
  const LABOUR_RATE = 130;
  async function createInvoice() {
    if (!user) return;
    if (existingInvoice.data) {
      nav({ to: "/invoices/$invoiceId", params: { invoiceId: existingInvoice.data.id } });
      return;
    }
    // Bill the standard estimated hours for the booked service (e.g. standard service = 2.5h).
    // Fall back to actual tracked time when no estimate is set on the job/template.
    const trackedHours = totalMinutes / 60;
    const billedHours = Number(j.estimated_hours ?? 0) > 0
      ? Number(j.estimated_hours)
      : trackedHours;
    const labour = Math.round(billedHours * LABOUR_RATE * 100) / 100;
    const parts = (partsUsed.data ?? []).reduce(
      (s, p: any) => s + Number(p.retail ?? 0) * Number(p.quantity ?? 1) * (1 - Number(p.discount_pct ?? 0) / 100),
      0,
    );
    const subtotal = labour + parts; // inc GST
    const gst = Math.round((subtotal * 0.15 / 1.15) * 100) / 100; // embedded GST
    const total = Math.round(subtotal * 100) / 100;
    const year = new Date().getFullYear();
    const { data: last } = await supabase
      .from("invoices")
      .select("invoice_number")
      .like("invoice_number", `MCD-${year}-%`)
      .order("invoice_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextSeq = last?.invoice_number
      ? Number(last.invoice_number.split("-").pop()) + 1
      : 1;
    const invoice_number = `MCD-${year}-${String(nextSeq).padStart(5, "0")}`;
    const { data, error } = await supabase.from("invoices").insert({
      job_id: jobId,
      invoice_number,
      customer_id: j.customer_id,
      motorcycle_id: j.motorcycle_id,
      labour_total: labour,
      parts_total: parts,
      gst,
      total,
      status: "draft",
      created_by: user.id,
    }).select("id, invoice_number").maybeSingle();
    if (error) return toast.error(error.message);
    toast.success(`Invoice ${data?.invoice_number} created`);
    qc.invalidateQueries({ queryKey: ["job-invoice", jobId] });
    if (data?.id) nav({ to: "/invoices/$invoiceId", params: { invoiceId: data.id } });
  }

  return (
    <div className="space-y-5 max-w-3xl mx-auto jobcard-print">
      <style>{`
        @media print {
          @page { size: A4; margin: 14mm; }
          html, body { background: #fff !important; color: #000 !important; }
          body * { visibility: hidden !important; }
          .jobcard-print, .jobcard-print * { visibility: visible !important; }
          .jobcard-print { position: absolute; left: 0; top: 0; width: 100%; max-width: none; margin: 0; padding: 0; }
          .jobcard-print .card-surface { box-shadow: none !important; border-color: #d1d5db !important; background: #fff !important; }
          .no-print, .no-print * { display: none !important; }
        }
        .print-cta:hover { transform: translateY(-1px); transition: transform 0.15s ease-out; }
      `}</style>
      <header className="flex items-center gap-3 no-print">
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
        <Button onClick={() => window.print()} variant="outline" size="sm" className="gap-2">
          <Printer className="h-4 w-4" /> Print
        </Button>
        <StatusDropdown current={j.status} onChange={setStatus} disabled={!canEdit} />
      </header>

      {/* Print-only compact summary */}
      <style>{`
        @media print {
          @page { size: A4; margin: 10mm 10mm 10mm 10mm; }
          html, body { font-size: 10.5px !important; }
          .card-surface { padding: 0 !important; margin: 0 !important; border: 0 !important; box-shadow: none !important; background: transparent !important; }
          h1, h2, h3 { margin: 0 !important; }
          section, .card-surface { page-break-inside: auto; }
        }
      `}</style>
      <div className="hidden print:block">

        <div className="flex items-start justify-between gap-4 border-b-2 border-black pb-3 mb-4">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.25em] text-gray-600">Motorcycle Doctors · Job Card</div>
            <h1 className="font-display text-2xl font-bold leading-tight">{j.title}</h1>
            <div className="text-xs text-gray-700 mt-1">
              {kindMeta.label}
              {j.estimated_hours ? ` · Est. ${j.estimated_hours}h` : ""}
              {" · "}Booked {j.scheduled_at ? new Date(j.scheduled_at).toLocaleDateString() : "—"}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-[9px] uppercase tracking-[0.25em] text-gray-500">Job No.</div>
            <div className="font-display text-4xl font-extrabold leading-none">#{j.job_number}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-xs mb-4">
          <div className="border border-gray-400 rounded p-2">
            <div className="text-[9px] uppercase tracking-wider text-gray-500 mb-1">Vehicle</div>
            <div className="font-bold">{fullBike(j.motorcycles as any)}</div>
            <div className="grid grid-cols-2 gap-x-2 mt-1 text-[11px]">
              <div><span className="text-gray-500">Rego:</span> {(j.motorcycles as any)?.rego ?? "—"}</div>
              <div><span className="text-gray-500">Year:</span> {(j.motorcycles as any)?.year ?? "—"}</div>
              <div><span className="text-gray-500">VIN:</span> {(j.motorcycles as any)?.vin ?? "—"}</div>
              <div><span className="text-gray-500">Odo:</span> {(j.motorcycles as any)?.odometer ?? "—"}</div>
              <div><span className="text-gray-500">Cyl:</span> {cylinders}</div>
              <div><span className="text-gray-500">Colour:</span> {(j.motorcycles as any)?.color ?? "—"}</div>
            </div>
          </div>
          <div className="border border-gray-400 rounded p-2">
            <div className="text-[9px] uppercase tracking-wider text-gray-500 mb-1">Customer</div>
            <div className="font-bold">{j.customers?.first_name ?? ""} {j.customers?.last_name ?? ""}</div>
            <div className="text-[11px] mt-1">
              <div><span className="text-gray-500">Phone:</span> {j.customers?.phone ?? "—"}</div>
              <div><span className="text-gray-500">Email:</span> {j.customers?.email ?? "—"}</div>
            </div>
          </div>
        </div>

        {j.complaint && (
          <div className="border border-gray-400 rounded p-2 mb-4 text-xs">
            <div className="text-[9px] uppercase tracking-wider text-gray-500 mb-1">Customer Complaint / Instructions</div>
            <p className="whitespace-pre-wrap">{j.complaint}</p>
          </div>
        )}

        <div className="text-[9px] uppercase tracking-wider text-gray-500 mb-1">Instructions — follow checklist below</div>
      </div>

      {/* Hide-on-print sections wrapped via print:hidden on each card */}
      <div className="print:hidden">

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
            <div className="flex items-center gap-2 flex-wrap">
              {activeTimer ? (
                <LiveTimerButton startedAt={activeTimer.started_at} onStop={stopTimer} />
              ) : (
                <Button onClick={startTimer} className="gold-surface h-12 px-5 font-bold gap-2">
                  <Play className="h-4 w-4" /> Clock In
                </Button>

              )}
              {j.status !== "completed" && (
                <Button
                  onClick={async () => {
                    if (activeTimer) await stopTimer();
                    await setStatus("completed");
                  }}
                  className="h-12 px-5 font-bold gap-2 bg-green-600 hover:bg-green-700 text-white"
                >
                  <Check className="h-4 w-4" /> Finish Job
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
      </div>

      {/* Service Template */}
      <ServiceTemplateSection
        jobId={jobId}
        currentTemplateId={j.template_id}
        currentTitle={j.title}
        tasks={tasks.data ?? []}
        canEdit={canEdit}
        completion={completion}
          onToggleTask={(id: string, done: boolean) => toggleTask(id, done)}
        onNoteSaved={() => qc.invalidateQueries({ queryKey: ["job-tasks", jobId] })}
        onTemplateChanged={() => {
          qc.invalidateQueries({ queryKey: ["job", jobId] });
          qc.invalidateQueries({ queryKey: ["job-tasks", jobId] });
        }}
      />

      {/* Parts used (service-kind aware) */}
      {SERVICE_PARTS[kind].length > 0 && (
        <div className="print:hidden"><PartsSection
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
        /></div>
      )}

      {/* Valve clearance diagram for Full service — also prints as a worksheet page */}
      {kind === "full" && (
        <ValveClearanceSection
          jobId={jobId}
          cylinders={cylinders}
          canEdit={canEdit}
          data={((j.service_data as any) ?? {}).valves ?? {}}
          bike={j.motorcycles as any}
          onChanged={() => qc.invalidateQueries({ queryKey: ["job", jobId] })}
        />
      )}

      {/* Notes */}
      {(booking.data?.instructions || booking.data?.notes) && (
        <section className="card-surface p-4 border-l-4 border-primary/60">
          <div className="flex items-center gap-2 mb-2">
            <h2 className="font-display text-lg font-semibold">Instructions</h2>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">from book-in</span>
          </div>
          {booking.data?.instructions && (
            <p className="text-sm whitespace-pre-wrap">{booking.data.instructions}</p>
          )}
          {booking.data?.notes && (
            <div className="mt-2 pt-2 border-t border-border/40">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Internal notes</div>
              <p className="text-sm whitespace-pre-wrap">{booking.data.notes}</p>
            </div>
          )}
        </section>
      )}

      {/* Damage report (collision repair jobs) */}
      {kind === "collision" && (
        <DamageSection
          jobId={jobId}
          canEdit={canEdit}
          initialMarks={((j.service_data as any) ?? {}).damage_marks ?? []}
          onMarksChanged={() => qc.invalidateQueries({ queryKey: ["job", jobId] })}
        />
      )}


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
        <section className="card-surface p-4 print:hidden">
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Customer Complaint</div>
          <p className="text-sm whitespace-pre-wrap">{j.complaint}</p>
        </section>
      )}

      {canEdit && (
        <section className="card-surface p-4 print:hidden">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 className="font-display text-lg font-semibold">Invoice</h2>
              {existingInvoice.data ? (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {existingInvoice.data.invoice_number} · {existingInvoice.data.status} · ${Number(existingInvoice.data.total).toFixed(2)}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Generate an invoice from logged labour and parts used.
                </p>
              )}
            </div>
            <Button
              onClick={createInvoice}
              className="gold-surface h-11 px-4 font-bold gap-2"
            >
              <FileText className="h-4 w-4" />
              {existingInvoice.data ? "Open Invoice" : "Create Invoice"}
            </Button>
          </div>
        </section>
      )}

      <div className="flex justify-center pt-6 pb-2 no-print">
        <button
          onClick={() => window.print()}
          className="print-cta gold-surface inline-flex items-center gap-3 rounded-full px-8 py-4 font-display text-base font-bold uppercase tracking-wider shadow-lg"
        >
          <Printer className="h-5 w-5" />
          Print Job Card
        </button>
      </div>
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
      <span>Clock Out</span>
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
    <div className="py-0.5 print:py-1 print:break-inside-avoid">
      <button
        onClick={onToggle}
        disabled={!canEdit}
        className="w-full flex items-start gap-2 text-left group"
      >
        <Check
          className={`h-3 w-3 mt-0.5 shrink-0 transition-colors print:hidden ${
            task.is_done ? "text-status-ready" : "text-status-ready/70 group-hover:text-status-ready"
          }`}
          strokeWidth={3}
        />
        <span className="hidden print:inline-block h-3.5 w-3.5 mt-0.5 shrink-0 border border-black rounded-[2px]" />
        <span className={`text-xs leading-snug print:text-[13px] print:text-black ${task.is_done ? "text-muted-foreground line-through print:no-underline print:text-black" : "text-foreground"}`}>
          {task.label}
        </span>
      </button>
      {canEdit && (
        <div className="mt-0 pl-5 no-print">
          <input
            value={note}
            onChange={(e) => { setNote(e.target.value); setDirty(true); }}
            onBlur={() => dirty && saveNote()}
            onKeyDown={(e) => { if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur(); }}
            placeholder="Quick note…"
            maxLength={140}
            className="w-full bg-transparent border-0 border-b border-border/30 text-[11px] py-0 focus:outline-none focus:border-primary placeholder:text-muted-foreground/40"
          />
        </div>
      )}
      {!canEdit && note && <p className="mt-0 pl-5 text-[11px] text-muted-foreground italic">{note}</p>}
    </div>
  );
}

function ServiceTemplateSection({
  jobId, currentTemplateId, currentTitle, tasks, canEdit, completion,
  onToggleTask, onNoteSaved, onTemplateChanged,
}: {
  jobId: string;
  currentTemplateId: string | null;
  currentTitle: string;
  tasks: any[];
  canEdit: boolean;
  completion: number;
  onToggleTask: (id: string, done: boolean) => void;
  onNoteSaved: () => void;
  onTemplateChanged: () => void;
}) {
  const [switching, setSwitching] = useState<string | null>(null);

  const templates = useQuery({
    queryKey: ["service-templates-pick"],
    queryFn: async () => {
      const { data } = await supabase
        .from("service_templates")
        .select("id,name,description,tasks,estimated_hours")
        .eq("is_active", true)
        .order("sort_order");
      return (data ?? []).filter((t: any) =>
        ["Basic Service", "Standard Service", "Annual Service", "Full Service"].includes(t.name),
      );
    },
  });

  async function pickTemplate(tmpl: any) {
    if (!canEdit) return;
    if (tmpl.id === currentTemplateId) return;
    if (tasks.length > 0 && !confirm(`Switch template to "${tmpl.name}"? This will replace the task list.`)) return;
    setSwitching(tmpl.id);
    try {
      await supabase.from("job_tasks").delete().eq("job_id", jobId);
      const rows = ((tmpl.tasks as any[]) ?? []).map((t: any, i: number) => ({
        job_id: jobId, label: t.label, sort_order: i,
      }));
      if (rows.length) await supabase.from("job_tasks").insert(rows);
      await supabase.from("jobs").update({
        template_id: tmpl.id,
        title: tmpl.name,
        description: tmpl.description,
        estimated_hours: tmpl.estimated_hours,
      }).eq("id", jobId);
      toast.success(`Template set to ${tmpl.name}`);
      onTemplateChanged();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to switch template");
    } finally {
      setSwitching(null);
    }
  }

  const currentTmpl = (templates.data ?? []).find((t: any) => t.id === currentTemplateId);
  const currentKindLabel = currentTmpl ? currentTmpl.name.replace(" Service", "").toUpperCase() : currentTitle.toUpperCase();

  return (
    <section className="card-surface p-5 print:p-0 print:border-0 print:shadow-none print:bg-transparent">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5 print:hidden">
        {(templates.data ?? []).map((tmpl: any) => {
          const active = tmpl.id === currentTemplateId;
          return (
            <button
              key={tmpl.id}
              onClick={() => pickTemplate(tmpl)}
              disabled={!canEdit || switching === tmpl.id}
              className={`rounded-xl border p-2.5 text-center transition-all ${
                active
                  ? "border-primary bg-primary/10 shadow-[0_0_18px_-6px_oklch(0.81_0.13_82/0.6)]"
                  : "border-border hover:border-primary/40"
              } disabled:opacity-60`}
            >
              <div className="text-[10px] uppercase tracking-wider font-bold">
                {tmpl.name.replace(" Service", "")}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">{tmpl.estimated_hours ?? "—"}h</div>
              {switching === tmpl.id && <div className="text-[10px] text-muted-foreground">Switching…</div>}
            </button>
          );
        })}
      </div>

      <div className="flex items-baseline justify-between mb-1 print:hidden">
        <h2 className="font-display text-xl font-bold tracking-wide">{currentKindLabel}</h2>
        <span className="text-xs text-muted-foreground">
          {tasks.filter((t) => t.is_done).length}/{tasks.length} done · {completion}%
        </span>
      </div>
      {currentTmpl?.description && (
        <p className="text-sm text-primary mb-3 print:hidden">{currentTmpl.description}</p>
      )}

      <div className="h-1 rounded-full bg-muted overflow-hidden mb-4 print:hidden">
        <div className="h-full gold-surface transition-all" style={{ width: `${completion}%` }} />
      </div>

      {/* Print-only simple instruction list */}
      <div className="hidden print:block mb-2">
        <h2 className="font-display text-base font-bold uppercase tracking-wider border-b border-black pb-1 mb-2">
          {currentKindLabel} — Instructions
        </h2>
      </div>


      <div className="grid grid-cols-1 sm:grid-cols-2 print:grid-cols-3 gap-x-4 gap-y-0">
        {tasks.map((t) => (
          <TaskRow
            key={t.id}
            task={t}
            canEdit={canEdit}
            onToggle={() => onToggleTask(t.id, t.is_done)}
            onNoteSaved={onNoteSaved}
          />
        ))}
        {tasks.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">Pick a template above to load the checklist.</p>
        )}
      </div>

      {canEdit && (
        <AddCustomCheck
          jobId={jobId}
          nextOrder={tasks.length}
          onAdded={onNoteSaved}
        />
      )}
    </section>
  );
}

function AddCustomCheck({ jobId, nextOrder, onAdded }: { jobId: string; nextOrder: number; onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    const v = label.trim();
    if (!v) return;
    setSaving(true);
    const { error } = await supabase.from("job_tasks").insert({
      job_id: jobId, label: v, sort_order: nextOrder,
    } as any);
    setSaving(false);
    if (error) return toast.error(error.message);
    setLabel("");
    setOpen(false);
    onAdded();
  }

  if (!open) {
    return (
      <div className="mt-3 print:hidden">
        <button
          onClick={() => setOpen(true)}
          className="text-xs font-semibold text-primary inline-flex items-center gap-1 hover:underline"
        >
          <Plus className="h-3 w-3" /> Add custom check (e.g. final drive)
        </button>
      </div>
    );
  }
  return (
    <div className="mt-3 flex items-center gap-2 print:hidden">
      <Input
        autoFocus
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setOpen(false); }}
        placeholder="Custom check item…"
        className="h-9 text-sm"
      />
      <Button onClick={save} disabled={saving || !label.trim()} size="sm" className="gold-surface">
        <Check className="h-3.5 w-3.5 mr-1" /> Add
      </Button>
      <Button onClick={() => { setOpen(false); setLabel(""); }} variant="ghost" size="sm">
        <X className="h-3.5 w-3.5" />
      </Button>
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

      {canEdit && (
        <AddCustomPart jobId={jobId} onAdded={onChanged} />
      )}

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

function AddCustomPart({ jobId, onAdded }: { jobId: string; onAdded: () => void }) {
  const { user } = useCurrentUser();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [qty, setQty] = useState("1");
  const [price, setPrice] = useState("0");
  const [saving, setSaving] = useState(false);

  async function save() {
    const n = name.trim();
    const q = Number(qty);
    const p = Number(price);
    if (!n) return toast.error("Item name required");
    if (!q || q <= 0) return toast.error("Qty must be > 0");
    setSaving(true);
    const { error } = await supabase.from("parts").insert({
      job_id: jobId, name: n, quantity: q, cost: p, retail: p, added_by: user?.id,
    } as any);
    setSaving(false);
    if (error) return toast.error(error.message);
    setName(""); setQty("1"); setPrice("0"); setOpen(false);
    toast.success("Part added");
    onAdded();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-3 w-full rounded-lg border border-dashed border-primary/50 bg-primary/5 hover:bg-primary/10 px-3 py-2.5 text-sm font-semibold text-primary inline-flex items-center justify-center gap-2 transition-colors"
      >
        <Plus className="h-4 w-4" /> Add another part / fluid
      </button>
    );
  }
  return (
    <div className="mt-3 rounded-lg border border-primary/40 p-3 space-y-2 bg-primary/5">
      <div className="grid grid-cols-1 sm:grid-cols-[2fr_70px_90px_auto] gap-2">
        <Input autoFocus placeholder="Item name" value={name} onChange={(e) => setName(e.target.value)} className="h-9 text-sm" />
        <Input type="number" step="0.1" placeholder="Qty" value={qty} onChange={(e) => setQty(e.target.value)} className="h-9 text-sm" />
        <Input type="number" step="0.01" placeholder="$ Price" value={price} onChange={(e) => setPrice(e.target.value)} className="h-9 text-sm" />
        <div className="flex items-center gap-1">
          <Button onClick={save} disabled={saving} size="sm" className="gold-surface"><Check className="h-3.5 w-3.5" /></Button>
          <Button onClick={() => setOpen(false)} variant="ghost" size="sm"><X className="h-3.5 w-3.5" /></Button>
        </div>
      </div>
    </div>
  );
}

function ValveClearanceSection({ jobId, cylinders, canEdit, data, bike, onChanged }: {
  jobId: string; cylinders: number; canEdit: boolean; data: any; bike: any; onChanged: () => void;
}) {
  const [values, setValues] = useState<any>(data ?? {});
  const [saving, setSaving] = useState(false);
  useEffect(() => { setValues(data ?? {}); }, [data]);

  const intakePerCyl = 2;
  const exhaustPerCyl = 2;

  const spec = getValveSpec(bike?.make, bike?.model, bike?.year);

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
    <>
      {/* Screen / on-card section */}
      <section className="card-surface p-4 print:hidden">
        <div className="flex items-center gap-2 mb-1">
          <Wrench className="h-4 w-4 text-primary" />
          <h2 className="font-display text-lg font-semibold">Valve Clearance Check</h2>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          {cylinders}-cylinder engine. Record measured clearance in mm for each valve (intake & exhaust).
        </p>

        {/* Manufacturer recommendation */}
        <div className="mb-3 rounded-lg border border-primary/40 bg-primary/5 p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-1">
            Manufacturer recommendation {spec.generic && <span className="text-status-parts">· generic — verify manual</span>}
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-[10px] text-status-progress font-semibold">INTAKE (cold)</div>
              <div className="font-mono font-bold">{formatRange(spec.intake)}</div>
            </div>
            <div>
              <div className="text-[10px] text-destructive font-semibold">EXHAUST (cold)</div>
              <div className="font-mono font-bold">{formatRange(spec.exhaust)}</div>
            </div>
          </div>
          <div className="mt-1.5 text-[10px] text-muted-foreground">Source: {spec.source}{bike?.make ? ` · ${bike.make} ${bike.model ?? ""}${bike.year ? ` ${bike.year}` : ""}` : ""}</div>
          {spec.note && <div className="mt-1 text-[10px] text-status-parts">{spec.note}</div>}
        </div>

        <div className="rounded-xl border border-border bg-background/40 p-4 overflow-x-auto">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground text-center mb-3">
            Top-down view · INTAKE (top) / EXHAUST (bottom)
          </div>
          <div className="flex gap-4 min-w-fit justify-center">
            {Array.from({ length: cylinders }).map((_, c) => {
              const cyl = c + 1;
              return (
                <div
                  key={cyl}
                  className="rounded-2xl border-2 border-border bg-card/60 p-3 flex flex-col items-center gap-2"
                  style={{ minWidth: 150 }}
                >
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
                    Cyl {cyl}
                  </div>
                  {/* Intake row — two big circles */}
                  <div className="flex gap-2">
                    {Array.from({ length: intakePerCyl }).map((_, i) => (
                      <input
                        key={i}
                        disabled={!canEdit}
                        value={values[`c${cyl}_intake_${i}`] ?? ""}
                        onChange={(e) => set(cyl, "intake", i, e.target.value)}
                        placeholder="mm"
                        title={`Cyl ${cyl} Intake ${i + 1}`}
                        className="h-16 w-16 rounded-full bg-status-progress/15 border-2 border-status-progress/60 text-center text-sm font-mono font-bold focus:outline-none focus:border-status-progress focus:bg-status-progress/25 placeholder:text-status-progress/50 placeholder:font-normal"
                      />
                    ))}
                  </div>
                  {/* Spark plug center */}
                  <div className="h-4 w-4 rounded-full bg-muted-foreground/30 border border-muted-foreground/50" title="Spark plug" />
                  {/* Exhaust row — two big circles */}
                  <div className="flex gap-2">
                    {Array.from({ length: exhaustPerCyl }).map((_, i) => (
                      <input
                        key={i}
                        disabled={!canEdit}
                        value={values[`c${cyl}_exhaust_${i}`] ?? ""}
                        onChange={(e) => set(cyl, "exhaust", i, e.target.value)}
                        placeholder="mm"
                        title={`Cyl ${cyl} Exhaust ${i + 1}`}
                        className="h-16 w-16 rounded-full bg-destructive/15 border-2 border-destructive/60 text-center text-sm font-mono font-bold focus:outline-none focus:border-destructive focus:bg-destructive/25 placeholder:text-destructive/50 placeholder:font-normal"
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="mt-3 flex items-center gap-3 text-[10px] text-muted-foreground flex-wrap">
          <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-status-progress/40 border border-status-progress/60" /> Intake</span>
          <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-destructive/40 border border-destructive/60" /> Exhaust</span>
          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-muted-foreground/40 border border-muted-foreground/60" /> Spark plug</span>
          <span className="ml-auto">Spec: I {formatRange(spec.intake)} · E {formatRange(spec.exhaust)}</span>
        </div>
        {canEdit && (
          <div className="mt-3 flex justify-end">
            <Button onClick={save} disabled={saving} className="gold-surface">{saving ? "Saving…" : "Save measurements"}</Button>
          </div>
        )}
      </section>

      {/* Print-only worksheet — forced onto its own page */}
      <ValveClearancePrintSheet bike={bike} cylinders={cylinders} values={values} spec={spec} />
    </>
  );
}

function ValveClearancePrintSheet({
  bike, cylinders, values, spec,
}: {
  bike: any; cylinders: number; values: any; spec: ValveSpec;
}) {
  return (
    <div className="hidden print:block mt-4" style={{ pageBreakBefore: "always", breakBefore: "page" }}>
      <div className="flex items-center justify-between gap-3 border-b-2 border-black pb-1 mb-2">
        <div className="min-w-0">
          <div className="text-[9px] uppercase tracking-[0.25em] text-gray-600">Valve Clearance Worksheet</div>
          <h1 className="font-display text-base font-bold leading-tight">
            {bike?.make ?? ""} {bike?.model ?? ""} {bike?.year ?? ""} · {cylinders}-cyl · Rego {bike?.rego ?? "—"}
          </h1>
        </div>
        <div className="text-right shrink-0 text-[10px]">
          <b>Spec (cold)</b> · I <span className="font-mono">{formatRange(spec.intake)}</span> · E <span className="font-mono">{formatRange(spec.exhaust)}</span>
          <div className="text-[8px] text-gray-500">{spec.generic ? "Generic — verify manual · " : ""}{spec.source}</div>
        </div>
      </div>

      {spec.note && (
        <div className="text-[9px] text-gray-700 mb-2"><b>Note:</b> {spec.note}</div>
      )}

      <div className="text-[9px] uppercase tracking-[0.2em] text-gray-600 text-center mb-1">
        Top-down · INTAKE top / EXHAUST bottom · write measured mm inside each circle
      </div>
      <div className="flex gap-2 justify-center flex-wrap mb-2">
        {Array.from({ length: cylinders }).map((_, c) => {
          const cyl = c + 1;
          return (
            <div key={cyl} className="border border-gray-400 rounded-xl p-1.5 flex flex-col items-center gap-1" style={{ minWidth: 96 }}>
              <div className="text-[8px] uppercase tracking-wider text-gray-700 font-bold">Cyl {cyl}</div>
              <div className="flex gap-1">
                {Array.from({ length: 2 }).map((_, i) => {
                  const v = values?.[`c${cyl}_intake_${i}`] ?? "";
                  return (
                    <div key={i} className="h-10 w-10 rounded-full border-2 border-gray-700 flex items-center justify-center font-mono text-[10px] font-bold bg-white">
                      {v || ""}
                    </div>
                  );
                })}
              </div>
              <div className="h-2 w-2 rounded-full border border-gray-600 bg-gray-200" />
              <div className="flex gap-1">
                {Array.from({ length: 2 }).map((_, i) => {
                  const v = values?.[`c${cyl}_exhaust_${i}`] ?? "";
                  return (
                    <div key={i} className="h-10 w-10 rounded-full border-2 border-black flex items-center justify-center font-mono text-[10px] font-bold bg-white">
                      {v || ""}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-3 text-[9px] text-gray-700 mt-2 pt-1 border-t border-gray-300">
        <span>New shim = Current + (Measured − Target). Target = mid-spec.</span>
        <span>Technician: ______________  Date: ___ / ___ / ______</span>
      </div>
    </div>
  );
}
