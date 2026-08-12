/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AnswerCard } from "@/components/garage/AnswerCard";
import { supabase } from "@/integrations/supabase/client";
import { modelTitle, yearLabel } from "@/lib/garage-library";
import { askTech, type TechAnswer } from "@/lib/mcd-tech";

export const Route = createFileRoute("/_authenticated/garage-library/tech")({
  component: TechPage,
  head: () => ({
    meta: [
      { title: "MCD TECH · Technical search" },
      {
        name: "description",
        content:
          "Unified workshop technical search across motorcycle models, specifications, manuals, parts and previous jobs.",
      },
      { property: "og:title", content: "MCD TECH · Technical search" },
      { property: "og:description", content: "Search verified workshop knowledge, manuals and job history." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

async function searchEverything(term: string) {
  const like = `%${term}%`;
  const [models, parts, labour, torque, docs, jobs, notes] = await Promise.all([
    supabase.from("bike_library_models").select("id, make, model, year_from, year_to").or(`make.ilike.${like},model.ilike.${like}`).eq("is_archived", false).limit(8),
    supabase.from("bike_library_parts").select("id, name, brand, part_number, model_id").ilike("name", like).eq("is_archived", false).limit(8),
    supabase.from("bike_library_labour").select("id, task, hours, model_id").ilike("task", like).eq("is_archived", false).limit(8),
    supabase.from("bike_library_torque").select("id, fastener, torque_nm, unit, model_id").ilike("fastener", like).eq("is_archived", false).limit(8),
    supabase.from("garage_documents").select("id, title, manufacturer, model, generation").or(`title.ilike.${like},manufacturer.ilike.${like},model.ilike.${like}`).eq("is_archived", false).limit(8),
    supabase.from("jobs").select("id, job_number, title, created_at, motorcycles(make, model, rego)").limit(200).order("created_at", { ascending: false }),
    supabase.from("garage_document_chunks").select("id, document_id, heading, content, page_from").ilike("content", like).limit(6),
  ]);
  const t = term.toLowerCase();
  const jobHits = (jobs.data ?? []).filter((j: any) =>
    [j.job_number, j.title, j.motorcycles?.make, j.motorcycles?.model, j.motorcycles?.rego]
      .filter(Boolean)
      .some((v: string) => String(v).toLowerCase().includes(t)),
  ).slice(0, 8);
  return {
    models: models.data ?? [],
    parts: parts.data ?? [],
    labour: labour.data ?? [],
    torque: torque.data ?? [],
    docs: docs.data ?? [],
    jobs: jobHits,
    sections: notes.data ?? [],
  };
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card-surface p-3 space-y-1">
      <div className="text-[0.6rem] font-mono uppercase tracking-[0.25em] text-muted-foreground">{title}</div>
      {children}
    </div>
  );
}

function TechPage() {
  const [term, setTerm] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [modelId, setModelId] = useState("");
  const [asking, setAsking] = useState(false);
  const [answer, setAnswer] = useState<TechAnswer | null>(null);

  const { data: models = [] } = useQuery({
    queryKey: ["bike-library-models", "picker"],
    queryFn: async () =>
      (
        await supabase
          .from("bike_library_models")
          .select("id, make, model, year_from, year_to")
          .eq("is_archived", false)
          .order("make")
      ).data ?? [],
  });
  const selected = (models as any[]).find((m) => m.id === modelId);

  const { data: results, isFetching } = useQuery({
    queryKey: ["tech-search", submitted],
    queryFn: () => searchEverything(submitted),
    enabled: submitted.length > 1,
  });

  async function ask() {
    if (!term.trim()) return;
    setAsking(true);
    try {
      setAnswer(
        await askTech(term, {
          modelId: modelId || null,
          make: selected?.make ?? null,
          model: selected?.model ?? null,
          year: selected?.year_from ?? null,
        }),
      );
    } finally {
      setAsking(false);
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-xl font-semibold tracking-wide">MCD TECH</h1>
          <p className="text-sm text-muted-foreground">
            Verified library first, then manuals, then workshop history. External AI only as last fallback.
          </p>
        </div>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" asChild><Link to="/garage-library">Library</Link></Button>
          <Button variant="outline" asChild><Link to="/garage-library/documents">Documents</Link></Button>
          <Button variant="outline" asChild><Link to="/garage-library/analytics">Analytics</Link></Button>
        </div>
      </div>

      <div className="card-surface p-3 space-y-2">
        <div className="flex gap-2 flex-wrap">
          <Input
            className="flex-1 min-w-[240px]"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && setSubmitted(term.trim())}
            placeholder='Search everything — e.g. "MT09 fork" — or ask a technical question'
          />
          <Select value={modelId || "none"} onValueChange={(v) => setModelId(v === "none" ? "" : v)}>
            <SelectTrigger className="w-[240px]"><SelectValue placeholder="Motorcycle model" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No model selected</SelectItem>
              {(models as any[]).map((m) => (
                <SelectItem key={m.id} value={m.id}>{modelTitle(m)} · {yearLabel(m)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" className="gap-1" onClick={() => setSubmitted(term.trim())}>
            <Search className="h-4 w-4" /> Search
          </Button>
          <Button className="gap-1" onClick={() => void ask()} disabled={asking}>
            {asking ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Ask MCD TECH
          </Button>
        </div>
        {!modelId && (
          <p className="text-xs text-muted-foreground">
            Select the exact model so manuals from other generations are never used.
          </p>
        )}
      </div>

      {answer && <AnswerCard answer={answer} modelId={modelId || null} />}

      {isFetching && <div className="text-sm text-muted-foreground">Searching…</div>}
      {results && (
        <div className="grid gap-3 md:grid-cols-2">
          {results.models.length > 0 && (
            <Group title="Motorcycle models">
              {results.models.map((m: any) => (
                <Link key={m.id} to="/garage-library/$modelId" params={{ modelId: m.id }} className="block text-sm hover:underline">
                  {modelTitle(m)} · {yearLabel(m)}
                </Link>
              ))}
            </Group>
          )}
          {results.labour.length > 0 && (
            <Group title="Operations / labour">
              {results.labour.map((l: any) => (
                <div key={l.id} className="text-sm flex justify-between gap-2">
                  <span>{l.task}</span>
                  <span className="font-mono text-muted-foreground">{l.hours ?? "—"} h</span>
                </div>
              ))}
            </Group>
          )}
          {results.parts.length > 0 && (
            <Group title="Parts">
              {results.parts.map((p: any) => (
                <div key={p.id} className="text-sm flex justify-between gap-2">
                  <span>{p.name}</span>
                  <span className="font-mono text-muted-foreground">{[p.brand, p.part_number].filter(Boolean).join(" ")}</span>
                </div>
              ))}
            </Group>
          )}
          {results.torque.length > 0 && (
            <Group title="Torque specifications">
              {results.torque.map((t: any) => (
                <div key={t.id} className="text-sm flex justify-between gap-2">
                  <span>{t.fastener}</span>
                  <span className="font-mono text-muted-foreground">{t.torque_nm} {t.unit ?? "Nm"}</span>
                </div>
              ))}
            </Group>
          )}
          {results.docs.length > 0 && (
            <Group title="Documents">
              {results.docs.map((d: any) => (
                <div key={d.id} className="text-sm">
                  {d.title}
                  <span className="text-muted-foreground font-mono text-xs"> · {d.manufacturer} {d.model ?? ""} {d.generation ?? ""}</span>
                </div>
              ))}
            </Group>
          )}
          {results.sections.length > 0 && (
            <Group title="Manual sections">
              {results.sections.map((s: any) => (
                <div key={s.id} className="text-xs text-muted-foreground line-clamp-2">
                  {s.heading ? <span className="text-foreground">{s.heading} · </span> : null}
                  {s.content.slice(0, 180)}…
                </div>
              ))}
            </Group>
          )}
          {results.jobs.length > 0 && (
            <Group title="Previous jobs">
              {results.jobs.map((j: any) => (
                <Link key={j.id} to="/jobs/$jobId" params={{ jobId: j.id }} className="block text-sm hover:underline">
                  #{j.job_number} · {j.motorcycles?.make} {j.motorcycles?.model} {j.motorcycles?.rego ? `· ${j.motorcycles.rego}` : ""}
                </Link>
              ))}
            </Group>
          )}
        </div>
      )}
    </div>
  );
}
