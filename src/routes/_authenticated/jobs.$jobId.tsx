/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { PrintPreview } from "@/components/PrintPreview";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { STATUS_META, STATUS_ORDER, formatMinutes, fullBike, initials } from "@/lib/format";
import { useCurrentUser } from "@/hooks/use-current-user";
import { logJobEvent } from "@/lib/job-events";
import { InspectionPanel } from "@/components/job/InspectionPanel";
import { AddToLibraryDialog } from "@/components/job/AddToLibraryDialog";
import { JobTimeline } from "@/components/job/JobTimeline";
import { ServiceTypeEditor } from "@/components/job/ServiceTypeEditor";
import { ShiftClockCard } from "@/components/job/ShiftClockCard";
import { AssignedTechnicianCard } from "@/components/job/AssignedTechnicianCard";
import { JobTechnicalBrief } from "@/components/job/JobTechnicalBrief";


import { displayCustomerName } from "@/lib/display";

import { toast } from "sonner";
import {
  ArrowLeft,
  Play,
  Square,
  User,
  Bike as BikeIcon,
  ChevronDown,
  Check,
  Droplet,
  Wrench,
  Package,
  Plus,
  X,
  FileText,
  Sparkles,
  BookOpen,
  Printer,
  Trash2,
  Pencil,
  CheckCircle2,
  RotateCcw,
} from "lucide-react";
import { detectServiceKind, KIND_META, SERVICE_PARTS } from "@/lib/service-kinds";
import WorkPerformedSection, { readWorkPerformed } from "@/components/job/WorkPerformedSection";
import { getValveSpec, formatRange, type ValveSpec } from "@/lib/valve-specs";
import { valveSheetHtml } from "@/lib/valve-sheet-html";
import { FrontArrow } from "@/components/job/FrontArrow";
import {
  fetchSavedValveSpec,
  upsertSavedValveSpec,
  resolveValveSpec,
} from "@/lib/valve-spec-store";
import { DamageSection } from "@/components/DamageSection";
import logoAsset from "@/assets/motorcycle-doctors-logo.png.asset.json";

// Debounced auto-save: fires `save` ~800ms after `value` stops changing.
// `enabled` guards against saving before the user actually edits (e.g. initial hydration).
function useAutoSave<T>(
  value: T,
  enabled: boolean,
  save: () => unknown | Promise<unknown>,
  delay = 800,
) {
  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(() => {
    if (!enabled) return;
    const t = setTimeout(() => {
      void saveRef.current();
    }, delay);
    return () => clearTimeout(t);
  }, [value, enabled, delay]);
}

export const Route = createFileRoute("/_authenticated/jobs/$jobId")({
  component: JobDetail,
});

function JobDetail() {
  const { jobId } = Route.useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { user, isAdmin, isTechnician } = useCurrentUser();

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
    queryFn: async () =>
      (await supabase.from("job_tasks").select("*").eq("job_id", jobId).order("sort_order")).data ??
      [],
  });
  const notes = useQuery({
    queryKey: ["job-notes", jobId],
    queryFn: async () => {
      const { data } = await supabase
        .from("job_notes")
        .select("*")
        .eq("job_id", jobId)
        .order("created_at", { ascending: false });
      const ids = [...new Set((data ?? []).map((n) => n.author_id))];
      const { data: profs } = ids.length
        ? await supabase.from("profiles").select("id, full_name").in("id", ids)
        : { data: [] as any[] };
      const map = new Map<string, string>();
      (profs ?? []).forEach((p: any) => map.set(p.id, p.full_name));
      return (data ?? []).map((n) => ({ ...n, author_name: map.get(n.author_id) ?? "Staff" }));
    },
  });
  const time = useQuery({
    queryKey: ["job-time", jobId],
    queryFn: async () =>
      (await supabase.from("time_entries").select("*").eq("job_id", jobId)).data ?? [],
  });
  const techProfile = useQuery({
    queryKey: ["job-tech", job.data?.technician_id],
    enabled: !!job.data?.technician_id,
    queryFn: async () =>
      (
        await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", job.data!.technician_id!)
          .maybeSingle()
      ).data,
  });
  const partsUsed = useQuery({
    queryKey: ["job-parts", jobId],
    queryFn: async () =>
      (await supabase.from("parts").select("*").eq("job_id", jobId).order("created_at")).data ?? [],
  });
  const existingInvoice = useQuery({
    queryKey: ["job-invoice", jobId],
    queryFn: async () =>
      (
        await supabase
          .from("invoices")
          .select("id, invoice_number, status, total")
          .eq("job_id", jobId)
          .maybeSingle()
      ).data,
  });
  const booking = useQuery({
    queryKey: ["job-booking", jobId],
    queryFn: async () =>
      (
        await supabase
          .from("bookings")
          .select("id, notes, complaints, instructions, service_type, service_type_other")
          .eq("job_id", jobId)
          .maybeSingle()
      ).data,
  });
  const pendingApproval = useQuery({
    queryKey: ["job-approval-pending", jobId],
    queryFn: async () =>
      (
        await supabase
          .from("job_approval_requests")
          .select("id")
          .eq("job_id", jobId)
          .eq("status", "pending")
          .maybeSingle()
      ).data,
  });
  const hasPendingApproval = !!pendingApproval.data;

  /** Approved extra work (findings the customer said yes to) — printed on the job card. */
  const approvedFindings = useQuery({
    queryKey: ["job-approved-findings", jobId],
    queryFn: async () =>
      (
        await supabase
          .from("job_inspection_findings")
          .select(
            "id, title, description, category, severity, recommended_action, estimated_labour, estimated_parts_cost, decision_note, updated_at",
          )
          .eq("job_id", jobId)
          .eq("status", "approved")
          .order("created_at", { ascending: true })
      ).data ?? [],
  });
  const approvalDecisions = useQuery({
    queryKey: ["job-approval-approved", jobId],
    queryFn: async () =>
      (
        await supabase
          .from("job_approval_requests")
          .select("id, decision, customer_contact_method, resolution_note, resolved_at")
          .eq("job_id", jobId)
          .eq("status", "resolved")
          .order("resolved_at", { ascending: true })
      ).data ?? [],
  });

  const activeTimer = useMemo(
    () => (time.data ?? []).find((t) => !t.ended_at && t.technician_id === user?.id),
    [time.data, user],
  );
  const totalMinutes = useMemo(
    () =>
      (time.data ?? []).reduce(
        (s, t) =>
          s +
          (t.minutes ??
            (t.ended_at
              ? Math.round((+new Date(t.ended_at) - +new Date(t.started_at)) / 60000)
              : 0)),
        0,
      ),
    [time.data],
  );

  const [previewOpen, setPreviewOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [completingAll, setCompletingAll] = useState(false);
  const [reversingAll, setReversingAll] = useState(false);
  const [showReference, setShowReference] = useState(false);
  const jobRef = useRef<HTMLDivElement>(null);

  /** Mark the job, its booking and any loan bike as fully completed everywhere. */
  async function completeEverything() {
    setCompletingAll(true);
    try {
      const { error } = await supabase
        .from("jobs")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", jobId);
      if (error) throw error;
      const { data: bk } = await supabase
        .from("bookings")
        .select("id, loan_bike_id, loan_bike_returned_at")
        .eq("job_id", jobId)
        .maybeSingle();
      if (bk?.id) {
        await supabase
          .from("bookings")
          .update({
            status: "completed",
            ...(bk.loan_bike_id && !bk.loan_bike_returned_at
              ? { loan_bike_returned_at: new Date().toISOString() }
              : {}),
          })
          .eq("id", bk.id);
      }
      [
        ["job", jobId],
        ["jobs"],
        ["my-jobs"],
        ["my-bookings"],
        ["dashboard-jobs"],
        ["dashboard-counts"],
        ["calendar-bookings"],
        ["bookings"],
        ["loan-bikes"],
        ["loan-bikes-active-assignments"],
      ].forEach((key) => qc.invalidateQueries({ queryKey: key as string[] }));
      toast.success("Job completed — marked across the calendar and boards");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to complete job");
    } finally {
      setCompletingAll(false);
    }
  }

  /** Reverse the completed status in case it was pressed by mistake. */
  async function reverseCompleteEverything() {
    setReversingAll(true);
    try {
      const { error } = await supabase
        .from("jobs")
        .update({ status: "in_progress", completed_at: null })
        .eq("id", jobId);
      if (error) throw error;
      const { data: bk } = await supabase
        .from("bookings")
        .select("id, loan_bike_id, loan_bike_returned_at")
        .eq("job_id", jobId)
        .maybeSingle();
      if (bk?.id) {
        await supabase
          .from("bookings")
          .update({
            status: "in_progress",
            ...(bk.loan_bike_id && bk.loan_bike_returned_at ? { loan_bike_returned_at: null } : {}),
          })
          .eq("id", bk.id);
      }
      [
        ["job", jobId],
        ["jobs"],
        ["my-jobs"],
        ["my-bookings"],
        ["dashboard-jobs"],
        ["dashboard-counts"],
        ["calendar-bookings"],
        ["bookings"],
        ["loan-bikes"],
        ["loan-bikes-active-assignments"],
      ].forEach((key) => qc.invalidateQueries({ queryKey: key as string[] }));
      toast.success("Completion reversed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reverse completion");
    } finally {
      setReversingAll(false);
    }
  }

  /** Admin-only: permanently delete this job card and unlink it from its booking. */
  async function deleteJob() {
    if (!confirm("Delete this job card permanently? This cannot be undone.")) return;
    setDeleting(true);
    // Unlink the booking first so it returns to the day board instead of dangling.
    await supabase.from("bookings").update({ job_id: null }).eq("job_id", jobId);
    const { error } = await supabase.from("jobs").delete().eq("id", jobId);
    setDeleting(false);
    if (error) {
      return toast.error(
        error.message.includes("violates foreign key")
          ? "This job has an invoice linked. Delete the invoice first."
          : error.message,
      );
    }
    toast.success("Job card deleted");
    qc.invalidateQueries({ queryKey: ["jobs"] });
    qc.invalidateQueries({ queryKey: ["dashboard-jobs"] });
    qc.invalidateQueries({ queryKey: ["dashboard-counts"] });
    nav({ to: "/jobs" });
  }

  if (job.isLoading)
    return (
      <div className="card-surface p-8 text-center text-sm text-muted-foreground">Loading…</div>
    );
  if (!job.data)
    return (
      <div className="card-surface p-8 text-center text-sm text-muted-foreground">
        Job not found.
      </div>
    );

  const j = job.data;
  const meta = STATUS_META[j.status];
  const canEdit = isAdmin || isTechnician || j.technician_id === user?.id;
  // Any technician may record bike data (km, rego, WOF) even if the job isn't assigned to them.
  const canEditBike = canEdit || isTechnician;
  const kind = detectServiceKind(j.title);
  const kindMeta = KIND_META[kind];
  const cylinders = Math.max(1, Math.min(6, (j.motorcycles as any)?.cylinders ?? 4));

  async function toggleTask(taskId: string, isDone: boolean) {
    if (!canEdit) return;
    const { error } = await supabase
      .from("job_tasks")
      .update({
        is_done: !isDone,
        done_by: !isDone ? user!.id : null,
        done_at: !isDone ? new Date().toISOString() : null,
      })
      .eq("id", taskId);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["job-tasks", jobId] });
  }

  async function setStatus(status: string) {
    if (status === "completed" && hasPendingApproval) {
      return toast.error("Customer approval is still pending — record the decision first.");
    }
    const patch: any = { status };
    if (status === "in_progress" && !j.started_at) patch.started_at = new Date().toISOString();
    if (status === "completed") patch.completed_at = new Date().toISOString();
    // If a tech picks up an unassigned job, claim it so RLS lets them update it.
    if (!isAdmin && !j.technician_id && user?.id) {
      patch.technician_id = user.id;
      if (!j.assigned_tech_id) patch.assigned_tech_id = user.id;
    }
    const { data, error } = await supabase.from("jobs").update(patch).eq("id", jobId).select("id");
    if (error) return toast.error(error.message);
    if (!data || data.length === 0) {
      return toast.error(
        "You don't have permission to update this job. Ask an admin to assign it to you.",
      );
    }
    toast.success(`Marked ${STATUS_META[status].label}`);
    logJobEvent(
      jobId,
      "status_changed",
      `Status changed to ${STATUS_META[status].label}`,
      { from: j.status, to: status },
      user?.id ?? null,
    );
    qc.invalidateQueries({ queryKey: ["job", jobId] });
    qc.invalidateQueries({ queryKey: ["job-events", jobId] });
    qc.invalidateQueries({ queryKey: ["job-approved-findings", jobId] });
    qc.invalidateQueries({ queryKey: ["job-approval-approved", jobId] });
    qc.invalidateQueries({ queryKey: ["jobs"] });
    qc.invalidateQueries({ queryKey: ["dashboard-jobs"] });
    qc.invalidateQueries({ queryKey: ["dashboard-counts"] });
  }

  async function startTimer() {
    if (!user) return;
    const ended = new Date();
    const { data: openEntries } = await supabase
      .from("time_entries")
      .select("id, started_at")
      .eq("technician_id", user.id)
      .is("ended_at", null);
    for (const entry of openEntries ?? []) {
      const minutes = Math.max(1, Math.round((+ended - +new Date(entry.started_at)) / 60000));
      const { error: closeError } = await supabase
        .from("time_entries")
        .update({ ended_at: ended.toISOString(), minutes })
        .eq("id", entry.id);
      if (closeError) return toast.error(closeError.message);
    }
    const { error } = await supabase
      .from("time_entries")
      .insert({ job_id: jobId, technician_id: user.id });
    if (error) return toast.error(error.message);
    // Also log a clock_in event so it appears on the Clock page and floating widget
    await supabase
      .from("clock_events")
      .insert({ user_id: user.id, event_type: "clock_in", job_id: jobId });
    if (j.status === "new" || j.status === "assigned") await setStatus("in_progress");
    qc.invalidateQueries({ queryKey: ["job-time", jobId] });
    qc.invalidateQueries({ queryKey: ["clock-events-floating", user.id] });
    qc.invalidateQueries({ queryKey: ["clock-floating-active-time-entry", user.id] });
    qc.invalidateQueries({ queryKey: ["clock-floating-job"] });
    qc.invalidateQueries({ queryKey: ["clock-events"] });
  }

  async function stopTimer() {
    if (!activeTimer || !user) return;
    const ended = new Date();
    const minutes = Math.max(1, Math.round((+ended - +new Date(activeTimer.started_at)) / 60000));
    const { error } = await supabase
      .from("time_entries")
      .update({ ended_at: ended.toISOString(), minutes })
      .eq("id", activeTimer.id);
    if (error) return toast.error(error.message);
    await supabase
      .from("clock_events")
      .insert({ user_id: user.id, event_type: "clock_out", job_id: jobId });
    qc.invalidateQueries({ queryKey: ["job-time", jobId] });
    qc.invalidateQueries({ queryKey: ["clock-events-floating", user.id] });
    qc.invalidateQueries({ queryKey: ["clock-floating-active-time-entry", user.id] });
    qc.invalidateQueries({ queryKey: ["clock-floating-job"] });
    qc.invalidateQueries({ queryKey: ["clock-events"] });
    toast.success(`Logged ${formatMinutes(minutes)}`);
  }

  const completion =
    tasks.data && tasks.data.length
      ? Math.round((tasks.data.filter((t) => t.is_done).length / tasks.data.length) * 100)
      : 0;

  // $130/hr GST-inclusive (NZ 15%). Stored amounts on the invoice are inc-GST;
  // the GST line on the invoice shows the embedded component.
  const LABOUR_RATE = 130;
  async function createInvoice() {
    if (!user) return;
    if (existingInvoice.data) {
      nav({ to: "/invoices/$invoiceId", params: { invoiceId: existingInvoice.data.id } });
      return;
    }
    // Labour is billed from the actual clocked time on the job.
    // Preset/estimated hours are only a suggestion and are never billed automatically.
    const trackedHours = totalMinutes / 60;
    const workPerformed = readWorkPerformed(j.service_data);
    const billedHours = trackedHours;
    const labour = Math.round(billedHours * LABOUR_RATE * 100) / 100;

    const parts = (partsUsed.data ?? []).reduce(
      (s, p: any) =>
        s +
        Number(p.retail ?? 0) * Number(p.quantity ?? 1) * (1 - Number(p.discount_pct ?? 0) / 100),
      0,
    );
    const subtotal = labour + parts; // inc GST
    const gst = Math.round(((subtotal * 0.15) / 1.15) * 100) / 100; // embedded GST
    const total = Math.round(subtotal * 100) / 100;
    const year = new Date().getFullYear();
    const { data: last } = await supabase
      .from("invoices")
      .select("invoice_number")
      .like("invoice_number", `MCD-${year}-%`)
      .order("invoice_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextSeq = last?.invoice_number ? Number(last.invoice_number.split("-").pop()) + 1 : 1;
    const invoice_number = `MCD-${year}-${String(nextSeq).padStart(5, "0")}`;
    const { data, error } = await supabase
      .from("invoices")
      .insert({
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
        snapshot: {
          work_performed_hours_added: true,
          labour_desc: workPerformed.length
            ? workPerformed
                .map((w) => (w.detail ? `${w.title}\n${w.detail}` : w.title))
                .join("\n\n")
            : undefined,
        } as any,
      })

      .select("id, invoice_number")
      .maybeSingle();
    if (error) return toast.error(error.message);
    toast.success(`Invoice ${data?.invoice_number} created`);
    qc.invalidateQueries({ queryKey: ["job-invoice", jobId] });
    if (data?.id) nav({ to: "/invoices/$invoiceId", params: { invoiceId: data.id } });
  }

  return (
    <div ref={jobRef} className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5 items-start jobcard-print">
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 12mm; }
          html, body {
            background: #fff !important;
            color: #000 !important;
            width: auto !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          body * { visibility: hidden !important; }
          .jobcard-print, .jobcard-print * { visibility: visible !important; }
          .jobcard-print {
            position: static !important;
            display: block !important;
            width: auto !important;
            max-width: none !important;
            margin: 0 !important;
            padding: 0 !important;
            box-sizing: border-box;
          }
          .jobcard-print img { max-width: 100% !important; }
          .jobcard-print .card-surface { box-shadow: none !important; border-color: #d1d5db !important; background: #fff !important; }
          .no-print, .no-print * { display: none !important; }
        }
        .print-cta:hover { transform: translateY(-1px); transition: transform 0.15s ease-out; }
      `}</style>
      <div className="space-y-5 min-w-0">
      <header className="no-print space-y-3">
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={() => nav({ to: "/jobs" })}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Jobs
          </button>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setPreviewOpen(true)}
              variant="outline"
              size="sm"
              className="gap-1.5 h-8 px-2.5"
            >
              <Printer className="h-4 w-4" />
              <span className="hidden sm:inline">Preview & print</span>
            </Button>
            {j.status === "completed" ? (
              <Button
                onClick={() => {
                  if (
                    confirm(
                      "Reverse completion? This will set the job and booking back to In progress.",
                    )
                  ) {
                    void reverseCompleteEverything();
                  }
                }}
                size="sm"
                disabled={reversingAll}
                variant="outline"
                className="gap-1.5 h-8 px-2.5 border-amber-500/50 text-amber-400 hover:bg-amber-500/10 hover:text-amber-300"
              >
                <RotateCcw className="h-4 w-4" />
                <span className="hidden sm:inline">
                  {reversingAll ? "Reversing…" : "Reverse complete"}
                </span>
              </Button>
            ) : (
              <Button
                onClick={completeEverything}
                size="sm"
                disabled={completingAll}
                className="gap-1.5 h-8 px-2.5 bg-green-600 hover:bg-green-500 text-white"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span className="hidden sm:inline">
                  {completingAll ? "Completing…" : "Mark completed"}
                </span>
              </Button>
            )}
            {isAdmin && (
              <Button
                onClick={deleteJob}
                variant="outline"
                size="sm"
                disabled={deleting}
                className="gap-1.5 h-8 px-2.5 border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
                <span className="hidden sm:inline">{deleting ? "Deleting…" : "Delete"}</span>
              </Button>
            )}
            <StatusDropdown current={j.status} onChange={setStatus} />
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowReference((s) => !s)}
              className="gap-1.5 h-8 px-2.5"
            >
              <BookOpen className="h-4 w-4" />
              <span className="hidden sm:inline">Reference</span>
            </Button>
          </div>
        </div>
        <div className="min-w-0">
          <div className="text-[0.625rem] uppercase tracking-[0.25em] text-muted-foreground flex flex-wrap items-center gap-2">
            <span>Job #{j.job_number}</span>
            <span
              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[0.625rem] font-bold uppercase tracking-wider ${kindMeta.cls}`}
            >
              {kindMeta.label}
            </span>
          </div>
          <ServiceTypeEditor
            jobId={jobId}
            title={j.title}
            bookingId={(booking.data as any)?.id ?? null}
            bookingServiceType={(booking.data as any)?.service_type ?? null}
            bookingServiceTypeOther={(booking.data as any)?.service_type_other ?? null}
            canEdit={canEdit}
            onSaved={() => {
              qc.invalidateQueries({ queryKey: ["job", jobId] });
              qc.invalidateQueries({ queryKey: ["job-booking", jobId] });
              qc.invalidateQueries({ queryKey: ["calendar-bookings"] });
            }}
          />
        </div>
      </header>

      {showReference && (
        <div className="card-surface p-4 no-print">
          <div className="flex items-center justify-between gap-3 mb-2">
            <h3 className="font-display text-sm font-semibold uppercase tracking-wider">
              Status reference
            </h3>
            <button
              onClick={() => setShowReference(false)}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Close reference"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            {STATUS_ORDER.map((s) => {
              const m = STATUS_META[s];
              return (
                <div key={s} className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${m.dot}`} />
                  <span className="font-semibold">{m.label}:</span>
                  <span className="text-muted-foreground">
                    {s === "new" && "Booked, not started"}
                    {s === "assigned" && "Technician assigned"}
                    {s === "in_progress" && "Work actively happening"}
                    {s === "waiting_parts" && "Waiting on parts"}
                    {s === "waiting_approval" && "Customer approval needed"}
                    {s === "ready_for_pickup" && "Done, ready for customer"}
                    {s === "completed" && "Collected / paid"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Live timer / Labour logged — first thing technicians see */}
      <div className="card-surface p-4 print:hidden">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="text-[0.625rem] uppercase tracking-wider text-muted-foreground">
              Labour logged
            </div>
            <div className="font-display text-3xl font-bold gold-gradient-text">
              {formatMinutes(totalMinutes)}
            </div>
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
              {j.status !== "completed" && j.status !== "ready_for_pickup" && (
                <Button
                  onClick={async () => {
                    if (activeTimer) await stopTimer();
                    await setStatus("ready_for_pickup");
                  }}
                  className="h-12 px-5 font-bold gap-2 bg-green-600 hover:bg-green-700 text-white"
                >
                  <Check className="h-4 w-4" /> Finish Job
                </Button>
              )}
            </div>
          )}
        </div>
        <TimeEntriesEditor
          entries={time.data ?? []}
          jobId={jobId}
          currentUserId={user?.id}
          isAdmin={isAdmin}
        />
      </div>

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
          <div className="flex items-center gap-3 min-w-0">
            <img
              src={logoAsset.url}
              alt="Motorcycle Doctors"
              className="h-14 w-14 rounded-md object-contain bg-black/10 p-1"
            />
            <div className="min-w-0">
              <div className="text-[0.625rem] uppercase tracking-[0.25em] text-gray-600">
                Motorcycle Doctors · Job Card
              </div>
              <h1 className="font-display text-2xl font-bold leading-tight">{j.title}</h1>
              <div className="text-xs text-gray-700 mt-1">
                {kindMeta.label}
                {j.estimated_hours ? ` · Est. ${j.estimated_hours}h` : ""}
                {" · "}Booked {j.scheduled_at ? new Date(j.scheduled_at).toLocaleDateString() : "—"}
              </div>
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-[0.5625rem] uppercase tracking-[0.25em] text-gray-500">
              Job No.
            </div>
            <div className="font-display text-4xl font-extrabold leading-none">#{j.job_number}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-xs mb-4">
          <div className="border border-gray-400 rounded p-2">
            <div className="text-[0.5625rem] uppercase tracking-wider text-gray-500 mb-1">
              Vehicle
            </div>
            <div className="font-bold">{fullBike(j.motorcycles as any)}</div>
            <div className="grid grid-cols-2 gap-x-2 mt-1 text-[0.6875rem]">
              <div>
                <span className="text-gray-500">Rego:</span> {(j.motorcycles as any)?.rego ?? "—"}
              </div>
              <div>
                <span className="text-gray-500">Year:</span> {(j.motorcycles as any)?.year ?? "—"}
              </div>
              <div>
                <span className="text-gray-500">VIN:</span> {(j.motorcycles as any)?.vin ?? "—"}
              </div>
              <div>
                <span className="text-gray-500">Odo:</span>{" "}
                {(j.odometer ?? (j.motorcycles as any)?.mileage) != null
                  ? `${Number(j.odometer ?? (j.motorcycles as any)?.mileage).toLocaleString()} km`
                  : "—"}
              </div>
              <div>
                <span className="text-gray-500">Cyl:</span> {cylinders}
              </div>
              <div>
                <span className="text-gray-500">Colour:</span>{" "}
                {(j.motorcycles as any)?.color ?? "—"}
              </div>
              <div>
                <span className="text-gray-500">REGO exp:</span>{" "}
                {(j.motorcycles as any)?.rego_expiry
                  ? new Date((j.motorcycles as any).rego_expiry).toLocaleDateString()
                  : "—"}
              </div>
              <div>
                <span className="text-gray-500">WOF exp:</span>{" "}
                {(j.motorcycles as any)?.wof_expiry
                  ? new Date((j.motorcycles as any).wof_expiry).toLocaleDateString()
                  : "—"}
              </div>
            </div>
          </div>
          <div className="border border-gray-400 rounded p-2">
            <div className="text-[0.5625rem] uppercase tracking-wider text-gray-500 mb-1">
              Customer
            </div>
            <div className="font-bold">
              {j.customers?.first_name ?? ""} {j.customers?.last_name ?? ""}
            </div>
            <div className="text-[0.6875rem] mt-1">
              <div>
                <span className="text-gray-500">Phone:</span> {j.customers?.phone ?? "—"}
              </div>
              <div>
                <span className="text-gray-500">Email:</span> {j.customers?.email ?? "—"}
              </div>
            </div>
          </div>
        </div>

        {j.complaint && (
          <div className="border border-gray-400 rounded p-2 mb-4 text-xs">
            <div className="text-[0.5625rem] uppercase tracking-wider text-gray-500 mb-1">
              Customer Complaint / Instructions
            </div>
            <p className="whitespace-pre-wrap">{j.complaint}</p>
          </div>
        )}

        <div className="text-[0.5625rem] uppercase tracking-wider text-gray-500 mb-1">
          Instructions — follow checklist below
        </div>
      </div>

      {/* Hide-on-print sections wrapped via print:hidden on each card */}
      <div className="print:hidden">
        <AssignedTechnicianCard
          jobId={jobId}
          technicianId={j.technician_id ?? j.assigned_tech_id ?? null}
          canEdit={canEdit}
          onChanged={() => qc.invalidateQueries({ queryKey: ["job", jobId] })}
        />


        <div className="mt-4">
          <JobTechnicalBrief jobId={jobId} />
        </div>



        <div className="card-surface p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">

          <InfoRow
            icon={User}
            label="Customer"
            value={`${j.customers?.first_name ?? ""} ${j.customers?.last_name ?? ""}`}
            hint={j.customers?.phone}
          />
          <div className="flex items-start gap-3">
            <BikeIcon className="h-5 w-5 mt-0.5 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <div className="text-[0.625rem] uppercase tracking-wider text-muted-foreground">
                Motorcycle
              </div>
              <div className="font-semibold truncate">{fullBike(j.motorcycles as any)}</div>
              <div className="text-xs mt-0.5">
                <span className="text-muted-foreground">REGO:</span>{" "}
                <span className="font-mono font-bold tracking-wider text-foreground">
                  {(j.motorcycles as any)?.rego ?? "—"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Compact bike compliance card */}
        <BikeComplianceCard
          jobId={jobId}
          bikeId={(j.motorcycles as any)?.id}
          rego={(j.motorcycles as any)?.rego ?? null}
          regoExpiry={(j.motorcycles as any)?.rego_expiry ?? null}
          wofExpiry={(j.motorcycles as any)?.wof_expiry ?? null}
          odometer={j.odometer ?? null}
          bikeMileage={(j.motorcycles as any)?.mileage ?? null}
          canEdit={canEditBike}
          onSaved={() => qc.invalidateQueries({ queryKey: ["job", jobId] })}
        />
      </div>

      {/* Book-in instructions — visible on screen AND on the printed job card */}
      {booking.data?.id && (
        <InstructionsSection
          bookingId={booking.data.id}
          instructions={booking.data?.instructions ?? ""}
          notes={booking.data?.notes ?? ""}
          canEdit={canEdit}
          onSaved={() => qc.invalidateQueries({ queryKey: ["job-booking", jobId] })}
        />
      )}

      <div className="print:hidden">
        {/* Inspection & approval — right after instructions */}
        {canEdit && user && (
          <div className="no-print">
            <InspectionPanel
              jobId={jobId}
              jobNumber={j.job_number}
              jobStartedAt={j.started_at}
              customerName={displayCustomerName(j.customers as any)}
              isAdmin={isAdmin || isTechnician}
              userId={user.id}
              onJobChanged={() => {
                qc.invalidateQueries({ queryKey: ["job", jobId] });
                qc.invalidateQueries({ queryKey: ["job-approval-pending", jobId] });
                qc.invalidateQueries({ queryKey: ["job-events", jobId] });
                qc.invalidateQueries({ queryKey: ["job-approved-findings", jobId] });
                qc.invalidateQueries({ queryKey: ["job-approval-approved", jobId] });
                qc.invalidateQueries({ queryKey: ["notifications"] });
                qc.invalidateQueries({ queryKey: ["dashboard-counts"] });
              }}
            />
          </div>
        )}

        {/* Shift clock — technicians can clock in without leaving the job card */}
        {isTechnician && user && <ShiftClockCard userId={user.id} jobId={jobId} />}
      </div>

      {/* Customer-approved extra work — right below the clock-in area */}
      {(approvedFindings.data?.length ?? 0) > 0 && (
          <section
            data-print-section="approvals"
            className="card-surface p-4 border-l-4 border-emerald-500/70"
          >
            <div className="flex items-center gap-2 mb-2">
              <h2 className="font-display text-lg font-semibold">Approved by customer</h2>
              <span className="text-[0.625rem] uppercase tracking-wider text-muted-foreground">
                proceed with this work
              </span>
            </div>
            <ul className="space-y-2">
              {approvedFindings.data!.map((f) => (
                <li key={f.id} className="border-t border-border/40 pt-2 first:border-0 first:pt-0">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm font-semibold">{f.title}</span>
                    {(f.estimated_labour || f.estimated_parts_cost) && (
                      <span className="text-[0.6875rem] text-muted-foreground whitespace-nowrap">
                        {f.estimated_labour ? `${f.estimated_labour} h` : ""}
                        {f.estimated_labour && f.estimated_parts_cost ? " · " : ""}
                        {f.estimated_parts_cost
                          ? `$${Number(f.estimated_parts_cost).toFixed(2)} parts`
                          : ""}
                      </span>
                    )}
                  </div>
                  {f.description && <p className="text-sm whitespace-pre-wrap">{f.description}</p>}
                  {f.recommended_action && (
                    <p className="text-xs text-muted-foreground">Action: {f.recommended_action}</p>
                  )}
                  {f.decision_note && (
                    <p className="text-xs italic text-muted-foreground">Note: {f.decision_note}</p>
                  )}
                </li>
              ))}
            </ul>
            {(approvalDecisions.data ?? []).some((d) => d.decision !== "declined_all") && (
              <div className="mt-3 pt-2 border-t border-border/40 space-y-1">
                {(approvalDecisions.data ?? [])
                  .filter((d) => d.decision !== "declined_all")
                  .map((d) => (
                    <p key={d.id} className="text-[0.6875rem] text-muted-foreground">
                      Approved {d.resolved_at ? new Date(d.resolved_at).toLocaleString() : ""}
                      {d.customer_contact_method ? ` · via ${d.customer_contact_method}` : ""}
                      {d.resolution_note ? ` · ${d.resolution_note}` : ""}
                    </p>
                  ))}
              </div>
            )}
          </section>
      )}

      {/* Work performed / additional work */}
      <WorkPerformedSection
        jobId={jobId}
        serviceData={(j.service_data as any) ?? {}}
        canEdit={canEdit}
        onChanged={() => qc.invalidateQueries({ queryKey: ["job", jobId] })}
      />


      {/* Parts used (service-kind aware) */}
      {(SERVICE_PARTS[kind].length > 0 || canEdit || (partsUsed.data ?? []).length > 0) && (
        <div data-print-section="parts">
          <div className="print:hidden">
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
          </div>
          {(partsUsed.data ?? []).length > 0 && (
            <div className="hidden print:block mt-3">
              <h2 className="font-display text-base font-bold uppercase tracking-wider border-b border-black pb-1 mb-2">
                Parts Used
              </h2>
              <table className="w-full text-[0.6875rem] border-collapse">
                <thead>
                  <tr className="border-b border-gray-400 text-left">
                    <th className="py-1 pr-2">Item</th>
                    <th className="py-1 pr-2 w-16 text-right">Qty</th>
                    <th className="py-1 pr-2 w-24">Code</th>
                    <th className="py-1 w-20 text-right">Unit</th>
                  </tr>
                </thead>
                <tbody>
                  {(partsUsed.data ?? []).map((p: any) => (
                    <tr key={p.id} className="border-b border-gray-200">
                      <td className="py-1 pr-2">{p.name ?? p.description ?? "—"}</td>
                      <td className="py-1 pr-2 text-right">{p.quantity ?? 1}</td>
                      <td className="py-1 pr-2">{p.sku ?? p.part_number ?? "—"}</td>
                      <td className="py-1 text-right">
                        {p.unit_price != null ? `$${Number(p.unit_price).toFixed(2)}` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
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


      {/* Damage report (collision repair jobs) */}
      {kind === "collision" && (
        <DamageSection
          jobId={jobId}
          canEdit={canEdit}
          initialMarks={((j.service_data as any) ?? {}).damage_marks ?? []}
          onMarksChanged={() => qc.invalidateQueries({ queryKey: ["job", jobId] })}
        />
      )}


      <div className="no-print">
        <JobTimeline jobId={jobId} />
      </div>


      {j.complaint && (
        <section className="card-surface p-4 print:hidden">
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
            Customer Complaint
          </div>
          <p className="text-sm whitespace-pre-wrap">{j.complaint}</p>
        </section>
      )}

      {isAdmin && (
        <section className="card-surface p-4 print:hidden">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 className="font-display text-lg font-semibold">Invoice</h2>
              {existingInvoice.data ? (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {existingInvoice.data.invoice_number} · {existingInvoice.data.status} · $
                  {Number(existingInvoice.data.total).toFixed(2)}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Generate an invoice from logged labour and parts used.
                </p>
              )}
            </div>
            <div className="flex gap-2 flex-wrap items-center">
              <AddToLibraryDialog
                jobId={jobId}
                motorcycleId={j.motorcycle_id}
                make={(j.motorcycles as any)?.make}
                model={(j.motorcycles as any)?.model}
                year={(j.motorcycles as any)?.year}
              />
              <Button
                variant="outline"
                className="h-11 px-4 font-bold gap-2"
                onClick={() =>
                  nav({ to: "/jobs/$jobId/invoice-draft", params: { jobId } })
                }
              >
                <Sparkles className="h-4 w-4" />
                Generate Invoice Draft
              </Button>
              <Button onClick={createInvoice} className="gold-surface h-11 px-4 font-bold gap-2">
                <FileText className="h-4 w-4" />
                {existingInvoice.data ? "Open Invoice" : "Create Invoice"}
              </Button>
            </div>

          </div>
        </section>
      )}

      <PrintPreview
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        title={`Job card #${j.job_number} — preview`}
        getPages={() => {
          const root = jobRef.current;
          if (!root) return [];
          const clone = root.cloneNode(true) as HTMLElement;
          clone.querySelector(".valve-print-page")?.remove();
          return [{ html: clone.outerHTML }];
        }}
        optionalPages={[
          {
            id: "valve",
            label: "Valve clearance diagram",
            defaultOn: kind === "full",
            orientation: "landscape",
            variantLabel: "Cylinders",
            defaultVariant: String(((j.service_data as any) ?? {}).valves?._cylinders || cylinders),
            variants: [1, 2, 3, 4, 6].map((n) => ({ value: String(n), label: `${n} cylinder` })),
            getHtml: (v) =>
              valveSheetHtml({
                cylinders: Number(v) || cylinders,
                bike: j.motorcycles as any,
                values: ((j.service_data as any) ?? {}).valves ?? {},
                intakeOnTop: ((j.service_data as any) ?? {}).valves?._intakeOnTop !== false,
                spec: getValveSpec(
                  (j.motorcycles as any)?.make,
                  (j.motorcycles as any)?.model,
                  (j.motorcycles as any)?.year,
                ),
              }),
          },
        ]}
        sections={[
          { id: "instructions", label: "Book-in instructions" },
          { id: "approvals", label: "Customer-approved work" },
          { id: "notes", label: "Job notes" },
          { id: "parts", label: "Parts used" },
          
        ]}
      />

      <div className="flex justify-center pt-6 pb-2 no-print">
        <button
          onClick={() => setPreviewOpen(true)}
          className="print-cta gold-surface inline-flex items-center gap-3 rounded-full px-8 py-4 font-display text-base font-bold uppercase tracking-wider shadow-lg"
        >
          <Printer className="h-5 w-5" />
          Print Job Card
        </button>
      </div>

      <section className="hidden print:block card-surface p-4" data-print-section="notes">
        <h2 className="font-display text-lg font-semibold mb-3">Notes</h2>
        <NotesList notes={notes.data ?? []} />
      </section>
    </div>

    <aside className="no-print lg:sticky lg:top-20 lg:self-start space-y-4 max-h-[calc(100vh-6rem)] overflow-y-auto">
      <section className="card-surface p-4">
        <h2 className="font-display text-lg font-semibold mb-3">Notes</h2>
        {canEdit && (
          <AddNote
            jobId={jobId}
            onAdded={() => qc.invalidateQueries({ queryKey: ["job-notes", jobId] })}
          />
        )}
        <div className="mt-3">
          <NotesList notes={notes.data ?? []} />
        </div>
      </section>
    </aside>
  </div>
);
}

function InfoRow({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: any;
  label: string;
  value: string;
  hint?: string | null;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="grid h-9 w-9 place-items-center rounded-lg bg-muted text-primary shrink-0">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <div className="text-[0.625rem] uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
        <div className="font-semibold truncate">{value || "—"}</div>
        {hint && <div className="text-xs text-muted-foreground truncate">{hint}</div>}
      </div>
    </div>
  );
}

function StatusDropdown({
  current,
  onChange,
  disabled,
}: {
  current: string;
  onChange: (s: string) => void;
  disabled?: boolean;
}) {
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
                  onClick={() => {
                    onChange(s);
                    setOpen(false);
                  }}
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
  const h = Math.floor(sec / 3600),
    m = Math.floor((sec % 3600) / 60),
    s = sec % 60;
  return (
    <Button
      onClick={onStop}
      className="bg-status-parts hover:bg-status-parts/90 text-white h-12 px-5 font-bold gap-2"
    >
      <Square className="h-4 w-4 fill-white" />
      <span className="tabular-nums">
        {String(h).padStart(2, "0")}:{String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
      </span>
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
    const { error } = await supabase
      .from("job_notes")
      .insert({ job_id: jobId, body, author_id: user.id });
    setSaving(false);
    if (error) return toast.error(error.message);
    setBody("");
    onAdded();
  }
  return (
    <div className="space-y-2">
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={2}
        placeholder="Add a note for the team…"
      />
      <Button
        onClick={save}
        disabled={saving || !body.trim()}
        className="gold-surface w-full sm:w-auto"
      >
        Post note
      </Button>
    </div>
  );
}

function NotesList({ notes }: { notes: any[] }) {
  return (
    <div className="space-y-2">
      {(notes ?? []).map((n: any) => (
        <div key={n.id} className="rounded-lg border border-border bg-background/40 p-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-muted text-[0.625rem] font-semibold">
              {initials(n.author_name)}
            </span>
            <span className="text-xs font-semibold">{n.author_name}</span>
            <span className="text-[0.625rem] text-muted-foreground">
              {new Date(n.created_at).toLocaleString()}
            </span>
          </div>
          <p className="text-sm whitespace-pre-wrap">{n.body}</p>
        </div>
      ))}
      {(!notes || notes.length === 0) && (
        <p className="text-sm text-muted-foreground">No notes yet.</p>
      )}
    </div>
  );
}

function TaskRow({
  task,
  canEdit,
  onToggle,
  onNoteSaved,
}: {
  task: any;
  canEdit: boolean;
  onToggle: () => void;
  onNoteSaved: () => void;
}) {
  const [note, setNote] = useState(task.note ?? "");
  const [dirty, setDirty] = useState(false);
  const [savedTick, setSavedTick] = useState(false);
  useEffect(() => {
    setNote(task.note ?? "");
    setDirty(false);
  }, [task.note]);

  async function saveNote() {
    const { error } = await supabase
      .from("job_tasks")
      .update({ note: note || null })
      .eq("id", task.id);
    if (error) return toast.error(error.message);
    setDirty(false);
    setSavedTick(true);
    setTimeout(() => setSavedTick(false), 1200);
    onNoteSaved();
  }

  useAutoSave(note, dirty && canEdit, saveNote);

  return (
    <div className="py-0.5 print:py-1 print:break-inside-avoid">
      <button
        onClick={onToggle}
        disabled={!canEdit}
        className="w-full flex items-start gap-2 text-left group"
      >
        <Check
          className={`h-3 w-3 mt-0.5 shrink-0 transition-colors print:hidden ${
            task.is_done
              ? "text-status-ready"
              : "text-status-ready/70 group-hover:text-status-ready"
          }`}
          strokeWidth={3}
        />
        <span className="hidden print:inline-block h-3.5 w-3.5 mt-0.5 shrink-0 border border-black rounded-[2px]" />
        <span
          className={`text-xs leading-snug print:text-[0.8125rem] print:text-black ${task.is_done ? "text-muted-foreground line-through print:no-underline print:text-black" : "text-foreground"}`}
        >
          {task.label}
        </span>
      </button>
      {canEdit && (
        <div className="mt-0 pl-5 no-print flex items-center gap-2">
          <input
            value={note}
            onChange={(e) => {
              setNote(e.target.value);
              setDirty(true);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (dirty) saveNote();
              }
            }}
            placeholder="Quick note…"
            maxLength={140}
            className="flex-1 bg-transparent border-0 border-b border-border/30 text-[0.6875rem] py-0 focus:outline-none focus:border-primary placeholder:text-muted-foreground/40"
          />
          {dirty && (
            <span className="text-[0.5625rem] uppercase tracking-wider text-muted-foreground/60">
              saving…
            </span>
          )}
          {!dirty && savedTick && (
            <span className="text-[0.5625rem] uppercase tracking-wider text-status-ready">
              ✓ saved
            </span>
          )}
        </div>
      )}

      {!canEdit && note && (
        <p className="mt-0 pl-5 text-[0.6875rem] text-muted-foreground italic">{note}</p>
      )}
      {note && (
        <p className="hidden print:block pl-5 text-[0.6875rem] text-black italic">↳ {note}</p>
      )}
    </div>
  );
}

function ServiceTemplateSection({
  jobId,
  currentTemplateId,
  currentTitle,
  tasks,
  canEdit,
  completion,
  onToggleTask,
  onNoteSaved,
  onTemplateChanged,
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
    if (
      tasks.length > 0 &&
      !confirm(`Switch template to "${tmpl.name}"? This will replace the task list.`)
    )
      return;
    setSwitching(tmpl.id);
    try {
      await supabase.from("job_tasks").delete().eq("job_id", jobId);
      const rows = ((tmpl.tasks as any[]) ?? []).map((t: any, i: number) => ({
        job_id: jobId,
        label: t.label,
        sort_order: i,
      }));
      if (rows.length) await supabase.from("job_tasks").insert(rows);
      await supabase
        .from("jobs")
        .update({
          template_id: tmpl.id,
          title: tmpl.name,
          description: tmpl.description,
          estimated_hours: tmpl.estimated_hours,
        })
        .eq("id", jobId);
      toast.success(`Template set to ${tmpl.name}`);
      onTemplateChanged();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to switch template");
    } finally {
      setSwitching(null);
    }
  }

  const currentTmpl = (templates.data ?? []).find((t: any) => t.id === currentTemplateId);
  const currentKindLabel = currentTmpl
    ? currentTmpl.name.replace(" Service", "").toUpperCase()
    : currentTitle.toUpperCase();

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
              <div className="text-[0.625rem] uppercase tracking-wider font-bold">
                {tmpl.name.replace(" Service", "")}
              </div>
              <div className="text-[0.625rem] text-muted-foreground mt-0.5">
                {tmpl.estimated_hours ?? "—"}h
              </div>
              {switching === tmpl.id && (
                <div className="text-[0.625rem] text-muted-foreground">Switching…</div>
              )}
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
          <p className="text-sm text-muted-foreground text-center py-4">
            Pick a template above to load the checklist.
          </p>
        )}
      </div>

      {canEdit && <AddCustomCheck jobId={jobId} nextOrder={tasks.length} onAdded={onNoteSaved} />}
    </section>
  );
}

function AddCustomCheck({
  jobId,
  nextOrder,
  onAdded,
}: {
  jobId: string;
  nextOrder: number;
  onAdded: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    const v = label.trim();
    if (!v) return;
    setSaving(true);
    const { error } = await supabase.from("job_tasks").insert({
      job_id: jobId,
      label: v,
      sort_order: nextOrder,
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
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") setOpen(false);
        }}
        placeholder="Custom check item…"
        className="h-9 text-sm"
      />
      <Button onClick={save} disabled={saving || !label.trim()} size="sm" className="gold-surface">
        <Check className="h-3.5 w-3.5 mr-1" /> Add
      </Button>
      <Button
        onClick={() => {
          setOpen(false);
          setLabel("");
        }}
        variant="ghost"
        size="sm"
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

function PartsSection({
  jobId,
  canEdit,
  serviceData,
  fields,
  parts,
  onChanged,
}: {
  jobId: string;
  canEdit: boolean;
  serviceData: any;
  fields: Array<{ key: string; label: string; category: string; unitHint?: string }>;
  parts: any[];
  onChanged: () => void;
}) {
  const [picker, setPicker] = useState<{ key: string; category: string; label: string } | null>(
    null,
  );
  const used = serviceData?.parts_used ?? {};

  async function clearField(key: string) {
    const next = { ...used };
    delete next[key];
    const { error } = await supabase
      .from("jobs")
      .update({ service_data: { ...serviceData, parts_used: next } })
      .eq("id", jobId);
    if (error) return toast.error(error.message);
    onChanged();
  }

  async function updateQty(key: string, qty: number) {
    const current = used[key];
    if (!current) return;
    const next = { ...used, [key]: { ...current, quantity: qty } };
    await supabase
      .from("jobs")
      .update({ service_data: { ...serviceData, parts_used: next } })
      .eq("id", jobId);
    onChanged();
  }

  return (
    <section className="card-surface p-4">
      <div className="flex items-center gap-2 mb-3">
        <Droplet className="h-4 w-4 text-primary" />
        <h2 className="font-display text-lg font-semibold">Parts & Fluids Used</h2>
      </div>
      {fields.length === 0 && (
        <p className="mb-3 text-xs text-muted-foreground">
          No preset fluids for this service type — add any parts or extra service items used below.
        </p>
      )}
      <div className="space-y-2">
        {fields.map((f) => {
          const u = used[f.key];
          return (
            <div key={f.key} className="rounded-lg border border-border p-3">
              <div className="flex items-center gap-2 justify-between">
                <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                  {f.label}
                </div>
                {canEdit &&
                  (u ? (
                    <button
                      onClick={() => clearField(f.key)}
                      className="text-[0.625rem] text-destructive flex items-center gap-1"
                    >
                      <X className="h-3 w-3" /> Remove
                    </button>
                  ) : (
                    <button
                      onClick={() =>
                        setPicker({ key: f.key, category: f.category, label: f.label })
                      }
                      className="text-[0.6875rem] font-semibold text-primary flex items-center gap-1 hover:underline"
                    >
                      <Plus className="h-3 w-3" /> Pick from inventory
                    </button>
                  ))}
              </div>
              {u ? (
                <div className="mt-2 flex items-center gap-2 flex-wrap">
                  <span className="grid h-9 w-9 place-items-center rounded-md bg-muted text-primary">
                    <Package className="h-4 w-4" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate">{u.name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {[u.brand, u.type].filter(Boolean).join(" · ")}
                    </div>
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
                    <span className="text-xs text-muted-foreground">
                      {u.unit || f.unitHint || ""}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="mt-1 text-sm text-muted-foreground italic">Not recorded yet.</div>
              )}
            </div>
          );
        })}
      </div>

      {canEdit && <AddCustomPart jobId={jobId} onAdded={onChanged} />}

      {parts.length > 0 && (
        <div className="mt-4 pt-3 border-t border-border">
          <div className="text-[0.625rem] uppercase tracking-wider text-muted-foreground mb-2 font-semibold">
            Stock movements logged
          </div>
          <ul className="text-xs space-y-1">
            {parts.map((p) => (
              <li key={p.id} className="flex justify-between text-muted-foreground">
                <span>
                  {p.name} × {Number(p.quantity)}
                </span>
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
          onPicked={() => {
            setPicker(null);
            onChanged();
          }}
        />
      )}
    </section>
  );
}

function InventoryPicker({
  jobId,
  fieldKey,
  category,
  label,
  serviceData,
  onClose,
  onPicked,
}: {
  jobId: string;
  fieldKey: string;
  category: string;
  label: string;
  serviceData: any;
  onClose: () => void;
  onPicked: () => void;
}) {
  const { user } = useCurrentUser();
  const [qty, setQty] = useState("1");
  const [pickedId, setPickedId] = useState<string | null>(null);

  const items = useQuery({
    queryKey: ["inventory-pick", category],
    queryFn: async () =>
      (await supabase.from("inventory_items").select("*").eq("category", category).order("name"))
        .data ?? [],
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
      supabase
        .from("jobs")
        .update({ service_data: { ...serviceData, parts_used: next } })
        .eq("id", jobId),
      supabase.from("parts").insert({
        job_id: jobId,
        name: `${item.name}${item.brand ? ` (${item.brand})` : ""}`,
        quantity: n,
        supplier: item.brand,
        cost: Number(item.unit_price),
        retail: Number(item.unit_price),
        added_by: user?.id,
      }),
      supabase
        .from("inventory_items")
        .update({ stock_qty: Math.max(0, Number(item.stock_qty) - n) })
        .eq("id", item.id),
    ]);
    const err = updates.find((u) => u.error)?.error;
    if (err) return toast.error(err.message);
    toast.success(`${item.name} added to job`);
    onPicked();
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-background/80 p-4"
      onClick={onClose}
    >
      <div
        className="card-surface p-5 w-full max-w-md space-y-3 max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-display text-lg font-bold">Pick {label}</h3>
        {items.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (items.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No inventory items in this category. Add some in the Inventory page.
          </p>
        ) : (
          <div className="space-y-1.5 max-h-72 overflow-y-auto">
            {(items.data ?? []).map((i: any) => (
              <button
                key={i.id}
                onClick={() => setPickedId(i.id)}
                className={`w-full text-left rounded-lg border p-2.5 transition-colors ${
                  pickedId === i.id
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-primary/40"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold text-sm truncate">{i.name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {[i.brand, i.type].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs font-bold">${Number(i.unit_price).toFixed(2)}</div>
                    <div className="text-[0.625rem] text-muted-foreground">
                      {Number(i.stock_qty)} {i.unit}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground">Quantity</label>
          <Input
            type="number"
            step="0.1"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            className="h-9 w-24"
          />
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={confirm} disabled={!pickedId} className="gold-surface">
            Add to job
          </Button>
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
      job_id: jobId,
      name: n,
      quantity: q,
      cost: p,
      retail: p,
      added_by: user?.id,
    } as any);
    setSaving(false);
    if (error) return toast.error(error.message);
    setName("");
    setQty("1");
    setPrice("0");
    setOpen(false);
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
        <Input
          autoFocus
          placeholder="Item name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-9 text-sm"
        />
        <Input
          type="number"
          step="0.1"
          placeholder="Qty"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          className="h-9 text-sm"
        />
        <Input
          type="number"
          step="0.01"
          placeholder="$ Price"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className="h-9 text-sm"
        />
        <div className="flex items-center gap-1">
          <Button onClick={save} disabled={saving} size="sm" className="gold-surface">
            <Check className="h-3.5 w-3.5" />
          </Button>
          <Button onClick={() => setOpen(false)} variant="ghost" size="sm">
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function ValveClearanceSection({
  jobId,
  cylinders,
  canEdit,
  data,
  bike,
  onChanged,
}: {
  jobId: string;
  cylinders: number;
  canEdit: boolean;
  data: any;
  bike: any;
  onChanged: () => void;
}) {
  const [values, setValues] = useState<any>(data ?? {});
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [savedTick, setSavedTick] = useState(false);
  useEffect(() => {
    setValues(data ?? {});
    setDirty(false);
  }, [data]);

  const savedSpecQ = useQuery({
    queryKey: ["valve-spec", bike?.make ?? "", bike?.model ?? ""],
    queryFn: () => fetchSavedValveSpec(bike?.make, bike?.model),
    enabled: Boolean(bike?.make && bike?.model),
  });
  const saved = savedSpecQ.data ?? null;

  const spec = resolveValveSpec(saved, bike);

  // Per-job overrides (fall back to saved spec, then the bike record).
  const cylCount = Math.max(
    1,
    Math.min(6, Number(values._cylinders) || saved?.cylinders || cylinders),
  );
  const intakeOnTop =
    values._intakeOnTop !== undefined
      ? Boolean(values._intakeOnTop)
      : (saved?.intake_on_top ?? true);

  const intakePerCyl = 2;
  const exhaustPerCyl = 2;

  // Editable spec form
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ imin: "", imax: "", emin: "", emax: "", note: "" });
  useEffect(() => {
    setForm({
      imin: String(spec.intake[0] ?? ""),
      imax: String(spec.intake[1] ?? ""),
      emin: String(spec.exhaust[0] ?? ""),
      emax: String(spec.exhaust[1] ?? ""),
      note: spec.note ?? "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved?.id, bike?.make, bike?.model, editing]);
  const [savingSpec, setSavingSpec] = useState(false);

  function set(cyl: number, side: "intake" | "exhaust", idx: number, v: string) {
    const key = `c${cyl}_${side}_${idx}`;
    setValues((s: any) => ({ ...s, [key]: v }));
    setDirty(true);
  }

  function setMeta(patch: Record<string, unknown>) {
    setValues((s: any) => ({ ...s, ...patch }));
    setDirty(true);
  }

  async function save(silent = false) {
    setSaving(true);
    const { data: job } = await supabase
      .from("jobs")
      .select("service_data")
      .eq("id", jobId)
      .maybeSingle();
    const next = { ...((job?.service_data as any) ?? {}), valves: values };
    const { error } = await supabase.from("jobs").update({ service_data: next }).eq("id", jobId);
    setSaving(false);
    if (error) return toast.error(error.message);
    if (!silent) toast.success("Valve clearances saved");
    setDirty(false);
    setSavedTick(true);
    setTimeout(() => setSavedTick(false), 1500);
    onChanged();
  }

  async function saveSpecForModel() {
    if (!bike?.make || !bike?.model) {
      toast.error("This bike needs a make and model before a spec can be saved");
      return;
    }
    const nums = [form.imin, form.imax, form.emin, form.emax].map((n) => Number(n));
    if (nums.some((n) => !Number.isFinite(n))) {
      toast.error("Clearance values must be numbers (mm)");
      return;
    }
    setSavingSpec(true);
    const { error } = await upsertSavedValveSpec({
      id: saved?.id ?? null,
      make: bike.make,
      model: bike.model,
      intake: [nums[0], nums[1]],
      exhaust: [nums[2], nums[3]],
      cylinders: cylCount,
      intakeOnTop,
      note: form.note.trim() || null,
    });
    setSavingSpec(false);
    if (error) return toast.error(error.message);
    toast.success(`Spec saved for ${bike.make} ${bike.model} — it will load on future bikes`);
    setEditing(false);
    savedSpecQ.refetch();
  }

  useAutoSave(values, dirty && canEdit, () => save(true));

  const rowFor = (kind: "intake" | "exhaust") => {
    const isIntake = kind === "intake";
    return (cyl: number) => (
      <div className="flex gap-2">
        {Array.from({ length: isIntake ? intakePerCyl : exhaustPerCyl }).map((_, i) => (
          <input
            key={i}
            disabled={!canEdit}
            value={values[`c${cyl}_${kind}_${i}`] ?? ""}
            onChange={(e) => set(cyl, kind, i, e.target.value)}
            placeholder="mm"
            title={`Cyl ${cyl} ${isIntake ? "Intake" : "Exhaust"} ${i + 1}`}
            className={
              isIntake
                ? "h-16 w-16 rounded-full bg-status-progress/15 border-2 border-status-progress/60 text-center text-sm font-mono font-bold focus:outline-none focus:border-status-progress focus:bg-status-progress/25 placeholder:text-status-progress/50 placeholder:font-normal"
                : "h-16 w-16 rounded-full bg-destructive/15 border-2 border-destructive/60 text-center text-sm font-mono font-bold focus:outline-none focus:border-destructive focus:bg-destructive/25 placeholder:text-destructive/50 placeholder:font-normal"
            }
          />
        ))}
      </div>
    );
  };
  const topRow = rowFor(intakeOnTop ? "intake" : "exhaust");
  const bottomRow = rowFor(intakeOnTop ? "exhaust" : "intake");

  // Orientation arrow + cylinder ordering (drag to rearrange)
  const frontDeg = Number(values._frontDeg ?? 0) || 0;
  const order: number[] = (() => {
    const raw: number[] = Array.isArray(values._order)
      ? (values._order as unknown[]).map(Number).filter((n) => n >= 1 && n <= cylCount)
      : [];
    const uniq = Array.from(new Set(raw));
    for (let i = 1; i <= cylCount; i++) if (!uniq.includes(i)) uniq.push(i);
    return uniq.slice(0, cylCount);
  })();
  const [dragCyl, setDragCyl] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  function moveCyl(cyl: number | null, toIdx: number) {
    if (cyl === null || !canEdit) return;
    const from = order.indexOf(cyl);
    if (from === -1 || from === toIdx) return;
    const next = [...order];
    next.splice(from, 1);
    next.splice(toIdx, 0, cyl);
    setMeta({ _order: next });
  }


  return (
    <>
      {/* Screen / on-card section */}
      <section className="card-surface p-4 print:hidden">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <Wrench className="h-4 w-4 text-primary" />
          <h2 className="font-display text-lg font-semibold">Valve Clearance Check</h2>
          {canEdit && (
            <div className="ml-auto flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1">
                <span className="text-[0.625rem] uppercase tracking-wider text-muted-foreground">
                  Cylinders
                </span>
                {[1, 2, 3, 4, 6].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setMeta({ _cylinders: n })}
                    className={`h-7 w-7 rounded-md border text-xs font-bold ${
                      cylCount === n
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border text-muted-foreground hover:border-primary/60"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => setMeta({ _intakeOnTop: !intakeOnTop })}
              >
                {intakeOnTop ? "Intake on top" : "Intake on bottom"}
              </Button>
            </div>
          )}
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          {cylCount}-cylinder engine. Record measured clearance in mm for each valve (intake &
          exhaust).
        </p>

        {/* Manufacturer / saved recommendation */}
        <div className="mb-3 rounded-lg border border-primary/40 bg-primary/5 p-3">
          <div className="flex items-center gap-2 mb-1">
            <div className="text-[0.625rem] uppercase tracking-wider text-muted-foreground font-bold">
              {saved ? "Saved workshop spec" : "Manufacturer recommendation"}{" "}
              {!saved && spec.generic && (
                <span className="text-status-parts">· generic — verify manual</span>
              )}
            </div>
            {canEdit && (
              <Button
                size="sm"
                variant="ghost"
                className="ml-auto h-6 px-2 text-[0.625rem] gap-1"
                onClick={() => setEditing((v) => !v)}
              >
                <Pencil className="h-3 w-3" />
                {editing ? "Cancel" : "Edit spec"}
              </Button>
            )}
          </div>

          {editing ? (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-[0.625rem] text-status-progress font-semibold mb-1">
                    INTAKE min / max (mm)
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={form.imin}
                      onChange={(e) => setForm((f) => ({ ...f, imin: e.target.value }))}
                      className="h-8 font-mono"
                      inputMode="decimal"
                    />
                    <Input
                      value={form.imax}
                      onChange={(e) => setForm((f) => ({ ...f, imax: e.target.value }))}
                      className="h-8 font-mono"
                      inputMode="decimal"
                    />
                  </div>
                </div>
                <div>
                  <div className="text-[0.625rem] text-destructive font-semibold mb-1">
                    EXHAUST min / max (mm)
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={form.emin}
                      onChange={(e) => setForm((f) => ({ ...f, emin: e.target.value }))}
                      className="h-8 font-mono"
                      inputMode="decimal"
                    />
                    <Input
                      value={form.emax}
                      onChange={(e) => setForm((f) => ({ ...f, emax: e.target.value }))}
                      className="h-8 font-mono"
                      inputMode="decimal"
                    />
                  </div>
                </div>
              </div>
              <Input
                value={form.note}
                onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                placeholder="Note (optional) — e.g. shim under bucket, cold engine"
                className="h-8 text-xs"
              />
              <div className="flex items-center gap-2">
                <Button size="sm" className="h-8" disabled={savingSpec} onClick={saveSpecForModel}>
                  {savingSpec
                    ? "Saving…"
                    : `Save spec for ${bike?.make ?? ""} ${bike?.model ?? ""}`.trim()}
                </Button>
                <span className="text-[0.625rem] text-muted-foreground">
                  Stored with {cylCount} cyl · {intakeOnTop ? "intake on top" : "intake on bottom"}{" "}
                  and reused on matching models.
                </span>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-[0.625rem] text-status-progress font-semibold">
                    INTAKE (cold)
                  </div>
                  <div className="font-mono font-bold">{formatRange(spec.intake)}</div>
                </div>
                <div>
                  <div className="text-[0.625rem] text-destructive font-semibold">
                    EXHAUST (cold)
                  </div>
                  <div className="font-mono font-bold">{formatRange(spec.exhaust)}</div>
                </div>
              </div>
              <div className="mt-1.5 text-[0.625rem] text-muted-foreground">
                Source: {spec.source}
                {bike?.make
                  ? ` · ${bike.make} ${bike.model ?? ""}${bike.year ? ` ${bike.year}` : ""}`
                  : ""}
              </div>
              {spec.note && (
                <div className="mt-1 text-[0.625rem] text-status-parts">{spec.note}</div>
              )}
            </>
          )}
        </div>

        <div className="rounded-xl border border-border bg-background/40 p-4 overflow-x-auto">
          <div className="text-[0.625rem] uppercase tracking-wider text-muted-foreground text-center mb-3">
            Top-down view ·{" "}
            {intakeOnTop ? "INTAKE (top) / EXHAUST (bottom)" : "EXHAUST (top) / INTAKE (bottom)"} ·
            drag cylinders to reorder
          </div>
          <div className="flex gap-4 min-w-fit justify-center items-center">
            <FrontArrow
              deg={frontDeg}
              disabled={!canEdit}
              onChange={(d) => setMeta({ _frontDeg: d })}
            />
            {order.map((cyl, idx) => (
              <div
                key={cyl}
                draggable={canEdit}
                onDragStart={() => setDragCyl(cyl)}
                onDragEnd={() => {
                  setDragCyl(null);
                  setOverIdx(null);
                }}
                onDragOver={(e) => {
                  if (!canEdit || dragCyl === null) return;
                  e.preventDefault();
                  setOverIdx(idx);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  moveCyl(dragCyl, idx);
                  setDragCyl(null);
                  setOverIdx(null);
                }}
                className={`rounded-2xl border-2 bg-card/60 p-3 flex flex-col items-center gap-2 transition-colors ${
                  overIdx === idx && dragCyl !== null && dragCyl !== cyl
                    ? "border-primary"
                    : "border-border"
                } ${dragCyl === cyl ? "opacity-50" : ""} ${canEdit ? "cursor-grab active:cursor-grabbing" : ""}`}
                style={{ minWidth: 150 }}
              >
                <div className="text-[0.625rem] uppercase tracking-wider text-muted-foreground font-bold">
                  Cyl {cyl}
                </div>
                {topRow(cyl)}
                {/* Spark plug center */}
                <div
                  className="h-4 w-4 rounded-full bg-muted-foreground/30 border border-muted-foreground/50"
                  title="Spark plug"
                />
                {bottomRow(cyl)}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-3 flex items-center gap-3 text-[0.625rem] text-muted-foreground flex-wrap">
          <span className="inline-flex items-center gap-1">
            <span className="h-3 w-3 rounded-full bg-status-progress/40 border border-status-progress/60" />{" "}
            Intake
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-3 w-3 rounded-full bg-destructive/40 border border-destructive/60" />{" "}
            Exhaust
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-muted-foreground/40 border border-muted-foreground/60" />{" "}
            Spark plug
          </span>
          <span className="ml-auto">
            Spec: I {formatRange(spec.intake)} · E {formatRange(spec.exhaust)}
          </span>
        </div>
        {canEdit && (
          <div className="mt-3 flex justify-end items-center gap-3 text-[0.625rem] uppercase tracking-wider text-muted-foreground">
            {saving || dirty ? "saving…" : savedTick ? "✓ saved" : "auto-saves as you type"}
          </div>
        )}
      </section>

      {/* Print-only worksheet — forced onto its own page */}
      <ValveClearancePrintSheet
        bike={bike}
        cylinders={cylCount}
        values={values}
        spec={spec}
        intakeOnTop={intakeOnTop}
        order={order}
        frontDeg={frontDeg}
      />
    </>
  );
}

function ValveClearancePrintSheet({
  bike,
  cylinders,
  values,
  spec,
  intakeOnTop = true,
  order,
  frontDeg = 0,
}: {
  bike: any;
  cylinders: number;
  values: any;
  spec: ValveSpec;
  intakeOnTop?: boolean;
  order?: number[];
  frontDeg?: number;
}) {
  const cyls =
    order && order.length === cylinders
      ? order
      : Array.from({ length: cylinders }, (_, i) => i + 1);
  const frontLabel = ["FRONT ↑", "FRONT →", "FRONT ↓", "FRONT ←"][
    Math.round(((frontDeg % 360) + 360) % 360 / 90) % 4
  ];

  return (
    <div
      className="hidden print:block valve-print-page"
      style={{ pageBreakBefore: "always", breakBefore: "page" }}
    >
      <style>{`
        @page valve-landscape { size: A4 landscape; margin: 10mm; }
        .valve-print-page { page: valve-landscape; }
      `}</style>
      <div className="flex items-center justify-between gap-3 border-b-2 border-black pb-1 mb-3">
        <div className="min-w-0">
          <div className="text-[0.625rem] uppercase tracking-[0.25em] text-gray-600">
            Valve Clearance Worksheet
          </div>
          <h1 className="font-display text-lg font-bold leading-tight">
            {bike?.make ?? ""} {bike?.model ?? ""} {bike?.year ?? ""} · {cylinders}-cyl · Rego{" "}
            {bike?.rego ?? "—"}
          </h1>
        </div>
        <div className="text-right shrink-0 text-[0.6875rem]">
          <b>Spec (cold)</b> · I <span className="font-mono">{formatRange(spec.intake)}</span> · E{" "}
          <span className="font-mono">{formatRange(spec.exhaust)}</span>
          <div className="text-[0.5625rem] text-gray-500">
            {spec.generic ? "Generic — verify manual · " : ""}
            {spec.source}
          </div>
        </div>
      </div>

      {spec.note && (
        <div className="text-[0.625rem] text-gray-700 mb-2">
          <b>Note:</b> {spec.note}
        </div>
      )}

      <div className="text-[0.625rem] uppercase tracking-[0.2em] text-gray-600 text-center mb-2">
        Top-down · {intakeOnTop ? "INTAKE top / EXHAUST bottom" : "EXHAUST top / INTAKE bottom"} ·{" "}
        {frontLabel} · write measured mm inside each circle
      </div>
      <div className="flex gap-4 justify-center items-stretch mb-3">
        {cyls.map((cyl) => {
          return (

            <div
              key={cyl}
              className="border border-gray-400 rounded-2xl p-3 flex flex-col items-center gap-2 flex-1"
              style={{ maxWidth: 220 }}
            >
              <div className="text-[0.6875rem] uppercase tracking-wider text-gray-700 font-bold">
                Cyl {cyl}
              </div>
              <div className="flex gap-2">
                {Array.from({ length: 2 }).map((_, i) => {
                  const v = values?.[`c${cyl}_${intakeOnTop ? "intake" : "exhaust"}_${i}`] ?? "";
                  return (
                    <div
                      key={i}
                      className="h-20 w-20 rounded-full border-2 border-gray-700 flex items-center justify-center font-mono text-base font-bold bg-white"
                    >
                      {v || ""}
                    </div>
                  );
                })}
              </div>
              <div className="h-3 w-3 rounded-full border border-gray-600 bg-gray-200" />
              <div className="flex gap-2">
                {Array.from({ length: 2 }).map((_, i) => {
                  const v = values?.[`c${cyl}_${intakeOnTop ? "exhaust" : "intake"}_${i}`] ?? "";
                  return (
                    <div
                      key={i}
                      className="h-20 w-20 rounded-full border-2 border-black flex items-center justify-center font-mono text-base font-bold bg-white"
                    >
                      {v || ""}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-3 text-[0.625rem] text-gray-700 mt-3 pt-1 border-t border-gray-300">
        <span>New shim = Current + (Measured − Target). Target = mid-spec.</span>
        <span>Technician: ______________ Date: ___ / ___ / ______</span>
      </div>
    </div>
  );
}
function InstructionsSection({
  bookingId,
  instructions,
  notes,
  canEdit,
  onSaved,
}: {
  bookingId: string | null;
  instructions: string;
  notes: string;
  canEdit: boolean;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [ins, setIns] = useState(instructions);
  const [nts, setNts] = useState(notes);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setIns(instructions);
    setNts(notes);
  }, [instructions, notes]);

  async function save() {
    if (!bookingId) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("bookings")
        .update({ instructions: ins || null, notes: nts || null })
        .eq("id", bookingId);
      if (error) throw error;
      toast.success("Instructions saved");
      setEditing(false);
      onSaved();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section
      data-print-section="instructions"
      className="card-surface p-4 border-l-4 border-primary/60"
    >
      <div className="flex items-center gap-2 mb-2">
        <h2 className="font-display text-lg font-semibold">Instructions</h2>
        <span className="text-[0.625rem] uppercase tracking-wider text-muted-foreground">
          from book-in
        </span>
        {canEdit && bookingId && !editing && (
          <Button
            variant="outline"
            size="sm"
            className="ml-auto print:hidden"
            onClick={() => setEditing(true)}
          >
            <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
          </Button>
        )}
      </div>

      {editing ? (
        <div className="space-y-3 print:hidden">
          <div>
            <div className="text-[0.625rem] uppercase tracking-wider text-muted-foreground mb-1">
              Instructions
            </div>
            <Textarea
              value={ins}
              onChange={(e) => setIns(e.target.value)}
              rows={4}
              placeholder="What the customer asked for…"
            />
          </div>
          <div>
            <div className="text-[0.625rem] uppercase tracking-wider text-muted-foreground mb-1">
              Internal notes
            </div>
            <Textarea
              value={nts}
              onChange={(e) => setNts(e.target.value)}
              rows={3}
              placeholder="Internal notes…"
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setIns(instructions);
                setNts(notes);
                setEditing(false);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <>
          {instructions ? (
            <p className="text-sm whitespace-pre-wrap">{instructions}</p>
          ) : (
            <p className="text-sm text-muted-foreground print:hidden">No instructions yet.</p>
          )}
          {notes && (
            <div className="mt-2 pt-2 border-t border-border/40">
              <div className="text-[0.625rem] uppercase tracking-wider text-muted-foreground mb-0.5">
                Internal notes
              </div>
              <p className="text-sm whitespace-pre-wrap">{notes}</p>
            </div>
          )}
        </>
      )}
    </section>
  );
}


function BikeComplianceCard({
  jobId,
  bikeId,
  rego,
  regoExpiry,
  wofExpiry,
  odometer,
  bikeMileage,
  canEdit,
  onSaved,
}: {
  jobId: string;
  bikeId?: string;
  rego: string | null;
  regoExpiry: string | null;
  wofExpiry: string | null;
  odometer: number | null;
  bikeMileage: number | null;
  canEdit: boolean;
  onSaved: () => void;
}) {
  // Odometer
  const initialOdo = odometer ?? bikeMileage ?? null;
  const [odoValue, setOdoValue] = useState(initialOdo != null ? String(initialOdo) : "");
  const [odoSaving, setOdoSaving] = useState(false);
  const [odoDirty, setOdoDirty] = useState(false);
  const [odoTick, setOdoTick] = useState(false);

  useEffect(() => {
    const v = odometer ?? bikeMileage ?? null;
    setOdoValue(v != null ? String(v) : "");
    setOdoDirty(false);
  }, [odometer, bikeMileage]);

  async function saveOdometer(silent = false) {
    const km = odoValue ? parseInt(odoValue.replace(/\D/g, "")) : null;
    setOdoSaving(true);
    try {
      const { error } = await supabase.from("jobs").update({ odometer: km }).eq("id", jobId);
      if (error) throw error;
      if (bikeId && km != null) {
        await supabase.from("motorcycles").update({ mileage: km }).eq("id", bikeId);
      }
      if (!silent) toast.success("Kilometers saved");
      setOdoDirty(false);
      setOdoTick(true);
      setTimeout(() => setOdoTick(false), 1500);
      onSaved();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save");
    } finally {
      setOdoSaving(false);
    }
  }

  // REGO plate
  const [regoValue, setRegoValue] = useState(rego ?? "");
  const [regoSaving, setRegoSaving] = useState(false);
  const [regoDirty, setRegoDirty] = useState(false);
  const [regoTick, setRegoTick] = useState(false);

  useEffect(() => {
    setRegoValue(rego ?? "");
    setRegoDirty(false);
  }, [rego]);

  async function saveRego(silent = false) {
    if (!bikeId) {
      if (!silent) toast.error("No bike linked to this job");
      return;
    }
    setRegoSaving(true);
    try {
      const { error } = await supabase
        .from("motorcycles")
        .update({ rego: regoValue.trim().toUpperCase() || null })
        .eq("id", bikeId);
      if (error) throw error;
      if (!silent) toast.success("REGO saved");
      setRegoDirty(false);
      setRegoTick(true);
      setTimeout(() => setRegoTick(false), 1500);
      onSaved();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save");
    } finally {
      setRegoSaving(false);
    }
  }

  useAutoSave(regoValue, regoDirty && canEdit, () => saveRego(true));

  // REGO expiry
  const [regoExpValue, setRegoExpValue] = useState(regoExpiry ?? "");
  const [regoExpSaving, setRegoExpSaving] = useState(false);
  const [regoExpDirty, setRegoExpDirty] = useState(false);
  const [regoExpTick, setRegoExpTick] = useState(false);

  useEffect(() => {
    setRegoExpValue(regoExpiry ?? "");
    setRegoExpDirty(false);
  }, [regoExpiry]);

  async function saveRegoExpiry(silent = false) {
    if (!bikeId) {
      if (!silent) toast.error("No bike linked to this job");
      return;
    }
    setRegoExpSaving(true);
    try {
      const { error } = await supabase
        .from("motorcycles")
        .update({ rego_expiry: regoExpValue || null })
        .eq("id", bikeId);
      if (error) throw error;
      if (!silent) toast.success("REGO expiry saved");
      setRegoExpDirty(false);
      setRegoExpTick(true);
      setTimeout(() => setRegoExpTick(false), 1500);
      onSaved();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save");
    } finally {
      setRegoExpSaving(false);
    }
  }

  useAutoSave(regoExpValue, regoExpDirty && canEdit, () => saveRegoExpiry(true));

  // WOF expiry
  const [wofExpValue, setWofExpValue] = useState(wofExpiry ?? "");
  const [wofExpSaving, setWofExpSaving] = useState(false);
  const [wofExpDirty, setWofExpDirty] = useState(false);
  const [wofExpTick, setWofExpTick] = useState(false);

  useEffect(() => {
    setWofExpValue(wofExpiry ?? "");
    setWofExpDirty(false);
  }, [wofExpiry]);

  async function saveWofExpiry(silent = false) {
    if (!bikeId) {
      if (!silent) toast.error("No bike linked to this job");
      return;
    }
    setWofExpSaving(true);
    try {
      const { error } = await supabase
        .from("motorcycles")
        .update({ wof_expiry: wofExpValue || null })
        .eq("id", bikeId);
      if (error) throw error;
      if (!silent) toast.success("WOF expiry saved");
      setWofExpDirty(false);
      setWofExpTick(true);
      setTimeout(() => setWofExpTick(false), 1500);
      onSaved();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save");
    } finally {
      setWofExpSaving(false);
    }
  }

  useAutoSave(wofExpValue, wofExpDirty && canEdit, () => saveWofExpiry(true));

  const regoExpired = regoExpValue
    ? new Date(regoExpValue) < new Date(new Date().toDateString())
    : false;
  const wofExpired = wofExpValue
    ? new Date(wofExpValue) < new Date(new Date().toDateString())
    : false;

  const odoDisplay = odoValue ? Number(odoValue.replace(/\D/g, "")).toLocaleString() : "";

  return (
    <div className="card-surface p-4 print:hidden">
      <div className="mb-3">
        <h3 className="font-display text-sm font-semibold">Bike details</h3>
        <p className="text-[0.625rem] uppercase tracking-wider text-muted-foreground">
          REGO, WOF & odometer
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Odometer */}
        <div className="space-y-1">
          <label className="text-[0.625rem] uppercase tracking-wider text-muted-foreground">
            Kilometers
          </label>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Input
                inputMode="numeric"
                placeholder="24,500"
                value={odoDisplay}
                onChange={(e) => {
                  setOdoValue(e.target.value.replace(/\D/g, ""));
                  setOdoDirty(true);
                }}
                disabled={!canEdit || odoSaving}
                className="pr-10 h-9 font-mono text-sm"
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-semibold pointer-events-none">
                km
              </span>
            </div>
            <Button
              size="sm"
              className="h-9 px-2.5"
              onClick={() => saveOdometer()}
              disabled={!canEdit || odoSaving || !odoDirty}
            >
              Save
            </Button>
          </div>
          <div className="flex items-center gap-2 text-[0.625rem] text-muted-foreground">
            {bikeMileage != null && <span>Last: {bikeMileage.toLocaleString()} km</span>}
            <span className="ml-auto">{odoDirty ? "unsaved" : odoTick ? "✓ saved" : "\u00A0"}</span>
          </div>
        </div>

        {/* REGO plate */}
        <div className="space-y-1">
          <label className="text-[0.625rem] uppercase tracking-wider text-muted-foreground">
            REGO plate
          </label>
          <Input
            value={regoValue}
            placeholder="12ABC"
            onChange={(e) => {
              setRegoValue(e.target.value.toUpperCase());
              setRegoDirty(true);
            }}
            disabled={!canEdit || regoSaving}
            className="h-9 font-mono text-sm tracking-widest"
          />
          <div className="text-[0.625rem] text-muted-foreground text-right">
            {regoSaving || regoDirty ? "saving…" : regoTick ? "✓ saved" : "\u00A0"}
          </div>
        </div>

        {/* REGO expiry */}
        <div className="space-y-1">
          <label className="text-[0.625rem] uppercase tracking-wider text-muted-foreground">
            REGO expiry
          </label>
          <Input
            type="date"
            value={regoExpValue}
            onChange={(e) => {
              setRegoExpValue(e.target.value);
              setRegoExpDirty(true);
            }}
            disabled={!canEdit || regoExpSaving}
            className={`h-9 font-mono text-sm ${regoExpired ? "text-destructive" : ""}`}
          />
          <div className="text-[0.625rem] text-muted-foreground text-right">
            {regoExpSaving || regoExpDirty
              ? "saving…"
              : regoExpired
              ? "expired"
              : regoExpTick
              ? "✓ saved"
              : "\u00A0"}
          </div>
        </div>

        {/* WOF expiry */}
        <div className="space-y-1">
          <label className="text-[0.625rem] uppercase tracking-wider text-muted-foreground">
            WOF expiry
          </label>
          <Input
            type="date"
            value={wofExpValue}
            onChange={(e) => {
              setWofExpValue(e.target.value);
              setWofExpDirty(true);
            }}
            disabled={!canEdit || wofExpSaving}
            className={`h-9 font-mono text-sm ${wofExpired ? "text-destructive" : ""}`}
          />
          <div className="text-[0.625rem] text-muted-foreground text-right">
            {wofExpSaving || wofExpDirty
              ? "saving…"
              : wofExpired
              ? "expired"
              : wofExpTick
              ? "✓ saved"
              : "\u00A0"}
          </div>
        </div>
      </div>
    </div>
  );
}

// Convert an ISO timestamp to a value usable in <input type="datetime-local"> (local time, no seconds).
function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function localInputToIso(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  if (isNaN(+d)) return null;
  return d.toISOString();
}

function TimeEntriesEditor({
  entries,
  jobId,
  currentUserId,
  isAdmin,
}: {
  entries: any[];
  jobId: string;
  currentUserId?: string;
  isAdmin: boolean;
}) {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [startVal, setStartVal] = useState("");
  const [endVal, setEndVal] = useState("");
  const [saving, setSaving] = useState(false);

  const techIds = useMemo(
    () => [...new Set(entries.map((e) => e.technician_id).filter(Boolean))],
    [entries],
  );
  const techs = useQuery({
    queryKey: ["job-time-techs", jobId, techIds.join(",")],
    enabled: techIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name").in("id", techIds);
      const map = new Map<string, string>();
      (data ?? []).forEach((p: any) => map.set(p.id, p.full_name));
      return map;
    },
  });

  const sorted = useMemo(
    () => [...entries].sort((a, b) => +new Date(b.started_at) - +new Date(a.started_at)),
    [entries],
  );

  function canEditEntry(e: any) {
    return isAdmin || e.technician_id === currentUserId;
  }

  function beginEdit(e: any) {
    setEditing(e.id);
    setStartVal(isoToLocalInput(e.started_at));
    setEndVal(isoToLocalInput(e.ended_at));
  }
  function cancel() {
    setEditing(null);
    setStartVal("");
    setEndVal("");
  }
  async function save(entry: any) {
    const startIso = localInputToIso(startVal);
    const endIso = endVal ? localInputToIso(endVal) : null;
    if (!startIso) return toast.error("Start time is required");
    if (endIso && +new Date(endIso) <= +new Date(startIso)) {
      return toast.error("End time must be after start time");
    }
    const minutes = endIso
      ? Math.max(1, Math.round((+new Date(endIso) - +new Date(startIso)) / 60000))
      : null;
    setSaving(true);
    const { error } = await supabase
      .from("time_entries")
      .update({ started_at: startIso, ended_at: endIso, minutes })
      .eq("id", entry.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Time entry updated");
    cancel();
    qc.invalidateQueries({ queryKey: ["job-time", jobId] });
    qc.invalidateQueries({ queryKey: ["clock-events-floating"] });
  }
  async function remove(entry: any) {
    if (!confirm("Delete this time entry?")) return;
    const { error } = await supabase.from("time_entries").delete().eq("id", entry.id);
    if (error) return toast.error(error.message);
    toast.success("Time entry deleted");
    qc.invalidateQueries({ queryKey: ["job-time", jobId] });
  }

  if (sorted.length === 0) return null;

  return (
    <div className="mt-4 pt-3 border-t border-border/50 no-print">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between text-[0.625rem] uppercase tracking-wider text-muted-foreground hover:text-foreground"
      >
        <span>
          Time entries ({sorted.length}){isAdmin ? " · admin can edit any" : ""}
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`}
        />
      </button>
      {expanded && (
        <ul className="mt-2 space-y-1.5">
          {sorted.map((e) => {
            const editable = canEditEntry(e);
            const isEditing = editing === e.id;
            const tech = techs.data?.get(e.technician_id) ?? "Staff";
            const mins =
              e.minutes ??
              (e.ended_at
                ? Math.round((+new Date(e.ended_at) - +new Date(e.started_at)) / 60000)
                : 0);
            return (
              <li
                key={e.id}
                className="rounded-md border border-border/50 bg-background/40 p-2 text-xs"
              >
                {isEditing ? (
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <label className="flex flex-col gap-0.5">
                        <span className="text-[0.5625rem] uppercase tracking-wider text-muted-foreground">
                          Start
                        </span>
                        <Input
                          type="datetime-local"
                          value={startVal}
                          onChange={(ev) => setStartVal(ev.target.value)}
                          className="h-8 text-xs"
                        />
                      </label>
                      <label className="flex flex-col gap-0.5">
                        <span className="text-[0.5625rem] uppercase tracking-wider text-muted-foreground">
                          End (blank = still running)
                        </span>
                        <Input
                          type="datetime-local"
                          value={endVal}
                          onChange={(ev) => setEndVal(ev.target.value)}
                          className="h-8 text-xs"
                        />
                      </label>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        size="sm"
                        onClick={() => save(e)}
                        disabled={saving}
                        className="h-8 gold-surface text-[0.6875rem]"
                      >
                        {saving ? "Saving…" : "Save"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={cancel}
                        className="h-8 text-[0.6875rem]"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{tech}</div>
                      <div className="text-[0.625rem] text-muted-foreground">
                        {new Date(e.started_at).toLocaleString()} →{" "}
                        {e.ended_at ? (
                          new Date(e.ended_at).toLocaleString()
                        ) : (
                          <span className="text-status-progress">running…</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-mono font-bold">{formatMinutes(mins)}</span>
                      {editable && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => beginEdit(e)}
                            className="h-7 text-[0.625rem] px-2"
                          >
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => remove(e)}
                            className="h-7 text-[0.625rem] px-2 text-destructive hover:text-destructive"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
