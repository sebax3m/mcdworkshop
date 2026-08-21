import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Library, Search, Plus, ChevronRight, History, Inbox, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { logRevision, modelTitle, yearLabel, type ModelRow } from "@/lib/garage-library";
import { PRIORITY_TIERS, priorityTier } from "@/lib/garage-catalogue";

export const Route = createFileRoute("/_authenticated/garage-library/")({
  component: GarageLibraryIndex,
  head: () => ({
    meta: [
      { title: "Garage Library | Motorcycle Doctors" },
      { name: "description", content: "Workshop-verified technical and estimating knowledge for the motorcycle models Motorcycle Doctors has worked on." },
      { property: "og:title", content: "Garage Library | Motorcycle Doctors" },
      { property: "og:description", content: "Parts, labour, torque, fluids and valve clearance references built from real workshop jobs." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type SearchHit = { modelId: string; kind: string; text: string };

type LibModel = ModelRow & {
  generation: string | null;
  platform: string | null;
  engine: string | null;
  category: string | null;
  priority: number | null;
};

function GarageLibraryIndex() {
  const { isAdmin } = useCurrentUser();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [openBrand, setOpenBrand] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [tier, setTier] = useState<number | null>(null);
  const [form, setForm] = useState({ make: "", model: "", variant: "", engine_cc: "", year_from: "", year_to: "" });

  const { data: allModels = [], isLoading } = useQuery({
    queryKey: ["garage-models"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bike_library_models")
        .select("id, make, model, variant, engine_cc, year_from, year_to, cylinders, notes, photo_url, is_archived, updated_at, generation, platform, engine, category, priority")
        .eq("is_archived", false)
        .order("make")
        .order("model")
        .order("year_from");
      if (error) throw error;
      return (data ?? []) as LibModel[];
    },
  });

  const models = useMemo(
    () => (tier === null ? allModels : allModels.filter((m) => (m.priority ?? 2) === tier)),
    [allModels, tier],
  );


  const { data: hits = [] } = useQuery({
    queryKey: ["garage-search", q],
    enabled: q.trim().length >= 2,
    queryFn: async () => {
      const term = `%${q.trim()}%`;
      const [parts, labour, torque] = await Promise.all([
        supabase.from("bike_library_parts").select("model_id, name, part_number, alt_part_number, brand").or(`name.ilike.${term},part_number.ilike.${term},alt_part_number.ilike.${term},brand.ilike.${term}`).limit(20),
        supabase.from("bike_library_labour").select("model_id, task, hours").ilike("task", term).limit(20),
        supabase.from("bike_library_torque").select("model_id, fastener, torque_nm").ilike("fastener", term).limit(20),
      ]);
      const out: SearchHit[] = [];
      for (const p of parts.data ?? []) out.push({ modelId: p.model_id, kind: "Part", text: [p.brand, p.name, p.part_number].filter(Boolean).join(" · ") });
      for (const l of labour.data ?? []) out.push({ modelId: l.model_id, kind: "Labour", text: `${l.task}${l.hours ? ` · ${l.hours} h` : ""}` });
      for (const t of torque.data ?? []) out.push({ modelId: t.model_id, kind: "Torque", text: `${t.fastener}${t.torque_nm ? ` · ${t.torque_nm} Nm` : ""}` });
      return out;
    },
  });

  const { data: recent = [] } = useQuery({
    queryKey: ["garage-recent"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("garage_revisions")
        .select("id, model_id, label, old_value, new_value, action, created_at")
        .order("created_at", { ascending: false })
        .limit(12);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: proposals = [] } = useQuery({
    queryKey: ["garage-proposals", "pending"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("garage_update_proposals")
        .select("id, model_id, entity_table, entity_id, label, field, current_value, proposed_value, note, status, created_at")
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const resolveProposal = useMutation({
    mutationFn: async ({ id, decision }: { id: string; decision: "approved" | "rejected" | "kept_both" }) => {
      const p = proposals.find((x) => x.id === id);
      if (!p) return;
      const { data: auth } = await supabase.auth.getUser();
      if (decision === "approved" && p.entity_id && p.field) {
        const numeric = Number(p.proposed_value);
        const value = Number.isFinite(numeric) && p.proposed_value?.trim() !== "" ? numeric : p.proposed_value;
        const { error } = await supabase
          .from(p.entity_table as "bike_library_labour")
          .update({ [p.field]: value } as never)
          .eq("id", p.entity_id);
        if (error) throw error;
      }
      const { error: upErr } = await supabase
        .from("garage_update_proposals")
        .update({ status: decision, resolved_by: auth.user?.id ?? null, resolved_at: new Date().toISOString() })
        .eq("id", id);
      if (upErr) throw upErr;
      await logRevision({
        modelId: p.model_id,
        entityTable: p.entity_table,
        entityId: p.entity_id,
        field: p.field,
        label: p.label,
        oldValue: p.current_value,
        newValue: p.proposed_value,
        action: decision === "approved" ? "update" : "update",
        note: `Proposal ${decision}`,
      });
    },
    onSuccess: () => {
      toast.success("Proposal resolved");
      qc.invalidateQueries({ queryKey: ["garage-proposals"] });
      qc.invalidateQueries({ queryKey: ["garage-recent"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createModel = useMutation({
    mutationFn: async () => {
      if (!form.make.trim() || !form.model.trim()) throw new Error("Make and model are required");
      const { data: auth } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("bike_library_models")
        .insert({
          make: form.make.trim(),
          model: form.model.trim(),
          variant: form.variant.trim() || null,
          engine_cc: form.engine_cc ? Number(form.engine_cc) : null,
          year_from: form.year_from ? Number(form.year_from) : null,
          year_to: form.year_to ? Number(form.year_to) : form.year_from ? Number(form.year_from) : null,
          cylinders: 1,
          created_by: auth.user?.id ?? null,
        })
        .select("id")
        .single();
      if (error) throw error;
      await logRevision({ modelId: data.id, entityTable: "bike_library_models", entityId: data.id, label: "Model created", newValue: `${form.make} ${form.model}`, action: "create" });
    },
    onSuccess: () => {
      toast.success("Model added to Garage Library");
      setNewOpen(false);
      setForm({ make: "", model: "", variant: "", engine_cc: "", year_from: "", year_to: "" });
      qc.invalidateQueries({ queryKey: ["garage-models"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const brands = useMemo(() => {
    const map = new Map<string, LibModel[]>();
    for (const m of models) {
      const key = m.make.trim();
      const arr = map.get(key) ?? [];
      arr.push(m);
      map.set(key, arr);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [models]);

  const term = q.trim().toLowerCase();
  const matchedModels = useMemo(() => {
    if (term.length < 2) return [];
    return models.filter((m) =>
      `${m.make} ${m.model} ${m.variant ?? ""} ${m.year_from ?? ""} ${m.year_to ?? ""}`.toLowerCase().includes(term),
    );
  }, [models, term]);

  const modelById = useMemo(() => new Map(allModels.map((m) => [m.id, m])), [allModels]);
  const searching = term.length >= 2;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-lg border border-border bg-card">
          <Library className="h-5 w-5 text-amber-400" />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight">Garage Library</h1>
          <p className="text-xs text-muted-foreground">Workshop-verified knowledge from motorcycles we have actually worked on.</p>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button size="sm" variant="outline" asChild>
            <Link to="/garage-library/tech">MCD TECH</Link>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link to="/garage-library/documents">Documents</Link>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link to="/garage-library/analytics">Analytics</Link>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link to="/garage-library/updates">
              <Inbox className="h-4 w-4 mr-1" /> Knowledge updates{proposals.length ? ` · ${proposals.length}` : ""}
            </Link>
          </Button>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" asChild>
              <Link to="/garage-library/import">
                <Upload className="h-4 w-4 mr-1" /> Import
              </Link>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link to="/garage-library/review">Data review</Link>
            </Button>

            <Button size="sm" onClick={() => setNewOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Add model
            </Button>
          </div>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search motorcycles, part numbers or specifications…"
          className="pl-9 h-11"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setTier(null)}
          className={`rounded-full border px-3 py-1 font-mono text-[0.65rem] uppercase tracking-widest ${
            tier === null ? "border-primary/50 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted/40"
          }`}
        >
          All {allModels.length}
        </button>
        {PRIORITY_TIERS.map((t) => {
          const n = allModels.filter((m) => (m.priority ?? 2) === t.value).length;
          return (
            <button
              key={t.value}
              onClick={() => setTier(tier === t.value ? null : t.value)}
              className={`rounded-full border px-3 py-1 font-mono text-[0.65rem] uppercase tracking-widest ${
                tier === t.value ? priorityTier(t.value).tone : "border-border text-muted-foreground hover:bg-muted/40"
              }`}
            >
              {t.label} · {n}
            </button>
          );
        })}
      </div>



      {searching ? (
        <div className="space-y-4">
          <section className="rounded-lg border border-border bg-card">
            <h2 className="px-4 py-2 text-[0.7rem] font-mono uppercase tracking-widest text-muted-foreground border-b border-border">Models</h2>
            {matchedModels.length === 0 ? (
              <p className="px-4 py-4 text-sm text-muted-foreground">No models match.</p>
            ) : (
              matchedModels.map((m) => (
                <Link
                  key={m.id}
                  to="/garage-library/$modelId"
                  params={{ modelId: m.id }}
                  className="flex items-center gap-3 px-4 py-2.5 border-b border-border/60 last:border-0 hover:bg-muted/40"
                >
                  <span className="text-sm font-medium">{modelTitle(m)}</span>
                  <span className="font-mono text-xs text-muted-foreground">{yearLabel(m)}</span>
                  {m.engine_cc ? <span className="font-mono text-xs text-muted-foreground">{m.engine_cc}cc</span> : null}
                  <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" />
                </Link>
              ))
            )}
          </section>

          <section className="rounded-lg border border-border bg-card">
            <h2 className="px-4 py-2 text-[0.7rem] font-mono uppercase tracking-widest text-muted-foreground border-b border-border">
              Parts, labour &amp; specifications
            </h2>
            {hits.length === 0 ? (
              <p className="px-4 py-4 text-sm text-muted-foreground">No entries match.</p>
            ) : (
              hits.map((h, i) => {
                const m = modelById.get(h.modelId);
                return (
                  <Link
                    key={`${h.kind}-${i}`}
                    to="/garage-library/$modelId"
                    params={{ modelId: h.modelId }}
                    className="flex items-center gap-3 px-4 py-2.5 border-b border-border/60 last:border-0 hover:bg-muted/40"
                  >
                    <span className="rounded border border-border px-1.5 py-0.5 text-[0.6rem] font-mono uppercase text-muted-foreground">{h.kind}</span>
                    <span className="text-sm">{h.text}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{m ? `${modelTitle(m)} ${yearLabel(m)}` : ""}</span>
                  </Link>
                );
              })
            )}
          </section>
        </div>
      ) : (
        <>
          {isAdmin && proposals.length > 0 && (
            <section className="rounded-lg border border-amber-500/40 bg-amber-500/5">
              <h2 className="flex items-center gap-2 px-4 py-2 text-[0.7rem] font-mono uppercase tracking-widest text-amber-400 border-b border-amber-500/30">
                <Inbox className="h-3.5 w-3.5" /> Knowledge updates · {proposals.length} pending
              </h2>
              {proposals.map((p) => {
                const m = modelById.get(p.model_id);
                return (
                  <div key={p.id} className="px-4 py-3 border-b border-amber-500/20 last:border-0 space-y-1.5">
                    <div className="text-sm font-medium">
                      {m ? `${modelTitle(m)} ${yearLabel(m)} · ` : ""}
                      {p.label}
                    </div>
                    <div className="font-mono text-xs text-muted-foreground">
                      Existing: {p.current_value ?? "—"} → Proposed: {p.proposed_value}
                      {p.note ? ` · ${p.note}` : ""}
                    </div>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button size="sm" onClick={() => resolveProposal.mutate({ id: p.id, decision: "approved" })}>Approve update</Button>
                      <Button size="sm" variant="outline" onClick={() => resolveProposal.mutate({ id: p.id, decision: "rejected" })}>Reject</Button>
                      <Button size="sm" variant="ghost" onClick={() => resolveProposal.mutate({ id: p.id, decision: "kept_both" })}>Keep both</Button>
                    </div>
                  </div>
                );
              })}
            </section>
          )}

          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {isLoading && <p className="text-sm text-muted-foreground">Loading library…</p>}
            {brands.map(([make, list]) => (
              <div key={make} className="rounded-lg border border-border bg-card">
                <button
                  className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-muted/40"
                  onClick={() => setOpenBrand(openBrand === make ? null : make)}
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">{make}</div>
                    <div className="font-mono text-[0.7rem] text-muted-foreground">{list.length} models</div>
                  </div>
                  <ChevronRight className={`ml-auto h-4 w-4 text-muted-foreground transition-transform ${openBrand === make ? "rotate-90" : ""}`} />
                </button>
                {openBrand === make && (
                  <div className="border-t border-border">
                    {list.map((m) => (
                      <Link
                        key={m.id}
                        to="/garage-library/$modelId"
                        params={{ modelId: m.id }}
                        className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-muted/40 border-b border-border/50 last:border-0"
                      >
                        <span className="truncate">{m.model}</span>
                        {m.generation ? (
                          <span className="font-mono text-[0.65rem] text-muted-foreground truncate">{m.generation}</span>
                        ) : null}
                        <span className="ml-auto font-mono text-[0.7rem] text-muted-foreground">{yearLabel(m)}</span>
                      </Link>
                    ))}

                  </div>
                )}
              </div>
            ))}
          </section>

          <section className="rounded-lg border border-border bg-card">
            <h2 className="flex items-center gap-2 px-4 py-2 text-[0.7rem] font-mono uppercase tracking-widest text-muted-foreground border-b border-border">
              <History className="h-3.5 w-3.5" /> Recently updated
            </h2>
            {recent.length === 0 ? (
              <p className="px-4 py-4 text-sm text-muted-foreground">No knowledge changes recorded yet.</p>
            ) : (
              recent.map((r) => {
                const m = modelById.get(r.model_id ?? "");
                return (
                  <div key={r.id} className="flex flex-wrap items-center gap-2 px-4 py-2 border-b border-border/50 last:border-0 text-sm">
                    <span className="font-medium">{m ? `${modelTitle(m)} ${yearLabel(m)}` : "Library"}</span>
                    <span className="text-muted-foreground">{r.label}</span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {r.old_value ? `${r.old_value} → ` : ""}
                      {r.new_value ?? ""}
                    </span>
                    <span className="ml-auto font-mono text-[0.7rem] text-muted-foreground">
                      {new Date(r.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit" })}
                    </span>
                  </div>
                );
              })
            )}
          </section>
        </>
      )}

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add model to Garage Library</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input placeholder="Make" value={form.make} onChange={(e) => setForm({ ...form, make: e.target.value })} />
            <Input placeholder="Model" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
            <Input placeholder="Variant (optional)" value={form.variant} onChange={(e) => setForm({ ...form, variant: e.target.value })} />
            <Input placeholder="Engine cc" value={form.engine_cc} onChange={(e) => setForm({ ...form, engine_cc: e.target.value })} />
            <Input placeholder="Year from" value={form.year_from} onChange={(e) => setForm({ ...form, year_from: e.target.value })} />
            <Input placeholder="Year to" value={form.year_to} onChange={(e) => setForm({ ...form, year_to: e.target.value })} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewOpen(false)}>Cancel</Button>
            <Button onClick={() => createModel.mutate()} disabled={createModel.isPending}>Save model</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
