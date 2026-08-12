/* eslint-disable @typescript-eslint/no-explicit-any */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/hooks/use-current-user";
import { supabase } from "@/integrations/supabase/client";
import { logRevision, proposeUpdate } from "@/lib/garage-library";
import {
  evidenceLabel,
  fetchModelExperience,
  fetchModelJobs,
  fetchObservationSummary,
} from "@/lib/garage-learning";

const cardCls = "rounded-lg border border-border bg-card";
const thCls =
  "px-3 py-2 text-left text-[0.65rem] font-mono uppercase tracking-widest text-muted-foreground";
const tdCls = "px-3 py-2 align-top text-sm";

const dt = (s?: string | null) =>
  s ? new Date(s).toLocaleDateString("en-NZ", { day: "2-digit", month: "short", year: "numeric" }) : "—";

/**
 * Workshop observations for a model: what actually happened on completed jobs.
 * Deliberately separated from verified specifications.
 */
export function WorkshopDataTab({ modelId }: { modelId: string }) {
  const { isAdmin } = useCurrentUser();
  const qc = useQueryClient();

  const { data: exp } = useQuery({
    queryKey: ["garage-model", modelId, "experience"],
    queryFn: () => fetchModelExperience(modelId),
  });
  const { data: obs } = useQuery({
    queryKey: ["garage-model", modelId, "observations"],
    queryFn: () => fetchObservationSummary(modelId),
  });
  const { data: jobs = [] } = useQuery({
    queryKey: ["garage-model", modelId, "prev-jobs"],
    queryFn: () => fetchModelJobs(modelId, 15),
  });
  const { data: refLabour = [] } = useQuery({
    queryKey: ["garage-model", modelId, "labour-ref"],
    queryFn: async () =>
      (
        await supabase
          .from("bike_library_labour")
          .select("id, task, hours")
          .eq("model_id", modelId)
          .eq("is_archived", false)
      ).data ?? [],
  });

  const refFor = (key: string) =>
    (refLabour as any[]).find((r) => (r.task ?? "").toLowerCase().replace(/[^a-z0-9]/g, "") === key);

  async function promotePart(row: any) {
    try {
      if (isAdmin) {
        const { data, error } = await supabase
          .from("bike_library_parts")
          .insert({
            model_id: modelId,
            name: row.label,
            supplier: row.detail ?? null,
            qty: 1,
            source: "workshop_verified",
            verification: "workshop_verified",
          } as any)
          .select("id")
          .single();
        if (error) throw error;
        await logRevision({
          modelId,
          entityTable: "bike_library_parts",
          entityId: data.id,
          label: `${row.label} promoted from workshop usage`,
          newValue: `${row.label}${row.detail ? ` · ${row.detail}` : ""}`,
          action: "create",
          note: `Used on ${row.jobs} completed job(s)`,
        });
        toast.success("Added to Garage Library as workshop verified");
        qc.invalidateQueries({ queryKey: ["garage-model", modelId] });
      } else {
        await proposeUpdate({
          modelId,
          entityTable: "bike_library_parts",
          label: `Add part: ${row.label}`,
          proposedValue: `${row.label}${row.detail ? ` · ${row.detail}` : ""}`,
          note: `Used on ${row.jobs} completed job(s)`,
          source: "previous_job",
        });
        toast.success("Sent to Admin for approval");
      }
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function proposeLabour(row: any) {
    const ref = refFor(row.key);
    try {
      await proposeUpdate({
        modelId,
        entityTable: "bike_library_labour",
        entityId: ref?.id ?? null,
        field: ref ? "hours" : null,
        label: `${row.label} — reference labour`,
        currentValue: ref?.hours != null ? String(ref.hours) : null,
        proposedValue: String(row.avg),
        note: `Observed on ${row.jobs} completed jobs (${row.min}–${row.max} h)`,
        source: "previous_job",
      });
      toast.success("Reference update proposed");
      qc.invalidateQueries({ queryKey: ["garage-proposals"] });
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  return (
    <div className="space-y-4">
      <section className="grid gap-3 sm:grid-cols-4">
        <div className={`${cardCls} p-4`}>
          <div className="text-[0.65rem] font-mono uppercase tracking-widest text-muted-foreground">
            Motorcycles serviced
          </div>
          <div className="mt-1 text-2xl font-semibold">{exp?.bikes ?? "—"}</div>
        </div>
        <div className={`${cardCls} p-4`}>
          <div className="text-[0.65rem] font-mono uppercase tracking-widest text-muted-foreground">
            Completed jobs
          </div>
          <div className="mt-1 text-2xl font-semibold">{exp?.jobs ?? "—"}</div>
        </div>
        <div className={`${cardCls} p-4`}>
          <div className="text-[0.65rem] font-mono uppercase tracking-widest text-muted-foreground">
            Last worked on
          </div>
          <div className="mt-1 font-mono text-sm">{dt(exp?.last_worked)}</div>
        </div>
        <div className={`${cardCls} p-4`}>
          <div className="text-[0.65rem] font-mono uppercase tracking-widest text-muted-foreground">
            Most common operations
          </div>
          <div className="mt-1 space-y-0.5 font-mono text-xs">
            {(exp?.operations ?? []).slice(0, 4).map((o: any) => (
              <div key={o.title} className="flex justify-between gap-2">
                <span className="truncate">{o.title}</span>
                <span className="text-muted-foreground">{o.count}</span>
              </div>
            ))}
            {!exp?.operations?.length && <span className="text-muted-foreground">—</span>}
          </div>
        </div>
      </section>

      <section className={cardCls}>
        <h3 className="px-3 py-2 text-[0.65rem] font-mono uppercase tracking-widest text-muted-foreground border-b border-border">
          Labour observations · not a verified reference
        </h3>
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className={thCls}>Operation</th>
              <th className={thCls}>Reference</th>
              <th className={thCls}>Observed</th>
              <th className={thCls}>Range</th>
              <th className={thCls}>Evidence</th>
              <th className={thCls} />
            </tr>
          </thead>
          <tbody>
            {(obs?.labour ?? []).map((r: any) => {
              const ref = refFor(r.key);
              return (
                <tr key={r.key} className="border-b border-border/50 last:border-0">
                  <td className={tdCls}>{r.label}</td>
                  <td className={`${tdCls} font-mono`}>{ref?.hours != null ? `${ref.hours} h` : "—"}</td>
                  <td className={`${tdCls} font-mono`}>{r.avg} h</td>
                  <td className={`${tdCls} font-mono text-muted-foreground`}>
                    {r.min}–{r.max} h
                  </td>
                  <td className={tdCls}>
                    <span className="rounded border border-border px-1.5 py-0.5 font-mono text-[0.6rem] uppercase text-muted-foreground">
                      {evidenceLabel(Number(r.jobs))}
                    </span>
                  </td>
                  <td className={`${tdCls} text-right`}>
                    <Button size="sm" variant="outline" onClick={() => proposeLabour(r)}>
                      Propose reference
                    </Button>
                  </td>
                </tr>
              );
            })}
            {!obs?.labour?.length && (
              <tr>
                <td className={`${tdCls} text-muted-foreground`} colSpan={6}>
                  No labour recorded from completed jobs yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className={cardCls}>
        <h3 className="px-3 py-2 text-[0.65rem] font-mono uppercase tracking-widest text-muted-foreground border-b border-border">
          Common service parts · workshop used
        </h3>
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className={thCls}>Part</th>
              <th className={thCls}>Supplier</th>
              <th className={thCls}>Used</th>
              <th className={thCls}>Last used</th>
              <th className={thCls} />
            </tr>
          </thead>
          <tbody>
            {(obs?.parts ?? []).map((r: any) => (
              <tr key={r.key} className="border-b border-border/50 last:border-0">
                <td className={tdCls}>{r.label}</td>
                <td className={`${tdCls} text-muted-foreground`}>{r.detail ?? "—"}</td>
                <td className={`${tdCls} font-mono`}>{r.jobs}×</td>
                <td className={`${tdCls} font-mono text-muted-foreground`}>{dt(r.last_at)}</td>
                <td className={`${tdCls} text-right`}>
                  <Button size="sm" variant="outline" onClick={() => promotePart(r)}>
                    {isAdmin ? "Promote to library" : "Propose"}
                  </Button>
                </td>
              </tr>
            ))}
            {!obs?.parts?.length && (
              <tr>
                <td className={`${tdCls} text-muted-foreground`} colSpan={5}>
                  No parts recorded from completed jobs yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className={cardCls}>
        <h3 className="px-3 py-2 text-[0.65rem] font-mono uppercase tracking-widest text-muted-foreground border-b border-border">
          Fluid observations · not a verified specification
        </h3>
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className={thCls}>Fluid</th>
              <th className={thCls}>Typical qty</th>
              <th className={thCls}>Evidence</th>
              <th className={thCls}>Last used</th>
            </tr>
          </thead>
          <tbody>
            {(obs?.fluids ?? []).map((r: any) => (
              <tr key={r.key} className="border-b border-border/50 last:border-0">
                <td className={tdCls}>{r.label}</td>
                <td className={`${tdCls} font-mono`}>{r.avg ? `${r.avg} ${r.unit ?? ""}` : "—"}</td>
                <td className={tdCls}>
                  <span className="rounded border border-border px-1.5 py-0.5 font-mono text-[0.6rem] uppercase text-muted-foreground">
                    {evidenceLabel(Number(r.jobs))}
                  </span>
                </td>
                <td className={`${tdCls} font-mono text-muted-foreground`}>{dt(r.last_at)}</td>
              </tr>
            ))}
            {!obs?.fluids?.length && (
              <tr>
                <td className={`${tdCls} text-muted-foreground`} colSpan={4}>
                  No fluids recorded from completed jobs yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className={cardCls}>
        <h3 className="px-3 py-2 text-[0.65rem] font-mono uppercase tracking-widest text-muted-foreground border-b border-border">
          Previous jobs on this model
        </h3>
        {jobs.length === 0 ? (
          <p className="px-3 py-4 text-sm text-muted-foreground">No completed jobs yet.</p>
        ) : (
          jobs.map((j: any) => (
            <Link
              key={j.job_id}
              to="/jobs/$jobId"
              params={{ jobId: j.job_id }}
              className="flex flex-wrap items-center gap-3 px-3 py-2 border-b border-border/50 last:border-0 hover:bg-muted/40"
            >
              <span className="font-mono text-xs text-muted-foreground">#{j.job_number}</span>
              <span className="text-sm">{j.title}</span>
              <span className="font-mono text-xs text-muted-foreground">
                {j.tracked_minutes > 0
                  ? `${Math.round((j.tracked_minutes / 60) * 10) / 10} h tracked`
                  : j.estimated_hours
                    ? `${j.estimated_hours} h est`
                    : ""}
              </span>
              <span className="ml-auto font-mono text-[0.7rem] text-muted-foreground">
                {dt(j.completed_at)}
              </span>
            </Link>
          ))
        )}
      </section>
    </div>
  );
}
