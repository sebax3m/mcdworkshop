/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { CheckCircle2, Clock } from "lucide-react";

export type ClockOutReminderJob = {
  id: string;
  job_number?: number | null;
  complaint?: string | null;
  motorcycles?: { make?: string | null; model?: string | null; rego?: string | null } | null;
};

/**
 * Shown after a technician clocks out while a job was active.
 * Lets them mark the job "Ready for pickup" or dismiss (continuing later).
 */
export function ClockOutReminderDialog({
  job,
  onClose,
}: {
  job: ClockOutReminderJob | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);

  if (!job) return null;

  const bike = job.motorcycles
    ? [job.motorcycles.make, job.motorcycles.model].filter(Boolean).join(" ")
    : "";

  async function markReady() {
    if (!job) return;
    setSaving(true);
    const { data, error } = await supabase
      .from("jobs")
      .update({ status: "ready_for_pickup" })
      .eq("id", job.id)
      .select("id");
    setSaving(false);
    if (error) return toast.error(error.message);
    if (!data || data.length === 0) {
      return toast.error("You don't have permission to update this job.");
    }
    toast.success(`Job #${job.job_number ?? ""} marked Ready for pickup`);
    qc.invalidateQueries({ queryKey: ["job", job.id] });
    qc.invalidateQueries({ queryKey: ["jobs"] });
    qc.invalidateQueries({ queryKey: ["dashboard-jobs"] });
    qc.invalidateQueries({ queryKey: ["dashboard-counts"] });
    onClose();
  }

  return (
    <Dialog open={!!job} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Clocked out — is the job finished?</DialogTitle>
          <DialogDescription>
            You were working on Job #{job.job_number ?? "…"}
            {bike ? ` — ${bike}` : ""}
            {job.motorcycles?.rego ? ` (${job.motorcycles.rego})` : ""}. Did you finish it, or
            are you just clocking off and will continue later?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button onClick={markReady} disabled={saving} className="w-full gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Job finished — mark Ready for pickup
          </Button>
          <Button variant="outline" onClick={onClose} className="w-full gap-2">
            <Clock className="h-4 w-4" />
            Just clocking off — I'll continue later
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
