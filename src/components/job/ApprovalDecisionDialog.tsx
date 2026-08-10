import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { logJobEvent } from "@/lib/job-events";
import {
  CONTACT_METHODS,
  CONTACT_METHOD_LABEL,
  SEVERITY_META,
  type ApprovalRequest,
  type InspectionFinding,
} from "@/lib/inspection";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type Decision = "approved" | "declined" | "deferred";

const DECISIONS: { key: Decision; label: string; cls: string }[] = [
  { key: "approved", label: "Approved", cls: "bg-green-500/20 text-green-400 border-green-500/50" },
  {
    key: "declined",
    label: "Declined",
    cls: "bg-destructive/20 text-destructive border-destructive/50",
  },
  { key: "deferred", label: "Deferred", cls: "bg-blue-500/20 text-blue-400 border-blue-500/50" },
];

export function ApprovalDecisionDialog({
  open,
  onOpenChange,
  jobId,
  jobStartedAt,
  request,
  findings,
  userId,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  jobId: string;
  jobStartedAt: string | null;
  request: ApprovalRequest;
  findings: InspectionFinding[];
  userId: string;
  onDone: () => void;
}) {
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [contact, setContact] = useState<string>("phone");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const init: Record<string, Decision> = {};
    findings.forEach((f) => (init[f.id] = "approved"));
    setDecisions(init);
    setNote("");
  }, [open, findings]);

  function setAll(d: Decision) {
    const next: Record<string, Decision> = {};
    findings.forEach((f) => (next[f.id] = d));
    setDecisions(next);
  }

  async function save() {
    setSaving(true);
    try {
      const approved = findings.filter((f) => decisions[f.id] === "approved");
      const declined = findings.filter((f) => decisions[f.id] === "declined");
      const deferred = findings.filter((f) => decisions[f.id] === "deferred");

      for (const f of findings) {
        const { error } = await supabase
          .from("job_inspection_findings")
          .update({ status: decisions[f.id] ?? "deferred", decision_note: note.trim() || null })
          .eq("id", f.id);
        if (error) throw new Error(error.message);
      }

      const decision =
        approved.length === findings.length
          ? "approved_all"
          : approved.length === 0
            ? "declined_all"
            : "partial";

      const { error: reqErr } = await supabase
        .from("job_approval_requests")
        .update({
          status: "resolved",
          decision,
          resolved_by: userId,
          resolved_at: new Date().toISOString(),
          customer_contact_method: contact,
          resolution_note: note.trim() || null,
        })
        .eq("id", request.id);
      if (reqErr) throw new Error(reqErr.message);

      await supabase
        .from("notifications")
        .update({ resolved_at: new Date().toISOString(), resolved_by: userId })
        .eq("approval_request_id", request.id)
        .is("resolved_at", null);

      // Job returns to its operational state — never auto-completed.
      const nextStatus = jobStartedAt ? "in_progress" : "assigned";
      await supabase.from("jobs").update({ status: nextStatus }).eq("id", jobId);

      await logJobEvent(
        jobId,
        "customer_contacted",
        `Customer contacted by ${CONTACT_METHOD_LABEL[contact] ?? contact}`,
        { approval_request_id: request.id },
        userId,
      );
      await logJobEvent(
        jobId,
        "approval_decision",
        decision === "approved_all"
          ? "Customer approved all findings"
          : decision === "declined_all"
            ? "Customer declined all findings"
            : "Partial approval received",
        {
          approval_request_id: request.id,
          approved: approved.map((f) => f.title),
          declined: declined.map((f) => f.title),
          deferred: deferred.map((f) => f.title),
          note: note.trim() || null,
          contact_method: contact,
        },
        userId,
      );

      toast.success("Customer decision recorded");
      onDone();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to record decision");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Record customer decision</DialogTitle>
        </DialogHeader>

        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setAll("approved")}>
            Approve all
          </Button>
          <Button size="sm" variant="outline" onClick={() => setAll("declined")}>
            Decline all
          </Button>
          <Button size="sm" variant="outline" onClick={() => setAll("deferred")}>
            Defer all
          </Button>
        </div>

        <div className="space-y-2">
          {findings.map((f) => (
            <div key={f.id} className="rounded-lg border border-border p-2.5">
              <div className="min-w-0">
                <div className="text-sm font-semibold truncate">{f.title}</div>
                <span
                  className={cn(
                    "inline-flex mt-1 rounded-full border px-1.5 py-0.5 text-[0.625rem] font-bold uppercase",
                    SEVERITY_META[f.severity]?.chip,
                  )}
                >
                  {SEVERITY_META[f.severity]?.label ?? f.severity}
                </span>
              </div>
              <div className="flex gap-1.5 mt-2">
                {DECISIONS.map((d) => (
                  <button
                    key={d.key}
                    type="button"
                    onClick={() => setDecisions((p) => ({ ...p, [f.id]: d.key }))}
                    className={cn(
                      "flex-1 rounded-md border px-2 py-1 text-[0.6875rem] font-semibold",
                      decisions[f.id] === d.key
                        ? d.cls
                        : "border-border text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div>
          <Label>Contact method</Label>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {CONTACT_METHODS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setContact(m)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[0.6875rem] font-semibold",
                  contact === m
                    ? "border-primary/50 bg-primary/15 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {CONTACT_METHOD_LABEL[m]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <Label htmlFor="d-note">Note (optional)</Label>
          <Textarea
            id="d-note"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Customer approved chain and brakes, declined tyre."
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Record decision"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
