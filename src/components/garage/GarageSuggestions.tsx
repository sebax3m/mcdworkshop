/* eslint-disable @typescript-eslint/no-explicit-any */
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { BookOpen, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { fetchObservationSummary, fetchPartUsage, matchModel } from "@/lib/garage-learning";

export type SuggestionBike = {
  make?: string | null;
  model?: string | null;
  year?: number | null;
  motorcycleId?: string | null;
};

export type GarageSuggestion = {
  kind: "labour" | "part";
  label: string;
  detail: string;
  hours?: number | null;
};

const head = "text-[0.65rem] font-mono uppercase tracking-widest text-muted-foreground";

/**
 * Optional Garage Library suggestions for a job / estimate / invoice.
 * Purely advisory — nothing is applied unless the user clicks it.
 */
export function GarageSuggestions({
  bike,
  onAdd,
  title = "Garage Library suggestions",
}: {
  bike: SuggestionBike;
  onAdd?: (s: GarageSuggestion) => void;
  title?: string;
}) {
  const { data: modelId } = useQuery({
    queryKey: ["garage-suggest-model", bike.make, bike.model, bike.year],
    queryFn: () => matchModel(bike.make, bike.model, bike.year),
    enabled: Boolean(bike.make && bike.model),
  });

  const { data: refLabour = [] } = useQuery({
    queryKey: ["garage-suggest-labour", modelId],
    enabled: Boolean(modelId),
    queryFn: async () =>
      (
        await supabase
          .from("bike_library_labour")
          .select("task, hours")
          .eq("model_id", modelId!)
          .eq("is_archived", false)
          .limit(8)
      ).data ?? [],
  });

  const { data: obs } = useQuery({
    queryKey: ["garage-model", modelId, "observations"],
    enabled: Boolean(modelId),
    queryFn: () => fetchObservationSummary(modelId!),
  });

  const { data: usage = [] } = useQuery({
    queryKey: ["garage-model", modelId, "part-usage"],
    enabled: Boolean(modelId),
    queryFn: () => fetchPartUsage(modelId!),
  });

  const { data: overrides = [] } = useQuery({
    queryKey: ["bike-overrides", bike.motorcycleId],
    enabled: Boolean(bike.motorcycleId),
    queryFn: async () =>
      (
        await supabase
          .from("garage_bike_overrides")
          .select("category, subject, field, value_text, unit, reason")
          .eq("motorcycle_id", bike.motorcycleId!)
          .eq("is_archived", false)
      ).data ?? [],
  });

  if (!modelId) return null;

  const labour = (refLabour as any[]).map((l) => ({
    kind: "labour" as const,
    label: l.task,
    hours: Number(l.hours ?? 0) || null,
    detail: "Library reference",
  }));
  const observed = (obs?.labour ?? []).slice(0, 5).map((l: any) => ({
    kind: "labour" as const,
    label: l.label,
    hours: Number(l.avg) || null,
    detail: `Observed on ${l.jobs} job${l.jobs === 1 ? "" : "s"}`,
  }));
  const parts = usage.slice(0, 6).map((p) => ({
    kind: "part" as const,
    label: p.label,
    detail: p.verified ? "Verified part" : `Previously used · ${p.jobs} job${p.jobs === 1 ? "" : "s"}`,
  }));

  const all = [...labour, ...observed, ...parts];
  if (all.length === 0 && overrides.length === 0) return null;

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
          <p className={head}>{title}</p>
        </div>
        <Link
          to="/garage-library/$modelId"
          params={{ modelId }}
          className="font-mono text-[0.6rem] uppercase tracking-widest text-primary hover:underline"
        >
          Open model
        </Link>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">Suggestions only — nothing is added automatically.</p>

      {overrides.length > 0 && (
        <div className="mt-2 rounded border border-amber-500/30 bg-amber-500/5 p-2">
          <p className={head}>This bike has overrides</p>
          <ul className="mt-1 space-y-0.5 text-xs">
            {(overrides as any[]).map((o, i) => (
              <li key={i}>
                {o.subject ? `${o.subject} · ` : ""}
                {o.field}: <strong>{o.value_text} {o.unit ?? ""}</strong>
                {o.reason ? ` — ${o.reason}` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}

      <ul className="mt-2 space-y-1">
        {all.map((s, i) => (
          <li key={`${s.kind}-${s.label}-${i}`} className="flex items-center justify-between gap-2 text-sm">
            <span className="min-w-0 truncate">
              {s.label}
              {"hours" in s && s.hours ? <span className="font-mono text-xs"> · {s.hours} h</span> : null}
              <span className="ml-1 text-xs text-muted-foreground">{s.detail}</span>
            </span>
            {onAdd && (
              <Button size="sm" variant="ghost" onClick={() => onAdd(s as GarageSuggestion)}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
