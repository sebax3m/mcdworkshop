import { useState } from "react";
import { Plus, Trash2, Wrench } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

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
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<WorkPerformedEntry>({
    id: "",
    title: "",
    detail: "",
    hours: 0,
  });

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
        {entries.map((e) => (
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
                  <span className="text-xs font-semibold text-muted-foreground">{e.hours} h</span>
                )}
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 print:hidden"
                    disabled={busy}
                    onClick={() => persist(entries.filter((x) => x.id !== e.id))}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {canEdit && (
        <div className="mt-4 space-y-3 print:hidden">
          <div className="rounded-lg border border-dashed border-border/70 p-3">
            <Label className="text-xs">Quick templates — click to fill the work below</Label>
            <div className="mt-2 space-y-2">
              {groups.map(([group, presets]) => (
                <div key={group}>
                  <div className="text-[0.65rem] uppercase tracking-wide text-muted-foreground mb-1">
                    {group}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {presets.map((p) => (
                      <Button
                        key={p.id}
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="h-7 text-xs"
                        onClick={() =>
                          setDraft({
                            id: "",
                            title: p.label,
                            detail: presetDetail(p),
                            hours: p.hours,
                          })
                        }
                      >
                        {p.label}
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
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
              <Label className="text-xs">Labour hours</Label>
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
              rows={3}
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
