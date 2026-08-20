import { useState } from "react";
import { Check, Pencil, Plus, Trash2, Wrench } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { WORK_PRESETS, presetDetail, type WorkPreset } from "@/lib/work-presets";
import { useQuery } from "@tanstack/react-query";
import { fetchServiceTemplates, type ServiceTemplate } from "@/lib/service-templates";

const groups: [string, WorkPreset[]][] = Array.from(
  WORK_PRESETS.reduce((m, p) => {
    m.set(p.group, [...(m.get(p.group) ?? []), p]);
    return m;
  }, new Map<string, WorkPreset[]>()),
);

export type WorkPerformedEntry = {
  id: string;
  title: string;
  detail: string;
  hours: number;
};

export function readWorkPerformed(serviceData: any): WorkPerformedEntry[] {
  const raw = serviceData?.work_performed;
  if (!Array.isArray(raw)) return [];
  return raw.map((e: any, i: number) => ({
    id: String(e?.id ?? `wp-${i}`),
    title: String(e?.title ?? ""),
    detail: String(e?.detail ?? ""),
    hours: Number(e?.hours ?? 0) || 0,
  }));
}

export default function WorkPerformedSection({
  jobId,
  serviceData,
  canEdit,
  onChanged,
}: {
  jobId: string;
  serviceData: any;
  canEdit: boolean;
  onChanged: () => void;
}) {
  const entries = readWorkPerformed(serviceData);
  // Master service templates (Basic / Eco, Standard, Annual, Full, WOF…) live in the DB
  // so anything the workshop edits in Settings shows up here immediately.
  const serviceTemplates = useQuery({
    queryKey: ["work-performed-service-templates"],
    queryFn: () => fetchServiceTemplates(),
    staleTime: 60_000,
  });

  function templateEntry(t: ServiceTemplate): WorkPerformedEntry {
    return {
      id: "",
      title: t.name,
      detail: t.tasks.length
        ? t.tasks.map((x) => `• ${x.label}`).join("\n")
        : (t.description ?? ""),
      hours: Number(t.estimated_hours ?? 0) || 0,
    };
  }
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<WorkPerformedEntry>({
    id: "",
    title: "",
    detail: "",
    hours: 0,
  });
  const [selectedPreset, setSelectedPreset] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<WorkPerformedEntry>({
    id: "",
    title: "",
    detail: "",
    hours: 0,
  });

  function applyPresetToEdit(presetId: string) {
    if (presetId.startsWith("tmpl:")) {
      const t = (serviceTemplates.data ?? []).find((x) => `tmpl:${x.id}` === presetId);
      if (!t) return;
      const e = templateEntry(t);
      setEditDraft((d) => ({ ...d, title: e.title, detail: e.detail, hours: e.hours }));
      return;
    }
    const preset = WORK_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setEditDraft((d) => ({
      ...d,
      title: preset.label,
      detail: presetDetail(preset),
      hours: preset.hours,
    }));
  }


  async function persist(next: WorkPerformedEntry[]) {
    setBusy(true);
    const { error } = await supabase
      .from("jobs")
      .update({ service_data: { ...(serviceData ?? {}), work_performed: next } as any })
      .eq("id", jobId);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return false;
    }
    onChanged();
    return true;
  }

  async function add() {
    if (!draft.title.trim()) {
      toast.error("Give the work a short title (e.g. Front caliper overhaul).");
      return;
    }
    const ok = await persist([
      ...entries,
      { ...draft, id: `wp-${Date.now()}`, title: draft.title.trim(), detail: draft.detail.trim() },
    ]);
    if (ok) setDraft({ id: "", title: "", detail: "", hours: 0 });
  }

  async function saveEdit() {
    if (!editDraft.title.trim()) {
      toast.error("Give the work a short title.");
      return;
    }
    const ok = await persist(
      entries.map((x) =>
        x.id === editingId
          ? { ...editDraft, id: x.id, title: editDraft.title.trim(), detail: editDraft.detail.trim() }
          : x,
      ),
    );
    if (ok) setEditingId(null);
  }



  function applyPreset(presetId: string) {
    if (presetId.startsWith("tmpl:")) {
      const t = (serviceTemplates.data ?? []).find((x) => `tmpl:${x.id}` === presetId);
      if (!t) return;
      setDraft(templateEntry(t));
      setSelectedPreset("");
      return;
    }
    const preset = WORK_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setDraft({
      id: "",
      title: preset.label,
      detail: presetDetail(preset),
      hours: preset.hours,
    });
    setSelectedPreset("");
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4" data-print-section="work-performed">
      <div className="flex items-center gap-2 mb-1">
        <Wrench className="h-4 w-4 text-primary" />
        <h2 className="font-display text-lg font-semibold">Work Performed / Additional Work</h2>
      </div>
      <p className="text-xs text-muted-foreground mb-3 print:hidden">
        Anything outside the standard service — overhauls, chain &amp; sprocket replacement, repairs.
        This is carried through to the customer invoice.
      </p>

      {entries.length === 0 && (
        <p className="text-sm text-muted-foreground italic">No additional work recorded.</p>
      )}

      <div className="space-y-2">
        {entries.map((e) =>
          editingId === e.id ? (
            <div key={e.id} className="rounded-lg border border-primary/50 bg-background/60 p-3 space-y-2">
              <div className="grid gap-2 sm:grid-cols-[1fr_120px]">
                <div>
                  <Label className="text-xs">What was done</Label>
                  <Input
                    value={editDraft.title}
                    onChange={(ev) => setEditDraft({ ...editDraft, title: ev.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Suggested hours</Label>
                  <Input
                    type="number"
                    min={0}
                    step={0.25}
                    value={editDraft.hours || ""}
                    onChange={(ev) =>
                      setEditDraft({ ...editDraft, hours: Number(ev.target.value) || 0 })
                    }
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs">Process / details</Label>
                <Textarea
                  rows={6}
                  className="min-h-[160px] resize-y"
                  value={editDraft.detail}
                  onChange={(ev) => setEditDraft({ ...editDraft, detail: ev.target.value })}
                />
              </div>
              <div className="flex items-center gap-2">
                <Select value="" onValueChange={applyPresetToEdit}>
                  <SelectTrigger className="h-9 text-sm w-64">
                    <SelectValue placeholder="Replace with a template…" />
                  </SelectTrigger>
                  <SelectContent>
                    {(serviceTemplates.data ?? []).length > 0 && (
                      <SelectGroup>
                        <SelectLabel>Workshop service templates</SelectLabel>
                        {(serviceTemplates.data ?? []).map((t) => (
                          <SelectItem key={t.id} value={`tmpl:${t.id}`}>
                            {t.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    )}
                    {groups.map(([group, presets]) => (
                      <SelectGroup key={group}>
                        <SelectLabel>{group}</SelectLabel>
                        {presets.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
                <div className="ml-auto flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>
                    Cancel
                  </Button>
                  <Button size="sm" disabled={busy} onClick={saveEdit} className="gap-2">
                    <Check className="h-4 w-4" /> Save
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div key={e.id} className="rounded-lg border border-border/70 bg-background/40 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold text-sm">{e.title}</div>
                  {e.detail && (
                    <div className="text-sm text-muted-foreground whitespace-pre-wrap mt-1">
                      {e.detail}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {e.hours > 0 && (
                    <span className="text-xs text-muted-foreground print:hidden">
                      ~{e.hours} h suggested
                    </span>
                  )}
                  {canEdit && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 print:hidden"
                        onClick={() => {
                          setEditingId(e.id);
                          setEditDraft({ ...e });
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 print:hidden"
                        disabled={busy}
                        onClick={() => persist(entries.filter((x) => x.id !== e.id))}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ),
        )}
      </div>


      {canEdit && (
        <div className="mt-4 space-y-3 print:hidden">
          <div className="rounded-lg border border-dashed border-border/70 p-3">
            <Label className="text-xs">Quick template</Label>
            <Select value={selectedPreset} onValueChange={applyPreset}>
              <SelectTrigger className="mt-2 h-9 text-sm">
                <SelectValue placeholder="Pick a preset to fill the form below…" />
              </SelectTrigger>
              <SelectContent>
                {(serviceTemplates.data ?? []).length > 0 && (
                  <SelectGroup>
                    <SelectLabel>Workshop service templates</SelectLabel>
                    {(serviceTemplates.data ?? []).map((t) => (
                      <SelectItem key={t.id} value={`tmpl:${t.id}`}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                )}
                {groups.map(([group, presets]) => (
                  <SelectGroup key={group}>
                    <SelectLabel>{group}</SelectLabel>
                    {presets.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2 sm:grid-cols-[1fr_120px]">
            <div>
              <Label className="text-xs">What was done</Label>
              <Input
                value={draft.title}
                placeholder="e.g. Front caliper overhaul"
                onChange={(ev) => setDraft({ ...draft, title: ev.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs">Suggested hours</Label>
              <Input
                type="number"
                min={0}
                step={0.25}
                value={draft.hours || ""}
                onChange={(ev) => setDraft({ ...draft, hours: Number(ev.target.value) || 0 })}
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">Process / details</Label>
            <Textarea
              rows={6}
              className="min-h-[160px] resize-y"
              value={draft.detail}
              placeholder="Stripped caliper, cleaned pistons and seals, new seal kit, bled system, tested."
              onChange={(ev) => setDraft({ ...draft, detail: ev.target.value })}
            />
          </div>
          <Button onClick={add} disabled={busy} className="gap-2">
            <Plus className="h-4 w-4" /> Add work
          </Button>
        </div>
      )}
    </div>
  );
}
