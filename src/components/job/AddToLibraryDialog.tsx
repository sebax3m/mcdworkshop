/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookPlus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GARAGE_SOURCES, GARAGE_VERIFICATIONS, logRevision, proposeUpdate } from "@/lib/garage-library";
import { matchModel, PROPOSAL_CATEGORIES } from "@/lib/garage-learning";

type Props = {
  jobId: string;
  motorcycleId?: string | null;
  make?: string | null;
  model?: string | null;
  year?: number | null;
};

/**
 * "Add to Garage Library" from the job card.
 * Admins write verified knowledge directly; technicians submit a proposal.
 * Bike-specific entries never touch model knowledge.
 */
export function AddToLibraryDialog({ jobId, motorcycleId, make, model, year }: Props) {
  const { isAdmin } = useCurrentUser();
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<"model" | "bike">("model");
  const [category, setCategory] = useState("technical");
  const [component, setComponent] = useState("");
  const [value, setValue] = useState("");
  const [unit, setUnit] = useState("Nm");
  const [source, setSource] = useState("manufacturer_manual");
  const [verificationLevel, setVerificationLevel] = useState("manufacturer_verified");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: modelId } = useQuery({
    queryKey: ["garage-match", make, model, year],
    enabled: open && !!make && !!model,
    queryFn: () => matchModel(make, model, year),
  });

  useEffect(() => {
    if (open && !modelId) setScope("bike");
  }, [open, modelId]);

  async function save() {
    if (!component.trim() || !value.trim()) {
      toast.error("Component and value are required");
      return;
    }
    setSaving(true);
    try {
      const { data: auth } = await supabase.auth.getUser();

      if (scope === "bike") {
        if (!motorcycleId) throw new Error("No motorcycle linked to this job");
        const { error } = await supabase.from("motorcycle_knowledge").insert({
          motorcycle_id: motorcycleId,
          category,
          label: component.trim(),
          value: value.trim(),
          unit: unit.trim() || null,
          notes: note.trim() || null,
          job_id: jobId,
          created_by: auth.user?.id ?? null,
        } as any);
        if (error) throw error;
        toast.success("Saved to this motorcycle only");
      } else if (!modelId) {
        throw new Error("This bike is not matched to a Garage Library model yet");
      } else if (isAdmin) {
        if (category === "technical" && unit.toLowerCase() === "nm") {
          const { data, error } = await supabase
            .from("bike_library_torque")
            .insert({
              model_id: modelId,
              fastener: component.trim(),
              torque_nm: Number(value) || null,
              unit: "Nm",
              notes: note.trim() || null,
              source: source as any,
              verification: verificationLevel as any,
              verified_by: auth.user?.id ?? null,
              updated_by: auth.user?.id ?? null,
            } as any)
            .select("id")
            .single();
          if (error) throw error;
          await logRevision({
            modelId,
            entityTable: "bike_library_torque",
            entityId: data.id,
            label: `${component.trim()} torque`,
            newValue: `${value} Nm`,
            action: "create",
            note: note.trim() || `Added from job ${jobId.slice(0, 8)}`,
          });
        } else {
          const { data, error } = await supabase
            .from("garage_notes")
            .insert({
              model_id: modelId,
              title: component.trim(),
              body: `${value.trim()}${unit ? ` ${unit}` : ""}${note ? `\n\n${note}` : ""}`,
              created_by: auth.user?.id ?? null,
            } as any)
            .select("id")
            .single();
          if (error) throw error;
          await logRevision({
            modelId,
            entityTable: "garage_notes",
            entityId: data.id,
            label: component.trim(),
            newValue: value.trim(),
            action: "create",
            note: "Added from job card",
          });
        }
        toast.success("Saved to Garage Library");
      } else {
        await proposeUpdate({
          modelId,
          entityTable: category === "technical" ? "bike_library_torque" : "garage_notes",
          label: component.trim(),
          proposedValue: `${value.trim()}${unit ? ` ${unit}` : ""}`,
          note: note.trim() || null,
          source: source as any,
        });
        await supabase
          .from("garage_update_proposals")
          .update({ category, unit: unit || null, job_id: jobId } as any)
          .eq("model_id", modelId)
          .eq("label", component.trim())
          .eq("status", "pending");
        toast.success("Sent to Admin for verification");
      }
      setOpen(false);
      setComponent("");
      setValue("");
      setNote("");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" className="gap-2" onClick={() => setOpen(true)}>
        <BookPlus className="h-4 w-4" /> Add to Garage Library
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add to Garage Library</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={scope === "model" ? "default" : "outline"}
                disabled={!modelId}
                onClick={() => setScope("model")}
              >
                Model knowledge
              </Button>
              <Button
                type="button"
                size="sm"
                variant={scope === "bike" ? "default" : "outline"}
                onClick={() => setScope("bike")}
              >
                This motorcycle only
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {scope === "model"
                ? `Applies to every ${[make, model].filter(Boolean).join(" ")} in the library.`
                : "Modifications, tuning and performance data stay on this bike and are never generalised."}
            </p>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PROPOSAL_CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                    {scope === "bike" && <SelectItem value="modification">Modification</SelectItem>}
                    {scope === "bike" && <SelectItem value="performance">Performance / dyno</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Component</Label>
                <Input
                  value={component}
                  onChange={(e) => setComponent(e.target.value)}
                  placeholder="Front caliper bolts"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Value</Label>
                <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder="45" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Unit</Label>
                <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="Nm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Source</Label>
                <Select value={source} onValueChange={setSource}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {GARAGE_SOURCES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Verification</Label>
                <Select
                  value={verificationLevel}
                  onValueChange={setVerificationLevel}
                  disabled={!isAdmin}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {GARAGE_VERIFICATIONS.map((v) => (
                      <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Notes / how it was verified</Label>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
            </div>

            {!isAdmin && scope === "model" && (
              <p className="rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
                Technician entries go to the Admin approval queue before they become library reference data.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>
              {isAdmin || scope === "bike" ? "Save" : "Submit for approval"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
