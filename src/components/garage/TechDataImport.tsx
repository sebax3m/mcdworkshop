import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileUp, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fetchAllRows } from "@/lib/fetch-all";
import type { CatalogueModel } from "@/lib/garage-catalogue";
import {
  TECH_IMPORT_COLUMNS,
  buildTechPreview,
  importTechSpecs,
  parseTechImport,
  resolveImportVerification,
  specValue,
  techCategoryLabel,
  techFieldLabel,
  techVerification,
  type ConflictResolution,
  type TechPreviewRow,
  type TechSpec,
} from "@/lib/garage-tech";

const SAMPLE = `make,model,generation,year_from,year_to,category,subject,field,value,unit,source_type,source_name,source_ref,source_date,verification
Yamaha,MT-09,Gen 3,2021,2023,engine_oil,,oil_viscosity,10W-40,,manufacturer_document,MT-09 Service Manual,SM-2021-EN,2021-01-01,manufacturer_verified
Yamaha,MT-09,Gen 3,2021,2023,engine_oil,,oil_capacity_filter_l,3.4,L,manufacturer_document,MT-09 Service Manual,SM-2021-EN,2021-01-01,manufacturer_verified
Yamaha,MT-09,Gen 3,2021,2023,torque,Front axle,torque,65,Nm,external_research,Forum thread,,,unverified`;

const STATUS_TONE: Record<string, string> = {
  new: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
  duplicate: "border-border bg-muted/30 text-muted-foreground",
  conflict: "border-amber-500/40 bg-amber-500/10 text-amber-400",
  invalid: "border-destructive/40 bg-destructive/10 text-destructive",
};

const RESOLUTIONS: { value: ConflictResolution; label: string }[] = [
  { value: "keep", label: "Keep existing" },
  { value: "alternative", label: "Add as alternative" },
  { value: "review", label: "Flag for review" },
  { value: "replace", label: "Replace existing" },
];

export function TechDataImport() {
  const { user } = useCurrentUser();
  const qc = useQueryClient();
  const [raw, setRaw] = useState("");
  const [preview, setPreview] = useState<TechPreviewRow[] | null>(null);
  const [busy, setBusy] = useState(false);

  const { data: models = [] } = useQuery({
    queryKey: ["catalogue-models"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bike_library_models")
        .select("id, make, model, generation, variant, engine, platform, category, priority, market_status, year_from, year_to")
        .eq("is_archived", false);
      if (error) throw error;
      return (data ?? []) as CatalogueModel[];
    },
  });

  const { data: specs = [] } = useQuery({
    queryKey: ["all-tech-specs"],
    queryFn: async () =>
      fetchAllRows<TechSpec>((from, to) =>
        supabase.from("garage_tech_specs").select("*").eq("is_archived", false).range(from, to) as never,
      ),
  });

  const counts = useMemo(() => {
    const c = { new: 0, duplicate: 0, conflict: 0, invalid: 0 };
    for (const p of preview ?? []) c[p.status]++;
    return c;
  }, [preview]);

  const importable = (preview ?? []).filter((p) => p.status === "new" || (p.status === "conflict" && p.resolution !== "keep")).length;

  function validate() {
    try {
      const rows = parseTechImport(raw);
      if (rows.length === 0) return toast.error("Nothing to import");
      setPreview(buildTechPreview(rows, models, specs));
    } catch (e) {
      toast.error(`Could not read the file: ${(e as Error).message}`);
    }
  }

  async function confirm() {
    if (!preview) return;
    setBusy(true);
    try {
      const res = await importTechSpecs(preview, user?.id ?? null);
      toast.success(`Imported ${res.inserted} technical values (${res.skipped} skipped)`);
      setPreview(null);
      setRaw("");
      qc.invalidateQueries({ queryKey: ["all-tech-specs"] });
      qc.invalidateQueries({ queryKey: ["garage-model"] });
      qc.invalidateQueries({ queryKey: ["tech-review"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function setResolution(i: number, r: ConflictResolution) {
    setPreview((prev) => prev?.map((p, idx) => (idx === i ? { ...p, resolution: r } : p)) ?? prev);
  }

  return (
    <div className="space-y-4">
      <section className="space-y-3 rounded-lg border border-border bg-card p-4">
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted/40">
            <FileUp className="h-4 w-4" /> Choose CSV or JSON
            <input
              type="file"
              accept=".csv,.json,text/csv,application/json"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) {
                  setRaw(await f.text());
                  setPreview(null);
                }
              }}
            />
          </label>
          <Button size="sm" variant="outline" onClick={() => setRaw(SAMPLE)}>
            Insert sample
          </Button>
          <span className="font-mono text-[0.7rem] text-muted-foreground">Columns: {TECH_IMPORT_COLUMNS.join(", ")}</span>
        </div>
        <Textarea
          value={raw}
          onChange={(e) => {
            setRaw(e.target.value);
            setPreview(null);
          }}
          rows={8}
          placeholder="Paste technical data rows (CSV) or a JSON array here…"
          className="font-mono text-xs"
        />
        <p className="text-[0.7rem] text-muted-foreground">
          Exact generation match is required. Safety-critical values (torque, valves, fluid quantities, brakes, tyre pressures) import as
          <strong> unverified</strong> unless the row carries a trusted manufacturer, manual or supplier source with a reference or date.
        </p>
        <Button size="sm" onClick={validate} disabled={!raw.trim()}>
          Validate &amp; preview
        </Button>
      </section>

      {preview && (
        <section className="rounded-lg border border-border bg-card">
          <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-2 text-xs">
            <span className="font-mono uppercase tracking-widest text-muted-foreground">Preview</span>
            <span className="text-emerald-400">{counts.new} new</span>
            <span className="text-muted-foreground">{counts.duplicate} identical</span>
            <span className="text-amber-400">{counts.conflict} technical conflicts</span>
            <span className="text-destructive">{counts.invalid} invalid</span>
            <Button size="sm" className="ml-auto" disabled={busy || importable === 0} onClick={confirm}>
              {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Upload className="mr-1 h-4 w-4" />}
              Import {importable} values
            </Button>
          </div>
          <div className="max-h-[30rem] overflow-auto">
            {preview.map((p, i) => (
              <div key={i} className="space-y-1 border-b border-border/50 px-4 py-2 text-sm last:border-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded border px-1.5 py-0.5 font-mono text-[0.6rem] uppercase ${STATUS_TONE[p.status]}`}>{p.status}</span>
                  <span className="font-medium">{p.modelLabel ?? `${p.row.make} ${p.row.model}`}</span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {techCategoryLabel(p.row.category)}
                    {p.row.subject ? ` · ${p.row.subject}` : ""} · {techFieldLabel(p.row.category, p.row.field)}
                  </span>
                  <span className="font-mono text-xs">
                    {p.row.value}
                    {p.row.unit ? ` ${p.row.unit}` : ""}
                  </span>
                  <span className="rounded border border-border px-1 font-mono text-[0.6rem] uppercase text-muted-foreground">
                    {techVerification(resolveImportVerification(p.row)).label}
                  </span>
                  <span className="ml-auto text-xs text-muted-foreground">{p.reason}</span>
                </div>
                {p.status === "conflict" && p.existing ? (
                  <div className="flex flex-wrap items-center gap-2 rounded border border-amber-500/30 bg-amber-500/5 px-2 py-1.5 text-xs">
                    <span className="font-mono uppercase tracking-wider text-amber-400">Technical conflict</span>
                    <span>
                      Existing: <strong className="font-mono">{specValue(p.existing)}</strong> ({techVerification(p.existing.verification).label})
                    </span>
                    <span>
                      Imported: <strong className="font-mono">{p.row.value}{p.row.unit ? ` ${p.row.unit}` : ""}</strong>
                    </span>
                    <Select value={p.resolution} onValueChange={(v) => setResolution(i, v as ConflictResolution)}>
                      <SelectTrigger className="ml-auto h-7 w-48 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {RESOLUTIONS.map((r) => (
                          <SelectItem key={r.value} value={r.value} className="text-xs">
                            {r.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
