/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileUp, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { fetchAllRows } from "@/lib/fetch-all";
import type { CatalogueModel } from "@/lib/garage-catalogue";
import { techCategoryLabel, techFieldLabel, type TechSpec } from "@/lib/garage-tech";
import {
  CONFIDENCE_TONE,
  RESEARCH_IMPORT_COLUMNS,
  RESEARCH_SAMPLE,
  buildResearchPreview,
  parseResearchImport,
  stageResearchRows,
  type ResearchPreviewRow,
} from "@/lib/garage-research";

const head = "text-[0.65rem] font-mono uppercase tracking-widest text-muted-foreground";

/**
 * Curated external / ChatGPT batch import.
 * PREVIEW -> VALIDATE MODEL -> CHECK CONFLICTS -> IMPORT TO STAGING.
 * Nothing here writes verified Garage Library data.
 */
export function ResearchImport({ onImported }: { onImported?: () => void }) {
  const qc = useQueryClient();
  const [raw, setRaw] = useState("");
  const [preview, setPreview] = useState<ResearchPreviewRow[] | null>(null);
  const [busy, setBusy] = useState(false);

  const { data: models = [] } = useQuery({
    queryKey: ["catalogue-models-all"],
    queryFn: () =>
      fetchAllRows<CatalogueModel>((from, to) =>
        supabase
          .from("bike_library_models")
          .select("id, make, model, generation, variant, engine, platform, category, priority, market_status, year_from, year_to")
          .eq("is_archived", false)
          .order("make")
          .range(from, to),
      ),
  });

  const { data: specs = [] } = useQuery({
    queryKey: ["tech-specs-all"],
    queryFn: () =>
      fetchAllRows<TechSpec>((from, to) =>
        supabase.from("garage_tech_specs").select("*").eq("is_archived", false).range(from, to),
      ),
  });

  const counts = useMemo(() => {
    const p = preview ?? [];
    return {
      ok: p.filter((r) => r.ok).length,
      invalid: p.filter((r) => !r.ok).length,
      conflicts: p.filter((r) => r.conflict).length,
      protectedConflicts: p.filter((r) => r.protectedConflict).length,
    };
  }, [preview]);

  function validate() {
    try {
      const rows = parseResearchImport(raw);
      if (!rows.length) return toast.error("Nothing to import");
      setPreview(buildResearchPreview(rows, models, specs));
    } catch (e: any) {
      toast.error(`Could not read the file: ${e.message}`);
    }
  }

  async function confirm() {
    if (!preview) return;
    setBusy(true);
    try {
      const res = await stageResearchRows(preview, "chatgpt_import");
      toast.success(`${res.staged} value(s) imported to staging — awaiting human review`);
      setPreview(null);
      setRaw("");
      qc.invalidateQueries({ queryKey: ["research-results"] });
      onImported?.();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
        <p className={head}>Curated external data (ChatGPT / research)</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Everything imported here is treated as <strong>EXTERNAL RESEARCH</strong> and lands in staging as
          unverified. It only becomes Garage Library data after a person reviews it.
        </p>
        <p className="mt-1 font-mono text-[0.65rem] text-muted-foreground">
          Columns: {RESEARCH_IMPORT_COLUMNS.join(", ")}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <label className="inline-flex">
          <input
            type="file"
            accept=".csv,.json,.txt"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) setRaw(await f.text());
              e.currentTarget.value = "";
            }}
          />
          <span className="inline-flex h-9 cursor-pointer items-center gap-1 rounded-md border border-border px-3 text-sm">
            <FileUp className="h-4 w-4" /> Choose CSV or JSON
          </span>
        </label>
        <Button size="sm" variant="ghost" onClick={() => setRaw(RESEARCH_SAMPLE)}>
          Insert sample
        </Button>
      </div>

      <Textarea
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        rows={8}
        className="font-mono text-xs"
        placeholder="Paste curated CSV or JSON here"
      />

      <div className="flex gap-2">
        <Button size="sm" onClick={validate} disabled={!raw.trim()}>
          Preview & validate
        </Button>
        {preview && (
          <Button size="sm" variant="outline" onClick={confirm} disabled={busy || counts.ok === 0}>
            {busy && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
            Import {counts.ok} to staging
          </Button>
        )}
      </div>

      {preview && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            {counts.ok} valid · {counts.invalid} rejected · {counts.conflicts} conflict(s) ·{" "}
            {counts.protectedConflicts} against verified data
          </p>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className={`${head} px-2 py-1 text-left`}>Model</th>
                  <th className={`${head} px-2 py-1 text-left`}>Spec</th>
                  <th className={`${head} px-2 py-1 text-left`}>Proposed value</th>
                  <th className={`${head} px-2 py-1 text-left`}>Source</th>
                  <th className={`${head} px-2 py-1 text-left`}>Confidence</th>
                  <th className={`${head} px-2 py-1 text-left`}>Warnings</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((p, i) => (
                  <tr key={i} className={`border-b border-border/50 ${p.ok ? "" : "bg-destructive/5"}`}>
                    <td className="px-2 py-1.5">
                      {p.modelLabel ?? `${p.row.make} ${p.row.model}`}
                      {!p.ok && <p className="text-xs text-destructive">{p.reason}</p>}
                    </td>
                    <td className="px-2 py-1.5">
                      <span className="text-muted-foreground">{techCategoryLabel(p.row.category)}</span>{" "}
                      {p.row.subject ? `${p.row.subject} · ` : ""}
                      {techFieldLabel(p.row.category, p.row.field)}
                    </td>
                    <td className="px-2 py-1.5 font-medium">
                      {p.row.value} {p.row.unit ?? ""}
                      {p.existing && (
                        <p className="text-xs text-amber-400">
                          stored: {p.existing.value_text ?? p.existing.value_num} {p.existing.unit ?? ""}
                        </p>
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-xs text-muted-foreground">
                      {p.row.source_name ?? "—"}
                      {p.row.source_ref ? ` · ${p.row.source_ref}` : ""}
                    </td>
                    <td className="px-2 py-1.5">
                      <span
                        className={`rounded border px-1.5 py-0.5 text-[0.6rem] font-mono uppercase ${CONFIDENCE_TONE[p.confidence]}`}
                      >
                        {p.confidence}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-xs text-muted-foreground">
                      {p.warnings.length ? p.warnings.join(" · ") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
