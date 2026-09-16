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
import { TECH_CATEGORIES } from "@/lib/garage-tech";
import type { TechAnswer } from "@/lib/mcd-tech";

const toNum = (v: string) => {
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) && String(v).trim() !== "" ? n : null;
};

/** Build a readable body from whatever the assistant answered. */
export function answerToText(answer: TechAnswer) {
  const lines: string[] = [];
  lines.push(`Q: ${answer.question}`);
  for (const s of answer.specs) {
    lines.push(`${s.label}: ${s.value}${s.note ? ` (${s.note})` : ""}`);
  }
  if (answer.aiText) lines.push(answer.aiText.trim());
  const sec = answer.sections[0];
  if (sec) {
    lines.push(
      `Source: ${sec.manufacturer ?? ""} ${sec.title ?? ""}${sec.version ? ` v${sec.version}` : ""}`.trim(),
    );
  }
  return lines.filter(Boolean).join("\n");
}

/**
 * "This is correct — save it to this bike".
 * Admins write straight into the model's knowledge; technicians raise a
 * verification proposal so nothing unverified lands in the library silently.
 */
export function SaveAnswerDialog({
  answer,
  modelId,
  onClose,
  onSaved,
}: {
  answer: TechAnswer;
  modelId: string;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const { isAdmin, user } = useCurrentUser();
  const [mode, setMode] = useState<"note" | "spec">(answer.specs.length > 0 ? "spec" : "note");
  const [title, setTitle] = useState(answer.heading || answer.question);
  const [body, setBody] = useState(answerToText(answer));
  const [category, setCategory] = useState(TECH_CATEGORIES[0]!.key);
  const [field, setField] = useState(answer.specs[0]?.label ?? answer.question);
  const [value, setValue] = useState(answer.specs[0]?.value ?? "");
  const [unit, setUnit] = useState("");
  const [saving, setSaving] = useState(false);

  const sourceName =
    answer.source === "external_ai"
      ? "MCD TECH AI (confirmed by workshop)"
      : answer.sections[0]
        ? `${answer.sections[0].manufacturer ?? ""} ${answer.sections[0].title ?? ""}`.trim()
        : "MCD TECH";

  async function save() {
    setSaving(true);
    try {
      if (mode === "spec") {
        if (!field.trim() || !value.trim()) throw new Error("Field and value are required");
        if (!isAdmin) {
          await proposeUpdate({
            modelId,
            entityTable: "garage_tech_specs",
            label: field,
            field,
            proposedValue: `${value} ${unit}`.trim(),
            note: `${sourceName} — ${body}`.slice(0, 1000),
            source: "technician_entry" as any,
          });
          toast.success("Sent for admin verification");
        } else {
          const { error } = await supabase.from("garage_tech_specs").insert({
            model_id: modelId,
            category,
            subject: "",
            field,
            value_text: value,
            value_num: toNum(value),
            unit: unit || null,
            notes: body || null,
            source_type: answer.source === "external_ai" ? "ai_assist" : "manual_entry",
            source_name: sourceName,
            verification: "workshop_verified",
            verified_by: user?.id ?? null,
            verified_at: new Date().toISOString(),
            created_by: user?.id ?? null,
            updated_by: user?.id ?? null,
          } as never);
          if (error) throw error;
          await logRevision({
            modelId,
            entityTable: "garage_tech_specs",
            label: field,
            newValue: `${value} ${unit}`.trim(),
            action: "create",
            note: sourceName,
          });
          toast.success("Saved to this bike's library");
        }
      } else {
        if (!body.trim()) throw new Error("Nothing to save");
        if (!isAdmin) {
          await proposeUpdate({
            modelId,
            entityTable: "garage_notes",
            label: title || answer.question,
            proposedValue: body.slice(0, 2000),
            note: sourceName,
            source: "technician_entry" as any,
          });
          toast.success("Sent for admin verification");
        } else {
          const { error } = await supabase.from("garage_notes").insert({
            model_id: modelId,
            title: (title || answer.question).slice(0, 200),
            body: `${body}\n\n— ${sourceName}`,
            created_by: user?.id ?? null,
          } as never);
          if (error) throw error;
          await logRevision({
            modelId,
            entityTable: "garage_notes",
            label: title || answer.question,
            newValue: body.slice(0, 300),
            action: "create",
            note: sourceName,
          });
          toast.success("Saved to this bike's library");
        }
      }
      onSaved?.();
      onClose();
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
          <DialogTitle>Save this answer to the bike</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {!isAdmin && (
            <div className="rounded border border-border p-2 text-xs text-muted-foreground">
              This will be sent for admin verification before it becomes part of the verified library.
            </div>
          )}
          <div>
            <Label>Save as</Label>
            <Select value={mode} onValueChange={(v) => setMode(v as "note" | "spec")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="spec">Technical value (spec)</SelectItem>
                <SelectItem value="note">Workshop note</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {mode === "spec" ? (
            <>
              <div>
                <Label>Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TECH_CATEGORIES.map((c) => (
                      <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <div>
                  <Label>Field</Label>
                  <Input value={field} onChange={(e) => setField(e.target.value)} />
                </div>
                <div className="w-24">
                  <Label>Unit</Label>
                  <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="Nm / L / mm" />
                </div>
              </div>
              <div>
                <Label>Value</Label>
                <Input value={value} onChange={(e) => setValue(e.target.value)} />
              </div>
            </>
          ) : (
            <div>
              <Label>Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
          )}

          <div>
            <Label>{mode === "spec" ? "Notes" : "Content"}</Label>
            <Textarea rows={6} value={body} onChange={(e) => setBody(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? "Saving…" : isAdmin ? "Save to bike" : "Send for verification"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
