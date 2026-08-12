import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { uploadPhoto } from "@/lib/photos";
import {
  CATEGORY_LABEL,
  FINDING_CATEGORIES,
  FINDING_PRESETS,
  INSPECTION_LABOUR_RATE,
  SEVERITIES,
  SEVERITY_META,
  findingDefaults,
  type InspectionFinding,
} from "@/lib/inspection";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Trash2 } from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  jobId: string;
  userId: string;
  finding: InspectionFinding | null;
  onDelete?: (f: InspectionFinding) => Promise<void>;
  onSaved: () => void;
};

export function FindingDialog({ open, onOpenChange, jobId, userId, finding, onSaved, onDelete }: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string>("other");
  const [severity, setSeverity] = useState<string>("recommended");
  const [action, setAction] = useState("");
  const [labour, setLabour] = useState("");
  const [partsCost, setPartsCost] = useState("");
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(finding?.title ?? "");
    setDescription(finding?.description ?? "");
    setCategory(finding?.category ?? "other");
    setSeverity(finding?.severity ?? "recommended");
    setAction(finding?.recommended_action ?? "");
    setLabour(finding?.estimated_labour != null ? String(finding.estimated_labour) : "");
    setPartsCost(finding?.estimated_parts_cost != null ? String(finding.estimated_parts_cost) : "");
    setPhotoPath(finding?.photo_path ?? null);
  }, [open, finding]);

  async function onPickPhoto(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      const path = await uploadPhoto(file, `jobs/${jobId}/inspection`);
      setPhotoPath(path);
      toast.success("Photo attached");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (!title.trim()) return toast.error("Give the finding a title");
    setSaving(true);
    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      category,
      severity,
      recommended_action: action.trim() || null,
      estimated_labour: labour ? Number(labour) : null,
      estimated_parts_cost: partsCost ? Number(partsCost) : null,
      photo_path: photoPath,
    };
    const { error } = finding
      ? await supabase.from("job_inspection_findings").update(payload).eq("id", finding.id)
      : await supabase
          .from("job_inspection_findings")
          .insert({ ...payload, job_id: jobId, created_by: userId, status: "draft" });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(finding ? "Finding updated" : "Finding added");
    onSaved();
    onOpenChange(false);
  }

  async function remove() {
    if (!finding || !onDelete) return;
    setDeleting(true);
    try {
      await onDelete(finding);
      onOpenChange(false);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{finding ? "Edit finding" : "Add inspection finding"}</DialogTitle>
        </DialogHeader>

        {!finding && (
          <div className="flex flex-wrap gap-1.5">
            {FINDING_PRESETS.map((p) => (
              <button
                key={p.title}
                type="button"
                onClick={() => {
                  setTitle(p.title);
                  setCategory(p.category);
                  setSeverity(p.severity);
                  setAction(p.action ?? "");
                  setLabour(String(p.labour));
                  setPartsCost(String(p.parts));
                }}
                className="rounded-full border border-border px-2.5 py-1 text-[0.6875rem] font-medium text-muted-foreground hover:border-primary/50 hover:text-foreground"
              >
                + {p.title}
              </button>
            ))}
          </div>
        )}

        <div className="space-y-3">
          <div>
            <Label htmlFor="f-title">Title</Label>
            <Input
              id="f-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Chain & sprockets worn"
            />
          </div>

          <div>
            <Label>Category</Label>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {FINDING_CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[0.6875rem] font-semibold",
                    category === c
                      ? "border-primary/50 bg-primary/15 text-primary"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {CATEGORY_LABEL[c]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label>Severity</Label>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {SEVERITIES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSeverity(s)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[0.6875rem] font-semibold",
                    severity === s
                      ? SEVERITY_META[s]!.chip
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {SEVERITY_META[s]!.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label htmlFor="f-desc">Condition / notes</Label>
            <Textarea
              id="f-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Chain heavily worn and sprockets hooked."
            />
          </div>

          <div>
            <Label htmlFor="f-action">Recommended action</Label>
            <Textarea
              id="f-action"
              value={action}
              onChange={(e) => setAction(e.target.value)}
              rows={2}
              placeholder="Replace chain and sprocket kit."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="f-labour">Est. labour (h)</Label>
              <Input
                id="f-labour"
                inputMode="decimal"
                value={labour}
                onChange={(e) => setLabour(e.target.value)}
                placeholder="1.5"
              />
            </div>
            <div>
              <Label htmlFor="f-parts">Est. parts ($)</Label>
              <Input
                id="f-parts"
                inputMode="decimal"
                value={partsCost}
                onChange={(e) => setPartsCost(e.target.value)}
                placeholder="320"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="f-photo">Photo (optional)</Label>
            <Input
              id="f-photo"
              type="file"
              accept="image/*"
              onChange={(e) => onPickPhoto(e.target.files?.[0])}
            />
            {uploading && <div className="text-xs text-muted-foreground mt-1">Uploading…</div>}
            {photoPath && !uploading && (
              <div className="text-xs text-muted-foreground mt-1">Photo attached ✓</div>
            )}
          </div>
        </div>

        <DialogFooter>
          <div className="flex items-center gap-2 w-full justify-between">
            {finding ? (
              <Button
                variant="outline"
                onClick={remove}
                disabled={deleting}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                {deleting ? "Deleting…" : "Delete"}
              </Button>
            ) : (
              <span />
            )}
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={save} disabled={saving || uploading}>
                {saving ? "Saving…" : finding ? "Save changes" : "Add finding"}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
