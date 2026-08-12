/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ClipboardList, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildJobBrief } from "@/lib/garage-brief";
import { ChecklistRunner } from "@/components/garage/ChecklistRunner";
import { TechAskPanel } from "@/components/garage/TechAskPanel";

/**
 * PREPARE JOB — gathers verified library data, documentation, checklists and
 * this motorcycle's history into one technical brief before work starts.
 */
export function JobTechnicalBrief({ jobId }: { jobId: string }) {
  const [prepared, setPrepared] = useState(false);
  const { data: brief, isFetching } = useQuery({
    queryKey: ["job-brief", jobId],
    queryFn: () => buildJobBrief(jobId),
    enabled: prepared,
  });
  const [openList, setOpenList] = useState<string | null>(null);

  if (!prepared)
    return (
      <div className="card-surface p-3 flex items-center gap-3">
        <Sparkles className="h-4 w-4 text-amber-400" />
        <div className="text-sm">
          <div className="font-medium">Job technical brief</div>
          <div className="text-muted-foreground text-xs">
            Gather specs, torques, fluids, checklists and previous experience for this motorcycle.
          </div>
        </div>
        <Button className="ml-auto" size="sm" onClick={() => setPrepared(true)}>
          Prepare job
        </Button>
      </div>
    );

  if (isFetching || !brief)
    return (
      <div className="card-surface p-3 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Preparing technical brief…
      </div>
    );

  return (
    <div className="card-surface p-4 space-y-4">
      <div className="flex items-start gap-2 flex-wrap">
        <div>
          <h3 className="font-display text-sm font-semibold tracking-wide">JOB TECHNICAL BRIEF</h3>
          <div className="text-xs font-mono text-muted-foreground">
            {brief.bikeLabel} · {brief.jobLabel}
          </div>
        </div>
        <div className="ml-auto text-xs font-mono text-muted-foreground">
          {brief.experience.jobs} previous job{brief.experience.jobs === 1 ? "" : "s"} on this motorcycle
        </div>
      </div>

      {brief.warnings.length > 0 && (
        <div className="rounded border border-amber-500/40 bg-amber-500/10 p-2 space-y-1">
          {brief.warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-1 text-xs text-amber-300">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" /> {w}
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {brief.sections.map((s) => (
          <div key={s.title} className="rounded border border-border p-2">
            <div className="text-[0.6rem] font-mono uppercase tracking-[0.25em] text-muted-foreground mb-1">
              {s.title}
            </div>
            <table className="w-full text-sm">
              <tbody>
                {s.rows.map((r, i) => (
                  <tr key={i} className="border-b border-border/40 last:border-0">
                    <td className="py-1 pr-2 text-muted-foreground">{r.label}</td>
                    <td className="py-1 font-mono">
                      {r.value}
                      {r.note ? <span className="text-muted-foreground"> · {r.note}</span> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      {brief.suggestedParts.length > 0 && (
        <div className="rounded border border-border p-2">
          <div className="text-[0.6rem] font-mono uppercase tracking-[0.25em] text-muted-foreground mb-1">
            Commonly required parts (not ordered or invoiced automatically)
          </div>
          <div className="flex flex-wrap gap-1">
            {brief.suggestedParts.map((p, i) => (
              <span key={i} className="rounded border border-border px-1.5 py-0.5 text-xs">
                {p.label}
                {p.detail ? <span className="text-muted-foreground"> · {p.detail}</span> : null}
              </span>
            ))}
          </div>
        </div>
      )}

      {brief.checklists.length > 0 && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1">
            {brief.checklists.map((c) => (
              <Button
                key={c.operation_key}
                size="sm"
                variant={openList === c.operation_key ? "default" : "outline"}
                className="h-7 text-xs gap-1"
                onClick={() => setOpenList(openList === c.operation_key ? null : c.operation_key)}
              >
                <ClipboardList className="h-3.5 w-3.5" /> {c.title}
              </Button>
            ))}
          </div>
          {openList && <ChecklistRunner operationKey={openList} modelId={brief.modelId} jobId={jobId} />}
        </div>
      )}

      <div className="pt-2 border-t border-border">
        <TechAskPanel
          compact
          bike={{
            modelId: brief.modelId,
            motorcycleId: brief.motorcycleId,
            jobId,
            make: brief.bikeLabel.split(" ")[1] ?? null,
            model: brief.bikeLabel.split(" ").slice(2).join(" ") || null,
            year: Number(brief.bikeLabel.split(" ")[0]) || null,
          }}
        />
      </div>
    </div>
  );
}
