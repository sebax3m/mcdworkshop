import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Bike, FileUp, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { fetchAllRows } from "@/lib/fetch-all";
import { ModelMatchingDialog } from "@/components/garage/ModelMatchingDialog";
import {
  buildPreview,
  generationLabel,
  importModels,
  IMPORT_COLUMNS,
  parseImport,
  priorityTier,
  type CatalogueModel,
  type PreviewRow,
} from "@/lib/garage-catalogue";

export const Route = createFileRoute("/_authenticated/garage-library/import")({
  component: GarageImportPage,
  head: () => ({
    meta: [
      { title: "Import Models | Garage Library" },
      { name: "description", content: "Bulk import motorcycle model generations into the Motorcycle Doctors Garage Library with duplicate checking and preview." },
      { property: "og:title", content: "Import Models | Garage Library" },
      { property: "og:description", content: "Upload CSV or JSON model data, review duplicates and conflicts, then confirm the import." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const SAMPLE = `make,model,generation,year_from,year_to,variant,engine,platform,category,priority,aliases
Yamaha,MT-09,Gen 4,2024,,SP,890cc triple,CP3,naked,2,MT09|MT 09`;

const STATUS_TONE: Record<string, string> = {
  new: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
  duplicate: "border-border bg-muted/30 text-muted-foreground",
  conflict: "border-amber-500/40 bg-amber-500/10 text-amber-400",
  invalid: "border-destructive/40 bg-destructive/10 text-destructive",
};

function GarageImportPage() {
  const { isAdmin, loading } = useCurrentUser();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [raw, setRaw] = useState("");
  const [preview, setPreview] = useState<PreviewRow[] | null>(null);
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

  const counts = useMemo(() => {
    const c = { new: 0, duplicate: 0, conflict: 0, invalid: 0 };
    for (const p of preview ?? []) c[p.status]++;
    return c;
  }, [preview]);

  function validate() {
    try {
      const rows = parseImport(raw);
      if (rows.length === 0) {
        toast.error("Nothing to import");
        return;
      }
      setPreview(buildPreview(rows, models));
    } catch (e) {
      toast.error(`Could not read the file: ${(e as Error).message}`);
    }
  }

  async function confirmImport() {
    const rows = (preview ?? []).filter((p) => p.status === "new").map((p) => p.row);
    if (rows.length === 0) return;
    setBusy(true);
    try {
      const res = await importModels(rows);
      toast.success(`Imported ${res.inserted} models and ${res.aliases} aliases`);
      setPreview(null);
      setRaw("");
      qc.invalidateQueries({ queryKey: ["catalogue-models"] });
      qc.invalidateQueries({ queryKey: ["garage-models"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onFile(file: File) {
    setRaw(await file.text());
    setPreview(null);
  }

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  if (!isAdmin)
    return (
      <div className="mx-auto max-w-lg p-6 text-center text-sm text-muted-foreground">
        Only admins can import catalogue data.
        <div className="mt-3">
          <Button variant="outline" size="sm" onClick={() => navigate({ to: "/garage-library" })}>
            Back to Garage Library
          </Button>
        </div>
      </div>
    );

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/garage-library">
            <ArrowLeft className="mr-1 h-4 w-4" /> Garage Library
          </Link>
        </Button>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Import data</h1>
          <p className="text-xs text-muted-foreground">
            Upload → validate → preview → confirm. Nothing is written until you confirm.
          </p>
        </div>
        <Button variant="outline" size="sm" className="ml-auto" asChild>
          <Link to="/garage-library/review">Data review</Link>
        </Button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {([
          { key: "models", label: "Model catalogue" },
          { key: "tech", label: "Technical data" },
        ] as const).map((m) => (
          <button
            key={m.key}
            onClick={() => setMode(m.key)}
            className={`rounded border px-3 py-1.5 text-xs font-mono uppercase tracking-wider transition-colors ${
              mode === m.key ? "border-primary/60 bg-primary/10 text-foreground" : "border-border bg-muted/20 text-muted-foreground hover:text-foreground"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {mode === "tech" ? (
        <TechDataImport />
      ) : (
        <>


      <section className="space-y-3 rounded-lg border border-border bg-card p-4">
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted/40">
            <FileUp className="h-4 w-4" /> Choose CSV or JSON
            <input
              type="file"
              accept=".csv,.json,text/csv,application/json"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
            />
          </label>
          <Button size="sm" variant="outline" onClick={() => setRaw(SAMPLE)}>
            Insert sample
          </Button>
          <span className="font-mono text-[0.7rem] text-muted-foreground">
            Columns: {IMPORT_COLUMNS.join(", ")}
          </span>
        </div>
        <Textarea
          value={raw}
          onChange={(e) => {
            setRaw(e.target.value);
            setPreview(null);
          }}
          rows={8}
          placeholder="Paste CSV rows or a JSON array here…"
          className="font-mono text-xs"
        />
        <div className="flex gap-2">
          <Button size="sm" onClick={validate} disabled={!raw.trim()}>
            Validate &amp; preview
          </Button>
        </div>
      </section>

      {preview && (
        <section className="rounded-lg border border-border bg-card">
          <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-2 text-xs">
            <span className="font-mono uppercase tracking-widest text-muted-foreground">Preview</span>
            <span className="text-emerald-400">{counts.new} new</span>
            <span className="text-muted-foreground">{counts.duplicate} already in library</span>
            <span className="text-amber-400">{counts.conflict} conflicts</span>
            <span className="text-destructive">{counts.invalid} invalid</span>
            <Button size="sm" className="ml-auto" disabled={busy || counts.new === 0} onClick={confirmImport}>
              {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Upload className="mr-1 h-4 w-4" />}
              Import {counts.new} new models
            </Button>
          </div>
          <div className="max-h-[28rem] overflow-auto">
            {preview.map((p, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2 border-b border-border/50 px-4 py-2 text-sm last:border-0">
                <span className={`rounded border px-1.5 py-0.5 font-mono text-[0.6rem] uppercase ${STATUS_TONE[p.status]}`}>
                  {p.status}
                </span>
                <span className="font-medium">
                  {p.row.make} {p.row.model}
                </span>
                <span className="font-mono text-xs text-muted-foreground">{generationLabel(p.row)}</span>
                {p.row.platform ? <span className="font-mono text-xs text-muted-foreground">{p.row.platform}</span> : null}
                <span className="font-mono text-[0.65rem] text-muted-foreground">{priorityTier(p.row.priority).label}</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {p.reason}
                  {p.existingLabel ? ` · ${p.existingLabel}` : ""}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <UnmatchedMotorcycles />
        </>
      )}
    </div>

  );
}

type BikeRow = { id: string; make: string | null; model: string | null; year: number | null };

function UnmatchedMotorcycles() {
  const qc = useQueryClient();
  const [target, setTarget] = useState<BikeRow | null>(null);

  const { data = [], isLoading } = useQuery({
    queryKey: ["unlinked-motorcycles"],
    queryFn: async () => {
      const [bikes, links] = await Promise.all([
        fetchAllRows<BikeRow>((from, to) =>
          supabase.from("motorcycles").select("id, make, model, year").order("make").range(from, to),
        ),
        fetchAllRows<{ motorcycle_id: string }>((from, to) =>
          supabase.from("motorcycle_model_links").select("motorcycle_id").range(from, to),
        ),
      ]);
      const linked = new Set(links.map((l) => l.motorcycle_id));
      const seen = new Set<string>();
      const out: BikeRow[] = [];
      for (const b of bikes) {
        if (linked.has(b.id) || !b.make || !b.model) continue;
        const key = `${b.make}|${b.model}|${b.year ?? ""}`.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(b);
      }
      return out.slice(0, 60);
    },
  });

  return (
    <section className="rounded-lg border border-border bg-card">
      <h2 className="flex items-center gap-2 border-b border-border px-4 py-2 font-mono text-[0.7rem] uppercase tracking-widest text-muted-foreground">
        <Bike className="h-3.5 w-3.5" /> Workshop motorcycles not yet matched
      </h2>
      {isLoading ? (
        <p className="px-4 py-4 text-sm text-muted-foreground">Loading motorcycles…</p>
      ) : data.length === 0 ? (
        <p className="px-4 py-4 text-sm text-muted-foreground">Every motorcycle with a make and model is matched.</p>
      ) : (
        data.map((b) => (
          <div key={b.id} className="flex items-center gap-3 border-b border-border/50 px-4 py-2 text-sm last:border-0">
            <span className="font-medium">
              {[b.year, b.make, b.model].filter(Boolean).join(" ")}
            </span>
            <Button size="sm" variant="outline" className="ml-auto" onClick={() => setTarget(b)}>
              Find match
            </Button>
          </div>
        ))
      )}
      {target && (
        <ModelMatchingDialog
          open={!!target}
          onOpenChange={(v) => !v && setTarget(null)}
          motorcycle={target}
          onLinked={() => qc.invalidateQueries({ queryKey: ["unlinked-motorcycles"] })}
        />
      )}
    </section>
  );
}
