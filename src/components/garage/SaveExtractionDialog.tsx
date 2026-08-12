/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import { toast } from "sonner";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCurrentUser } from "@/hooks/use-current-user";
import { supabase } from "@/integrations/supabase/client";
import { logRevision, proposeUpdate } from "@/lib/garage-library";
import type { extractCandidate } from "@/lib/mcd-tech";

type Candidate = NonNullable<ReturnType<typeof extractCandidate>>;

const TARGETS = [
  { value: "bike_library_torque", label: "Torque specification" },
  { value: "garage_fluid_specs", label: "Fluid specification" },
  { value: "garage_valve_specs", label: "Valve clearance" },
  { value: "bike_library_parts", label: "Part" },
];

/**
 * Structured extraction: a value found in a manual is never written silently.
 * The user reviews component/value/unit and confirms; technicians raise a
 * proposal instead of writing to verified knowledge.
 */
export function SaveExtractionDialog({
  candidate,
  modelId,
  onClose,
  onSaved,
}: {
  candidate: Candidate;
  modelId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { isAdmin } = useCurrentUser();
  const sec = candidate.section;
  const [target, setTarget] = useState(
    candidate.unit === "Nm" ? "bike_library_torque" : candidate.unit === "L" ? "garage_fluid_specs" : "bike_library_torque",
  );
  const [component, setComponent] = useState(candidate.component);
  const [value, setValue] = useState(candidate.value);
  const [unit, setUnit] = useState(candidate.unit || "Nm");
  const [note, setNote] = useState(candidate.sentence.slice(0, 300));
  const [saving, setSaving] = useState(false);

  const sourceRef = `${sec.manufacturer} ${sec.title}${sec.version ? ` v${sec.version}` : ""}`;
  const verificationValue =
    sec.verification === "manufacturer_verified" ? "manufacturer_verified" : "workshop_verified";

  async function save() {
    if (!component.trim() || !value.trim()) return toast.error("Component and value are required");
    setSaving(true);
    try {
      if (!isAdmin) {
        await proposeUpdate({
          modelId,
          entityTable: target,
          label: component,
          proposedValue: `${value} ${unit}`.trim(),
          note: `${sourceRef}${note ? ` — ${note}` : ""}`,
          source: "manufacturer_manual" as any,
        });
        toast.success("Sent for admin verification");
      } else {
        const base = { model_id: modelId, source: "manufacturer_manual", verification: verificationValue };
        let error: any = null;
        if (target === "bike_library_torque") {
          ({ error } = await supabase.from("bike_library_torque").insert({
            ...base,
            fastener: component,
            torque_nm: Number(value),
            unit: unit || "Nm",
            notes: `${sourceRef}${note ? ` — ${note}` : ""}`,
          } as any));
        } else if (target === "garage_fluid_specs") {
          ({ error } = await supabase.from("garage_fluid_specs").insert({
            ...base,
            fluid_type: component,
            qty_with_filter: Number(value),
            unit: unit || "L",
            notes: `${sourceRef}${note ? ` — ${note}` : ""}`,
          } as any));
        } else if (target === "garage_valve_specs") {
          ({ error } = await supabase.from("garage_valve_specs").insert({
            ...base,
            intake_min: Number(value),
            unit: unit || "mm",
            measurement_notes: `${component} — ${sourceRef}`,
          } as any));
        } else {
          ({ error } = await supabase.from("bike_library_parts").insert({
            ...base,
            name: component,
            notes: `${value} ${unit} · ${sourceRef}`,
          } as any));
        }
        if (error) throw error;
        await logRevision({
          modelId,
          entityTable: target,
          label: `${component} extracted from ${sourceRef}`,
          newValue: `${value} ${unit}`.trim(),
          action: "create",
          note: sourceRef,
        });
        toast.success("Saved to Garage Library");
      }
      onSaved();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Save to Garage Library</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded border border-border p-2 text-xs font-mono text-muted-foreground">
            {sourceRef} · {sec.doc_model ?? "—"} · {sec.generation ?? `${sec.year_from ?? "?"}–${sec.year_to ?? "?"}`}
          </div>
          <div>
            <Label>Destination</Label>
            <Select value={target} onValueChange={setTarget}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TARGETS.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Component</Label>
            <Input value={component} onChange={(e) => setComponent(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Value</Label>
              <Input value={value} onChange={(e) => setValue(e.target.value)} />
            </div>
            <div>
              <Label>Unit</Label>
              <Input value={unit} onChange={(e) => setUnit(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Source note</Label>
            <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <p className="text-xs text-muted-foreground">
            Verification: {verificationValue.replace("_", " ")}
            {isAdmin ? "" : " — technicians' extractions require admin confirmation."}
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>
            {isAdmin ? "Confirm & save" : "Send for verification"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
