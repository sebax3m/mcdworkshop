import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { logJobEvent } from "@/lib/job-events";
import { getSignedUrl } from "@/lib/photos";
import { useTechnicianNames } from "@/hooks/use-technician-names";
import {
  CATEGORY_LABEL,
  FINDING_STATUS_META,
  INSPECTION_LABOUR_RATE,
  SEVERITY_META,
  quoteTotals,
  type ApprovalRequest,
  type InspectionFinding,
} from "@/lib/inspection";
import { FindingDialog } from "./FindingDialog";
import { ApprovalDecisionDialog } from "./ApprovalDecisionDialog";
import { Button } from "@/components/ui/button";
import { ClipboardCheck, Pencil, Plus, ShieldAlert, Trash2, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

export function InspectionPanel({
  jobId,
  jobNumber,
  jobStartedAt,
  customerName,
  isAdmin,
  userId,
  onJobChanged,
}: {
  jobId: string;
  jobNumber: number | string;
  jobStartedAt: string | null;
  customerName: string;
  isAdmin: boolean;
  userId: string;
  onJobChanged: () => void;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<InspectionFinding | null>(null);
  const [decisionOpen, setDecisionOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const findingsQ = useQuery({
    queryKey: ["job-findings", jobId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("job_inspection_findings")
        .select("*")
        .eq("job_id", jobId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as InspectionFinding[];
    },
  });

  const requestQ = useQuery({
    queryKey: ["job-approval-request", jobId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("job_approval_requests")
        .select("*")
        .eq("job_id", jobId)
        .order("requested_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ApprovalRequest[];
    },
  });

  const findings = findingsQ.data ?? [];
  const requests = requestQ.data ?? [];
  const pendingRequest = requests.find((r) => r.status === "pending") ?? null;

  const drafts = findings.filter((f) => f.status === "draft");
  const pending = findings.filter((f) => f.status === "pending_approval");
  const decided = findings.filter((f) => ["approved", "declined", "deferred"].includes(f.status));
  const declinedCritical = decided.filter(
    (f) => f.status === "declined" && f.severity === "safety_critical",
  );

  const refresh = () => {
    findingsQ.refetch();
    requestQ.refetch();
    onJobChanged();
  };

  const totals = useMemo(
    () => ({ drafts: quoteTotals(drafts), pending: quoteTotals(pending) }),
    [drafts, pending],
  );
  const approved = useMemo(() => findings.filter((f) => f.status === "approved"), [findings]);
  const quoteList = pending.length > 0 ? pending : drafts.length > 0 ? drafts : approved;
  const quote = useMemo(() => quoteTotals(quoteList), [quoteList]);

  async function saveDraft() {
    await logJobEvent(
      jobId,
      "inspection_saved",
      `Inspection draft saved (${drafts.length} finding${drafts.length === 1 ? "" : "s"})`,
      { count: drafts.length },
      userId,
    );
    toast.success("Inspection draft saved");
    refresh();
  }

  async function requestApproval() {
    if (drafts.length === 0) return toast.error("Add at least one finding first");
    if (pendingRequest) return toast.error("An approval request is already pending");
    setBusy(true);
    try {
      const { data: req, error } = await supabase
        .from("job_approval_requests")
        .insert({ job_id: jobId, requested_by: userId, status: "pending" })
        .select("*")
        .single();
      if (error) throw new Error(error.message);

      const ids = drafts.map((d) => d.id);
      const { error: upErr } = await supabase
        .from("job_inspection_findings")
        .update({ status: "pending_approval", approval_request_id: req.id })
        .in("id", ids);
      if (upErr) throw new Error(upErr.message);

      await supabase.from("jobs").update({ status: "waiting_approval" }).eq("id", jobId);

      const critical = drafts.filter((d) => d.severity === "safety_critical").length;
      await supabase.from("notifications").insert({
        kind: "approval_required",
        title: `Approval needed — Job #${jobNumber}`,
        body: `${customerName}: ${drafts.length} finding${drafts.length === 1 ? "" : "s"}${
          critical ? ` · ${critical} safety critical` : ""
        }`,
        link: `/jobs/${jobId}`,
        job_id: jobId,
        approval_request_id: req.id,
        requires_action: true,
        target_role: "admin",
        created_by: userId,
      });

      await logJobEvent(
        jobId,
        "approval_requested",
        `Approval requested for ${drafts.length} finding${drafts.length === 1 ? "" : "s"}`,
        { approval_request_id: req.id, findings: drafts.map((d) => d.title) },
        userId,
      );

      toast.success("Sent to reception for customer approval");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not request approval");
    } finally {
      setBusy(false);
    }
  }

  async function removeFinding(f: InspectionFinding) {
    const isDraft = f.status === "draft";
    if (!isDraft) {
      const ok = window.confirm(
        `Delete "${f.title}"?\n\nThis finding has already been ${f.status.replace("_", " ")}. Deleting it removes it from the record and cannot be undone.`,
      );
      if (!ok) return;
    }
    const { error } = await supabase.from("job_inspection_findings").delete().eq("id", f.id);
    if (error) {
      toast.error(error.message);
      return;
    }

    // Clean up approval request if this was the last finding for it
    if (f.approval_request_id) {
      const { data: others } = await supabase
        .from("job_inspection_findings")
        .select("id")
        .eq("approval_request_id", f.approval_request_id);

      if (!others || others.length === 0) {
        await supabase.from("job_approval_requests").delete().eq("id", f.approval_request_id);
        
        // If it was the pending one, revert job status
        if (f.status === "pending_approval") {
          const nextStatus = jobStartedAt ? "in_progress" : "assigned";
          await supabase.from("jobs").update({ status: nextStatus }).eq("id", jobId);
        }
      }
    }

    await logJobEvent(
      jobId,
      "finding_deleted",
      `Deleted finding "${f.title}" (${f.status})`,
      { finding_id: f.id, title: f.title, status: f.status },
      userId,
    );
    toast.success("Finding deleted");
    refresh();
  }

  return (
    <div className="card-surface p-4 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-bold uppercase tracking-wider">Inspection & approval</h2>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="h-4 w-4 mr-1" /> Finding
        </Button>
      </div>

      {pendingRequest && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
          <div className="flex items-start gap-2">
            <TriangleAlert className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-amber-300">Waiting customer approval</div>
              <div className="text-xs text-muted-foreground">
                Requested {format(new Date(pendingRequest.requested_at), "d MMM · HH:mm")} · work on
                these items is on hold.
              </div>
              {isAdmin && (
                <Button size="sm" className="mt-2" onClick={() => setDecisionOpen(true)}>
                  Record customer decision
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {declinedCritical.length > 0 && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 flex items-start gap-2">
          <ShieldAlert className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
          <div className="text-xs">
            <span className="font-semibold text-destructive">
              Safety-critical work declined by customer.
            </span>{" "}
            Record the advice given before releasing the bike:{" "}
            {declinedCritical.map((f) => f.title).join(", ")}.
          </div>
        </div>
      )}

      {findings.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No inspection findings yet. Add what you found on the bike, then send it to reception for
          customer approval.
        </p>
      )}

      {pending.length > 0 && (
        <Section title={`Awaiting approval (${pending.length})`} total={totals.pending}>
          {pending.map((f) => (
            <FindingRow key={f.id} f={f} onDelete={() => removeFinding(f)} />
          ))}
        </Section>
      )}

      {drafts.length > 0 && (
        <Section title={`Draft findings (${drafts.length})`} total={totals.drafts}>
          {drafts.map((f) => (
            <FindingRow
              key={f.id}
              f={f}
              onEdit={() => {
                setEditing(f);
                setDialogOpen(true);
              }}
              onDelete={() => removeFinding(f)}
            />
          ))}
        </Section>
      )}

      {decided.length > 0 && (
        <Section title={`Customer decisions (${decided.length})`}>
          {decided.map((f) => (
            <FindingRow
              key={f.id}
              f={f}
              onEdit={() => {
                setEditing(f);
                setDialogOpen(true);
              }}
              onDelete={() => removeFinding(f)}
            />
          ))}
        </Section>
      )}

      {drafts.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={saveDraft} disabled={busy}>
            Save draft
          </Button>
          <Button onClick={requestApproval} disabled={busy || !!pendingRequest}>
            {busy ? "Sending…" : "Save & request approval"}
          </Button>
        </div>
      )}

      <FindingDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        jobId={jobId}
        userId={userId}
        finding={editing}
        onSaved={refresh}
        onDelete={removeFinding}
      />

      {pendingRequest && isAdmin && (
        <ApprovalDecisionDialog
          open={decisionOpen}
          onOpenChange={setDecisionOpen}
          jobId={jobId}
          jobStartedAt={jobStartedAt}
          request={pendingRequest}
          findings={pending}
          userId={userId}
          onDone={refresh}
        />
      )}
    </div>
  );
}

function Section({
  title,
  total,
  children,
}: {
  title: string;
  total?: number;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-[0.6875rem] uppercase tracking-wider text-muted-foreground mb-1.5">
        <span>{title}</span>
        {total ? <span>~${total.toFixed(0)} parts</span> : null}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function FindingRow({
  f,
  onEdit,
  onDelete,
}: {
  f: InspectionFinding;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const names = useTechnicianNames();
  const [photoUrl, setPhotoUrl] = useState("");
  useEffect(() => {
    let alive = true;
    if (f.photo_path) getSignedUrl(f.photo_path).then((u) => alive && setPhotoUrl(u));
    else setPhotoUrl("");
    return () => {
      alive = false;
    };
  }, [f.photo_path]);

  return (
    <div className="rounded-lg border border-border p-2.5">
      <div className="flex items-start gap-2.5">
        {photoUrl && (
          <a href={photoUrl} target="_blank" rel="noreferrer" className="shrink-0">
            <img src={photoUrl} alt="" className="h-12 w-12 rounded-md object-cover" />
          </a>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={cn("h-1.5 w-1.5 rounded-full", SEVERITY_META[f.severity]?.dot)} />
            <span className="text-sm font-semibold">{f.title}</span>
            <span
              className={cn(
                "rounded-full border px-1.5 py-0.5 text-[0.5625rem] font-bold uppercase",
                FINDING_STATUS_META[f.status]?.chip,
              )}
            >
              {FINDING_STATUS_META[f.status]?.label ?? f.status}
            </span>
          </div>
          <div className="text-[0.6875rem] text-muted-foreground mt-0.5">
            {CATEGORY_LABEL[f.category] ?? f.category} · {SEVERITY_META[f.severity]?.label}
            {f.created_by ? ` · ${names.get(f.created_by) ?? "Staff"}` : ""}
          </div>
          {f.description && <p className="text-xs mt-1 whitespace-pre-wrap">{f.description}</p>}
          {f.recommended_action && (
            <p className="text-xs mt-1 text-muted-foreground">→ {f.recommended_action}</p>
          )}
          {(f.estimated_labour || f.estimated_parts_cost) && (
            <div className="text-[0.6875rem] text-muted-foreground mt-1">
              {f.estimated_labour ? `${f.estimated_labour}h labour` : ""}
              {f.estimated_labour && f.estimated_parts_cost ? " · " : ""}
              {f.estimated_parts_cost ? `$${f.estimated_parts_cost} parts` : ""}
            </div>
          )}
          {f.decision_note && (
            <p className="text-[0.6875rem] mt-1 italic text-muted-foreground">
              Customer note: {f.decision_note}
            </p>
          )}
        </div>
        {(onEdit || onDelete) && (
          <div className="flex gap-1 shrink-0">
            {onEdit && (
              <button
                onClick={onEdit}
                className="grid h-7 w-7 place-items-center rounded-md border border-border hover:border-primary/50"
                aria-label="Edit finding"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            )}
            {onDelete && (
              <button
                onClick={onDelete}
                className="grid h-7 w-7 place-items-center rounded-md border border-border hover:border-destructive/50 text-destructive"
                aria-label="Delete finding"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
