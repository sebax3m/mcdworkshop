import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Wrench, Gauge, Sparkles, ShieldCheck, Zap, ShieldAlert, Check, Pencil, Plus, Trash2, GripVertical, Printer } from "lucide-react";
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import logoAsset from "@/assets/motorcycle-doctors-logo.png.asset.json";

export const Route = createFileRoute("/_authenticated/templates")({
  component: Templates,
});

const META: Record<string, { icon: any; tagline: string }> = {
  "Basic Service": { icon: Sparkles, tagline: "Essential maintenance" },
  "Annual Service": { icon: Wrench, tagline: "Yearly comprehensive service" },
  "Standard Service": { icon: ShieldCheck, tagline: "Recommended service" },
  "Full Service": { icon: Zap, tagline: "Complete performance care" },
  "Dyno Tune": { icon: Gauge, tagline: "Power, torque & AFR optimisation" },
  "Collision Repair": { icon: ShieldAlert, tagline: "Insurance & crash repairs" },
};

function taskLabel(t: any): string {
  if (typeof t === "string") return t;
  if (t && typeof t === "object") return t.label ?? t.name ?? "";
  return "";
}

function Templates() {
  const qc = useQueryClient();
  const { data: templates = [] } = useQuery({
    queryKey: ["templates-page"],
    queryFn: async () => (await supabase.from("service_templates").select("*").order("sort_order")).data ?? [],
  });

  const unique = Array.from(new Map((templates as any[]).map((t) => [t.name, t])).values());
  const [editing, setEditing] = useState<any | null>(null);
  const [printing, setPrinting] = useState<any | null>(null);

  useEffect(() => {
    if (!printing) return;
    const t = setTimeout(() => window.print(), 120);
    const done = () => setPrinting(null);
    window.addEventListener("afterprint", done);
    return () => {
      clearTimeout(t);
      window.removeEventListener("afterprint", done);
    };
  }, [printing]);

  return (
    <div className="space-y-5">
      <header>
        <div className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Workshop</div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold">Service Templates</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Edit a template and every new job created from it will use the updated checklist.
        </p>
      </header>

      <div className="grid md:grid-cols-2 gap-4">
        {unique.map((t: any) => {
          const meta = META[t.name] ?? { icon: Wrench, tagline: "Service" };
          const Icon = meta.icon;
          const tasks: any[] = Array.isArray(t.tasks) ? t.tasks : [];
          return (
            <div key={t.id} className="card-surface p-5 flex flex-col">
              <div className="flex items-start gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary shrink-0">
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] uppercase tracking-wider text-primary">{meta.tagline}</div>
                  <div className="font-display text-xl font-bold leading-tight">{t.name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">~{t.estimated_hours}h estimated</div>
                </div>
                <Button size="sm" variant="outline" onClick={() => setPrinting(t)}>
                  <Printer className="h-3.5 w-3.5 mr-1" /> Print
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEditing(t)}>
                  <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                </Button>
              </div>
              {t.description && (
                <p className="text-sm text-muted-foreground mt-3 leading-relaxed">{t.description}</p>
              )}
              {tasks.length > 0 && (
                <ul className="mt-4 space-y-2">
                  {tasks.map((task, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <span>{taskLabel(task)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      {editing && (
        <EditTemplateDialog
          template={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            qc.invalidateQueries({ queryKey: ["templates-page"] });
            qc.invalidateQueries({ queryKey: ["service-templates"] });
          }}
        />
      )}

      {printing && <PrintableTemplate template={printing} onClose={() => setPrinting(null)} />}
    </div>
  );
}

function EditTemplateDialog({ template, onClose, onSaved }: { template: any; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState<string>(template.name ?? "");
  const [description, setDescription] = useState<string>(template.description ?? "");
  const [hours, setHours] = useState<string>(String(template.estimated_hours ?? ""));
  const [tasks, setTasks] = useState<string[]>(
    (Array.isArray(template.tasks) ? template.tasks : []).map(taskLabel).filter(Boolean)
  );

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        estimated_hours: hours ? Number(hours) : null,
        tasks: tasks.filter((t) => t.trim()).map((label) => ({ label: label.trim() })),
      };
      const { error } = await supabase.from("service_templates").update(payload).eq("id", template.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Template updated");
      onSaved();
    },
    onError: (e: any) => toast.error(e.message ?? "Update failed"),
  });

  const updateTask = (i: number, v: string) => setTasks((arr) => arr.map((t, idx) => (idx === i ? v : t)));
  const removeTask = (i: number) => setTasks((arr) => arr.filter((_, idx) => idx !== i));
  const addTask = () => setTasks((arr) => [...arr, ""]);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Template</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid sm:grid-cols-[1fr_140px] gap-3">
            <div>
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label>Hours</Label>
              <Input type="number" step="0.25" value={hours} onChange={(e) => setHours(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Checklist items</Label>
              <Button size="sm" variant="outline" onClick={addTask}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add item
              </Button>
            </div>
            <div className="space-y-2">
              {tasks.map((t, i) => (
                <div key={i} className="flex items-center gap-2">
                  <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                  <Input value={t} onChange={(e) => updateTask(i, e.target.value)} />
                  <Button size="icon" variant="ghost" onClick={() => removeTask(i)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
              {tasks.length === 0 && (
                <p className="text-sm text-muted-foreground">No items yet — click "Add item".</p>
              )}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
