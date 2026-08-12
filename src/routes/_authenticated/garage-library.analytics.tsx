/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Bot, Database, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { modelTitle, yearLabel } from "@/lib/garage-library";
import { COVERAGE_CATEGORIES, coverageRows } from "@/lib/garage-coverage";

export const Route = createFileRoute("/_authenticated/garage-library/analytics")({
  component: AnalyticsPage,
  head: () => ({
    meta: [
      { title: "Knowledge Analytics · MCD Garage Library" },
      {
        name: "description",
        content:
          "Workshop knowledge coverage, most worked models, missing technical data and AI usage for Motorcycle Doctors.",
      },
      { property: "og:title", content: "Knowledge Analytics · MCD Garage Library" },
      { property: "og:description", content: "Track workshop knowledge coverage and AI usage." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const card = "card-surface p-3 space-y-2";
const head = "text-[0.6rem] font-mono uppercase tracking-[0.25em] text-muted-foreground";

function AnalyticsPage() {
  const { data } = useQuery({
    queryKey: ["garage-analytics"],
    queryFn: async () => {
      const [queries, feedback, models, jobs] = await Promise.all([
        supabase.from("garage_queries").select("*").order("created_at", { ascending: false }).limit(1000),
        supabase.from("garage_answer_feedback").select("helpful, reason").limit(1000),
        supabase.from("bike_library_models").select("id, make, model, year_from, year_to").eq("is_archived", false).limit(200),
        supabase.from("jobs").select("id, title, motorcycles(make, model)").limit(1000).order("created_at", { ascending: false }),
      ]);
      return {
        queries: queries.data ?? [],
        feedback: feedback.data ?? [],
        models: models.data ?? [],
        jobs: jobs.data ?? [],
      };
    },
  });

  const queries = data?.queries ?? [];
  const totals = {
    all: queries.length,
    internal: queries.filter((q: any) => q.answer_source === "structured" || q.answer_source === "history").length,
    document: queries.filter((q: any) => q.answer_source === "document").length,
    ai: queries.filter((q: any) => q.used_external_ai).length,
    cached: queries.filter((q: any) => q.cache_hit).length,
    unanswered: queries.filter((q: any) => !q.answered).length,
  };

  const byNorm = new Map<string, { question: string; count: number; answered: number }>();
  for (const q of queries as any[]) {
    const e = byNorm.get(q.question_norm) ?? { question: q.question, count: 0, answered: 0 };
    e.count++;
    if (q.answered) e.answered++;
    byNorm.set(q.question_norm, e);
  }
  const frequent = [...byNorm.values()].sort((a, b) => b.count - a.count).slice(0, 10);
  const missing = [...byNorm.values()].filter((e) => e.answered === 0 && e.count >= 1).sort((a, b) => b.count - a.count).slice(0, 10);

  const bikeCounts = new Map<string, number>();
  for (const j of (data?.jobs ?? []) as any[]) {
    const m = j.motorcycles;
    if (!m?.make) continue;
    const key = `${m.make} ${m.model ?? ""}`.trim();
    bikeCounts.set(key, (bikeCounts.get(key) ?? 0) + 1);
  }
  const topModels = [...bikeCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);

  const serviceCounts = new Map<string, number>();
  for (const j of (data?.jobs ?? []) as any[]) {
    if (!j.service_type) continue;
    serviceCounts.set(j.service_type, (serviceCounts.get(j.service_type) ?? 0) + 1);
  }
  const topServices = [...serviceCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);

  const reasons = new Map<string, number>();
  for (const f of (data?.feedback ?? []) as any[]) {
    if (f.helpful) continue;
    reasons.set(f.reason ?? "Other", (reasons.get(f.reason ?? "Other") ?? 0) + 1);
  }

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-xl font-semibold tracking-wide">Knowledge analytics</h1>
          <p className="text-sm text-muted-foreground">Where workshop knowledge is strong, and where it is missing.</p>
        </div>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" asChild><Link to="/garage-library">Library</Link></Button>
          <Button variant="outline" asChild><Link to="/garage-library/tech">MCD TECH</Link></Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-5">
        {[
          { label: "Questions", value: totals.all, icon: Database },
          { label: "Answered internally", value: totals.internal, icon: Database },
          { label: "From documents", value: totals.document, icon: FileText },
          { label: "External AI", value: totals.ai, icon: Bot },
          { label: "Unanswered", value: totals.unanswered, icon: AlertTriangle },
        ].map((s) => (
          <div key={s.label} className={card}>
            <div className={head}>{s.label}</div>
            <div className="font-display text-2xl">{s.value}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className={card}>
          <div className={head}>Most worked-on models</div>
          {topModels.length === 0 ? <p className="text-sm text-muted-foreground">No job data yet.</p> : topModels.map(([k, v]) => (
            <div key={k} className="flex justify-between text-sm"><span>{k}</span><span className="font-mono text-muted-foreground">{v}</span></div>
          ))}
        </div>
        <div className={card}>
          <div className={head}>Most common jobs</div>
          {topServices.map(([k, v]) => (
            <div key={k} className="flex justify-between text-sm"><span>{k}</span><span className="font-mono text-muted-foreground">{v}</span></div>
          ))}
        </div>
        <div className={card}>
          <div className={head}>Most searched technical questions</div>
          {frequent.length === 0 ? <p className="text-sm text-muted-foreground">No questions logged yet.</p> : frequent.map((f) => (
            <div key={f.question} className="flex justify-between gap-2 text-sm"><span className="truncate">{f.question}</span><span className="font-mono text-muted-foreground">{f.count}</span></div>
          ))}
        </div>
        <div className={card}>
          <div className={head}>Frequently requested — needs verification</div>
          {missing.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing outstanding.</p>
          ) : (
            missing.map((f) => (
              <div key={f.question} className="flex justify-between gap-2 text-sm">
                <span className="truncate text-amber-400">{f.question}</span>
                <span className="font-mono text-muted-foreground">{f.count}×</span>
              </div>
            ))
          )}
        </div>
        {reasons.size > 0 && (
          <div className={card}>
            <div className={head}>Incorrect-answer feedback</div>
            {[...reasons.entries()].map(([k, v]) => (
              <div key={k} className="flex justify-between text-sm"><span>{k}</span><span className="font-mono text-muted-foreground">{v}</span></div>
            ))}
          </div>
        )}
      </div>

      <div className={card}>
        <div className={head}>Knowledge coverage by model</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="text-left py-1 pr-3 font-normal text-muted-foreground">Model</th>
                {COVERAGE_CATEGORIES.map((c) => (
                  <th key={c.key} className="py-1 px-2 text-[0.6rem] font-mono uppercase text-muted-foreground">{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {((data?.models ?? []) as any[]).slice(0, 40).map((m) => (
                <CoverageRow key={m.id} model={m} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function CoverageRow({ model }: { model: any }) {
  const { data } = useQuery({
    queryKey: ["garage-coverage", model.id],
    queryFn: () => coverageRows(model.id),
  });
  return (
    <tr className="border-t border-border/50">
      <td className="py-1 pr-3">
        <Link to="/garage-library/$modelId" params={{ modelId: model.id }} className="hover:underline">
          {modelTitle(model)} <span className="text-muted-foreground">· {yearLabel(model)}</span>
        </Link>
      </td>
      {COVERAGE_CATEGORIES.map((c) => {
        const state = data?.[c.key] ?? "missing";
        return (
          <td key={c.key} className="py-1 px-2 text-center font-mono text-xs">
            <span className={state === "complete" ? "text-emerald-400" : state === "partial" ? "text-amber-400" : "text-muted-foreground"}>
              {state === "complete" ? "✓" : state === "partial" ? "Partial" : "—"}
            </span>
          </td>
        );
      })}
    </tr>
  );
}
