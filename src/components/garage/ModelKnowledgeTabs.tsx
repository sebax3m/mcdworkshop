/* eslint-disable @typescript-eslint/no-explicit-any */
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { BookOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { COVERAGE_CATEGORIES, coverageRows } from "@/lib/garage-coverage";
import { VerificationBadge } from "@/components/garage/SpecMeta";
import { docTypeLabel } from "@/lib/garage-docs";
import { Button } from "@/components/ui/button";

export function KnowledgeCoverageCard({ modelId }: { modelId: string }) {
  const { data } = useQuery({
    queryKey: ["garage-coverage", modelId],
    queryFn: () => coverageRows(modelId),
  });
  return (
    <div className="card-surface p-3">
      <div className="text-[0.6rem] font-mono uppercase tracking-[0.25em] text-muted-foreground mb-2">
        Knowledge coverage
      </div>
      <div className="grid gap-1 sm:grid-cols-2">
        {COVERAGE_CATEGORIES.map((c) => {
          const state = data?.[c.key] ?? "missing";
          return (
            <div key={c.key} className="flex items-center justify-between text-sm">
              <span>{c.label}</span>
              <span
                className={`font-mono text-xs ${
                  state === "complete" ? "text-emerald-400" : state === "partial" ? "text-amber-400" : "text-muted-foreground"
                }`}
              >
                {state === "complete" ? "✓" : state === "partial" ? "Partial" : "Missing"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ModelDocumentsTab({ modelId }: { modelId: string }) {
  const { data: docs = [] } = useQuery({
    queryKey: ["garage-documents", "model", modelId],
    queryFn: async () =>
      (
        await supabase
          .from("garage_documents")
          .select("*")
          .eq("model_id", modelId)
          .eq("is_archived", false)
          .order("created_at", { ascending: false })
      ).data ?? [],
  });

  if ((docs as any[]).length === 0)
    return (
      <div className="card-surface p-6 text-center text-sm text-muted-foreground space-y-2">
        <p>No documentation linked to this exact model and generation.</p>
        <Button variant="outline" size="sm" asChild>
          <Link to="/garage-library/documents">Open document library</Link>
        </Button>
      </div>
    );

  return (
    <div className="grid gap-2">
      {(docs as any[]).map((d) => (
        <div key={d.id} className="card-surface p-3 flex items-start gap-3">
          <BookOpen className="h-4 w-4 mt-1 text-sky-400 shrink-0" />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium">{d.title}</span>
              <span className="text-[0.6rem] font-mono uppercase rounded border border-border px-1.5 py-0.5 text-muted-foreground">
                {docTypeLabel(d.doc_type)}
              </span>
              <VerificationBadge value={d.verification} />
            </div>
            <div className="text-xs font-mono text-muted-foreground">
              {d.manufacturer} {d.model ?? ""} · {d.generation ?? `${d.year_from ?? "?"}–${d.year_to ?? "?"}`}
              {d.version ? ` · v${d.version}` : ""}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
