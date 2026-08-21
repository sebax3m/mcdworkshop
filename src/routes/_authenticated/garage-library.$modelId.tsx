import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus, Trash2, Archive, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { SpecMeta, SourceSelect, VerificationSelect } from "@/components/garage/SpecMeta";
import { WorkshopDataTab } from "@/components/garage/WorkshopDataTab";
import { TechAskPanel } from "@/components/garage/TechAskPanel";
import { KnowledgeCoverageCard, ModelDocumentsTab } from "@/components/garage/ModelKnowledgeTabs";
import { TechSpecsTab } from "@/components/garage/TechSpecsTab";
import { MissingKnowledgeCard, QuickTechSheetButton, TechQuickCards } from "@/components/garage/TechSheet";
import {
  FluidObservationsCard,
  ModelExperienceCard,
  PartUsageCard,
} from "@/components/garage/WorkshopExperience";
import {
  COMMON_FASTENERS,
  FLUID_TYPES,
  PART_CATEGORIES,
  STANDARD_OPERATIONS,
  logRevision,
  modelTitle,
  num,
  proposeUpdate,
  yearLabel,
  type ModelRow,
} from "@/lib/garage-library";

export const Route = createFileRoute("/_authenticated/garage-library/$modelId")({
  component: GarageModelPage,
  head: () => ({
    meta: [
      { title: "Model knowledge | Garage Library" },
      { name: "description", content: "Parts, labour references, torque specs, fluids and valve clearances for this motorcycle model." },
      { property: "og:title", content: "Model knowledge | Garage Library" },
      { property: "og:description", content: "Workshop-verified technical reference for this motorcycle model." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const cardCls = "rounded-lg border border-border bg-card";
const thCls = "px-3 py-2 text-left text-[0.65rem] font-mono uppercase tracking-widest text-muted-foreground";
const tdCls = "px-3 py-2 align-top text-sm";

function GarageModelPage() {
  const { modelId } = Route.useParams();
  const { isAdmin } = useCurrentUser();
  const qc = useQueryClient();
  const [proposal, setProposal] = useState<{ table: string; id: string; field: string; label: string; current: string } | null>(null);
  const [proposalValue, setProposalValue] = useState("");
  const [proposalNote, setProposalNote] = useState("");

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["garage-model", modelId] });
    qc.invalidateQueries({ queryKey: ["garage-recent"] });
  };

  const { data: model } = useQuery({
    queryKey: ["garage-model", modelId, "model"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bike_library_models")
        .select("id, make, model, variant, engine_cc, year_from, year_to, cylinders, notes, photo_url, is_archived, updated_at")
        .eq("id", modelId)
        .single();
      if (error) throw error;
      return data as ModelRow;
    },
  });

  const { data: parts = [] } = useQuery({
    queryKey: ["garage-model", modelId, "parts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("bike_library_parts").select("*").eq("model_id", modelId).eq("is_archived", false).order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: labour = [] } = useQuery({
    queryKey: ["garage-model", modelId, "labour"],
    queryFn: async () => {
      const { data, error } = await supabase.from("bike_library_labour").select("*").eq("model_id", modelId).eq("is_archived", false).order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: torque = [] } = useQuery({
    queryKey: ["garage-model", modelId, "torque"],
    queryFn: async () => {
      const { data, error } = await supabase.from("bike_library_torque").select("*").eq("model_id", modelId).eq("is_archived", false).order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: fluids = [] } = useQuery({
    queryKey: ["garage-model", modelId, "fluids"],
    queryFn: async () => {
      const { data, error } = await supabase.from("garage_fluid_specs").select("*").eq("model_id", modelId).eq("is_archived", false).order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: valves = [] } = useQuery({
    queryKey: ["garage-model", modelId, "valves"],
    queryFn: async () => {
      const { data, error } = await supabase.from("garage_valve_specs").select("*").eq("model_id", modelId).eq("is_archived", false);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: notes = [] } = useQuery({
    queryKey: ["garage-model", modelId, "notes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("garage_notes").select("*").eq("model_id", modelId).eq("is_archived", false).order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: revisions = [] } = useQuery({
    queryKey: ["garage-model", modelId, "revisions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("garage_revisions").select("*").eq("model_id", modelId).order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: usage } = useQuery({
    queryKey: ["garage-model", modelId, "usage", model?.make, model?.model],
    enabled: !!model,
    queryFn: async () => {
      const { data: bikes } = await supabase
        .from("motorcycles")
        .select("id, year")
        .ilike("make", model!.make)
        .ilike("model", model!.model);
      const inRange = (bikes ?? []).filter((b) => {
        if (!model!.year_from && !model!.year_to) return true;
        if (b.year == null) return false;
        return b.year >= (model!.year_from ?? b.year) && b.year <= (model!.year_to ?? b.year);
      });
      const ids = inRange.map((b) => b.id);
      if (ids.length === 0) return { bikes: 0, jobs: 0, last: null as string | null };
      const { data: jobs } = await supabase.from("jobs").select("id, created_at").in("motorcycle_id", ids).order("created_at", { ascending: false });
      return { bikes: ids.length, jobs: jobs?.length ?? 0, last: jobs?.[0]?.created_at ?? null };
    },
  });

  /** Generic row mutation: admins write directly and log a revision. */
  const saveRow = useMutation({
    mutationFn: async ({ table, id, patch, label, field, oldValue }: { table: string; id: string; patch: Record<string, unknown>; label: string; field?: string; oldValue?: string | null }) => {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase
        .from(table as "bike_library_labour")
        .update({ ...patch, updated_by: auth.user?.id ?? null } as never)
        .eq("id", id);
      if (error) throw error;
      await logRevision({
        modelId,
        entityTable: table,
        entityId: id,
        field: field ?? null,
        label,
        oldValue: oldValue ?? null,
        newValue: field ? String(patch[field] ?? "") : JSON.stringify(patch),
      });
    },
    onSuccess: () => {
      toast.success("Saved");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addRow = useMutation({
    mutationFn: async ({ table, values, label }: { table: string; values: Record<string, unknown>; label: string }) => {
      const { data: auth } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from(table as "bike_library_labour")
        .insert({ model_id: modelId, ...values, updated_by: auth.user?.id ?? null } as never)
        .select("id")
        .single();
      if (error) throw error;
      await logRevision({ modelId, entityTable: table, entityId: (data as { id: string }).id, label, action: "create", newValue: label });
    },
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast.error(e.message),
  });

  const archiveRow = useMutation({
    mutationFn: async ({ table, id, label }: { table: string; id: string; label: string }) => {
      const { error } = await supabase.from(table as "bike_library_labour").update({ is_archived: true } as never).eq("id", id);
      if (error) throw error;
      await logRevision({ modelId, entityTable: table, entityId: id, label, action: "archive", note: "Archived" });
    },
    onSuccess: () => {
      toast.success("Archived");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const submitProposal = useMutation({
    mutationFn: async () => {
      if (!proposal) return;
      await proposeUpdate({
        modelId,
        entityTable: proposal.table,
        entityId: proposal.id,
        field: proposal.field,
        label: proposal.label,
        currentValue: proposal.current,
        proposedValue: proposalValue,
        note: proposalNote || null,
      });
    },
    onSuccess: () => {
      toast.success("Sent to admin for review");
      setProposal(null);
      setProposalValue("");
      setProposalNote("");
      qc.invalidateQueries({ queryKey: ["garage-proposals"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const valve = valves[0];

  const title = useMemo(() => (model ? `${modelTitle(model)}` : "Model"), [model]);

  if (!model) return <div className="p-6 text-sm text-muted-foreground">Loading model…</div>;

  function EditableCell({
    table,
    id,
    field,
    value,
    label,
    className = "",
    placeholder,
  }: {
    table: string;
    id: string;
    field: string;
    value: string | number | null;
    label: string;
    className?: string;
    placeholder?: string;
  }) {
    const [v, setV] = useState(value == null ? "" : String(value));
    const original = value == null ? "" : String(value);
    return (
      <div className="flex items-center gap-1">
        <Input
          value={v}
          placeholder={placeholder}
          disabled={!isAdmin}
          className={`h-8 text-sm ${className}`}
          onChange={(e) => setV(e.target.value)}
          onBlur={() => {
            if (!isAdmin || v === original) return;
            const numeric = num(v);
            const isNumericField = ["hours", "parts_cost", "price", "qty", "retail_price", "torque_nm"].includes(field);
            saveRow.mutate({ table, id, patch: { [field]: isNumericField ? numeric : v || null }, label, field, oldValue: original });
          }}
        />
        {!isAdmin && (
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 shrink-0"
            title="Propose update"
            onClick={() => {
              setProposal({ table, id, field, label, current: original });
              setProposalValue(original);
            }}
          >
            <Send className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    );
  }

  function MetaRow({ table, id, source, verificationValue, updatedAt }: { table: string; id: string; source: string; verificationValue: string; updatedAt?: string | null }) {
    if (!isAdmin) return <SpecMeta source={source} verificationValue={verificationValue} updatedAt={updatedAt} />;
    return (
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-44">
          <SourceSelect value={source} onChange={(val) => saveRow.mutate({ table, id, patch: { source: val }, label: "Source", field: "source", oldValue: source })} />
        </div>
        <div className="w-52">
          <VerificationSelect value={verificationValue} onChange={(val) => saveRow.mutate({ table, id, patch: { verification: val }, label: "Verification", field: "verification", oldValue: verificationValue })} />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 space-y-5">
      <Link to="/garage-library" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Garage Library
      </Link>

      <header className={`${cardCls} p-4`}>
        <h1 className="text-lg font-semibold uppercase tracking-wide">{title}</h1>
        <div className="mt-1 flex flex-wrap gap-3 font-mono text-xs text-muted-foreground">
          <span>{yearLabel(model)}</span>
          {model.variant ? <span>{model.variant}</span> : null}
          {model.engine_cc ? <span>{model.engine_cc}cc</span> : null}
          <span>{model.cylinders} cyl</span>
        </div>
        <div className="mt-3">
          <QuickTechSheetButton modelId={modelId} title={title} />
        </div>
      </header>

      <Tabs defaultValue="overview">
        <TabsList className="flex flex-wrap h-auto">
          {["overview", "tech data", "mcd tech", "workshop", "parts", "labour", "torque", "valves", "fluids", "documents", "notes", "history"].map((t) => (
            <TabsTrigger key={t} value={t} className="text-xs uppercase tracking-wide">
              {t === "valves" ? "Valve clearances" : t === "workshop" ? "Workshop data" : t}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* OVERVIEW */}
        <TabsContent value="overview" className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className={`${cardCls} p-4`}>
            <div className="text-[0.65rem] font-mono uppercase tracking-widest text-muted-foreground">Motorcycles serviced</div>
            <div className="mt-1 text-2xl font-semibold">{usage?.bikes ?? "—"}</div>
          </div>
          <div className={`${cardCls} p-4`}>
            <div className="text-[0.65rem] font-mono uppercase tracking-widest text-muted-foreground">Jobs completed</div>
            <div className="mt-1 text-2xl font-semibold">{usage?.jobs ?? "—"}</div>
          </div>
          <div className={`${cardCls} p-4`}>
            <div className="text-[0.65rem] font-mono uppercase tracking-widest text-muted-foreground">Last worked on</div>
            <div className="mt-1 text-sm font-mono">
              {usage?.last ? new Date(usage.last).toLocaleDateString("en-GB") : "—"}
            </div>
          </div>
          <div className="sm:col-span-3">
            <ModelExperienceCard modelId={modelId} />
          </div>
          <div className={`${cardCls} p-4 sm:col-span-3`}>
            <div className="text-[0.65rem] font-mono uppercase tracking-widest text-muted-foreground mb-2">Model notes</div>
            <Textarea
              defaultValue={model.notes ?? ""}
              disabled={!isAdmin}
              rows={3}
              onBlur={(e) => {
                if (!isAdmin || e.target.value === (model.notes ?? "")) return;
                saveRow.mutate({ table: "bike_library_models", id: model.id, patch: { notes: e.target.value }, label: "Model notes", field: "notes", oldValue: model.notes });
              }}
            />
          </div>
        </TabsContent>

        <TabsContent value="tech data" className="mt-4 space-y-4">
          <TechQuickCards modelId={modelId} />
          <MissingKnowledgeCard modelId={modelId} />
          <TechSpecsTab modelId={modelId} />
        </TabsContent>

        <TabsContent value="mcd tech" className="mt-4 space-y-3">
          <KnowledgeCoverageCard modelId={modelId} />
          <TechAskPanel
            bike={{
              modelId,
              make: model.make,
              model: model.model,
              year: model.year_from ?? model.year_to ?? null,
            }}
          />
        </TabsContent>

        <TabsContent value="documents" className="mt-4">
          <ModelDocumentsTab modelId={modelId} />
        </TabsContent>

        <TabsContent value="workshop" className="mt-4 space-y-4">
          <ModelExperienceCard modelId={modelId} />
          <div className="grid gap-4 lg:grid-cols-2">
            <PartUsageCard modelId={modelId} />
            <FluidObservationsCard modelId={modelId} />
          </div>
          <WorkshopDataTab modelId={modelId} />
        </TabsContent>

        {/* PARTS */}
        <TabsContent value="parts" className="mt-4 space-y-3">
          <div className={cardCls}>
            <table className="w-full">
              <thead className="border-b border-border">
                <tr>
                  <th className={thCls}>Category</th>
                  <th className={thCls}>Description</th>
                  <th className={thCls}>Brand</th>
                  <th className={thCls}>Part no.</th>
                  <th className={thCls}>Alt no.</th>
                  <th className={thCls}>Qty</th>
                  <th className={thCls}>Cost</th>
                  <th className={thCls}>Retail</th>
                  <th className={thCls}></th>
                </tr>
              </thead>
              <tbody>
                {parts.length === 0 && (
                  <tr>
                    <td className={`${tdCls} text-muted-foreground`} colSpan={9}>No parts recorded for this model yet.</td>
                  </tr>
                )}
                {parts.map((p) => (
                  <tr key={p.id} className="border-b border-border/50 last:border-0">
                    <td className={tdCls}><EditableCell table="bike_library_parts" id={p.id} field="category" value={p.category} label={`Part category · ${p.name}`} /></td>
                    <td className={tdCls}><EditableCell table="bike_library_parts" id={p.id} field="name" value={p.name} label={`Part · ${p.name}`} /></td>
                    <td className={tdCls}><EditableCell table="bike_library_parts" id={p.id} field="brand" value={p.brand} label={`Brand · ${p.name}`} /></td>
                    <td className={tdCls}><EditableCell table="bike_library_parts" id={p.id} field="part_number" value={p.part_number} label={`Part number · ${p.name}`} className="font-mono" /></td>
                    <td className={tdCls}><EditableCell table="bike_library_parts" id={p.id} field="alt_part_number" value={p.alt_part_number} label={`Alt part number · ${p.name}`} className="font-mono" /></td>
                    <td className={tdCls}><EditableCell table="bike_library_parts" id={p.id} field="qty" value={p.qty} label={`Qty · ${p.name}`} className="w-16" /></td>
                    <td className={tdCls}><EditableCell table="bike_library_parts" id={p.id} field="price" value={p.price} label={`Cost · ${p.name}`} className="w-20" /></td>
                    <td className={tdCls}><EditableCell table="bike_library_parts" id={p.id} field="retail_price" value={p.retail_price} label={`Retail · ${p.name}`} className="w-20" /></td>
                    <td className={tdCls}>
                      <div className="space-y-1">
                        <MetaRow table="bike_library_parts" id={p.id} source={p.source} verificationValue={p.verification} updatedAt={p.updated_at} />
                        {isAdmin && (
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => archiveRow.mutate({ table: "bike_library_parts", id: p.id, label: `Part · ${p.name}` })}>
                            <Archive className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {isAdmin && (
            <div className="flex flex-wrap gap-2">
              {PART_CATEGORIES.map((c) => (
                <Button key={c} size="sm" variant="outline" onClick={() => addRow.mutate({ table: "bike_library_parts", values: { name: c, category: c, qty: 1, sort_order: parts.length }, label: `Part · ${c}` })}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> {c}
                </Button>
              ))}
            </div>
          )}
        </TabsContent>

        {/* LABOUR */}
        <TabsContent value="labour" className="mt-4 space-y-3">
          <div className={cardCls}>
            <table className="w-full">
              <thead className="border-b border-border">
                <tr>
                  <th className={thCls}>Operation</th>
                  <th className={thCls}>Reference hours</th>
                  <th className={thCls}>Parts normally required</th>
                  <th className={thCls}>Special tools</th>
                  <th className={thCls}>Notes</th>
                  <th className={thCls}></th>
                </tr>
              </thead>
              <tbody>
                {labour.length === 0 && (
                  <tr><td className={`${tdCls} text-muted-foreground`} colSpan={6}>No labour references recorded yet.</td></tr>
                )}
                {labour.map((l) => (
                  <tr key={l.id} className="border-b border-border/50 last:border-0">
                    <td className={tdCls}><EditableCell table="bike_library_labour" id={l.id} field="task" value={l.task} label={`Labour · ${l.task}`} /></td>
                    <td className={tdCls}><EditableCell table="bike_library_labour" id={l.id} field="hours" value={l.hours} label={`Labour hours · ${l.task}`} className="w-20" /></td>
                    <td className={tdCls}><EditableCell table="bike_library_labour" id={l.id} field="parts_required" value={l.parts_required} label={`Parts required · ${l.task}`} /></td>
                    <td className={tdCls}><EditableCell table="bike_library_labour" id={l.id} field="special_tools" value={l.special_tools} label={`Special tools · ${l.task}`} /></td>
                    <td className={tdCls}><EditableCell table="bike_library_labour" id={l.id} field="notes" value={l.notes} label={`Notes · ${l.task}`} /></td>
                    <td className={tdCls}>
                      <div className="space-y-1">
                        <MetaRow table="bike_library_labour" id={l.id} source={l.source} verificationValue={l.verification} updatedAt={l.updated_at} />
                        {isAdmin && (
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => archiveRow.mutate({ table: "bike_library_labour", id: l.id, label: `Labour · ${l.task}` })}>
                            <Archive className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {isAdmin && (
            <div className="flex flex-wrap gap-2">
              {STANDARD_OPERATIONS.map((op) => (
                <Button key={op} size="sm" variant="outline" onClick={() => addRow.mutate({ table: "bike_library_labour", values: { task: op, sort_order: labour.length }, label: `Labour · ${op}` })}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> {op}
                </Button>
              ))}
            </div>
          )}
        </TabsContent>

        {/* TORQUE */}
        <TabsContent value="torque" className="mt-4 space-y-3">
          <div className={cardCls}>
            <table className="w-full">
              <thead className="border-b border-border">
                <tr>
                  <th className={thCls}>Component</th>
                  <th className={thCls}>Torque</th>
                  <th className={thCls}>Unit</th>
                  <th className={thCls}>Notes</th>
                  <th className={thCls}></th>
                </tr>
              </thead>
              <tbody>
                {torque.length === 0 && (
                  <tr><td className={`${tdCls} text-muted-foreground`} colSpan={5}>No torque specifications recorded yet.</td></tr>
                )}
                {torque.map((t) => (
                  <tr key={t.id} className="border-b border-border/50 last:border-0">
                    <td className={tdCls}><EditableCell table="bike_library_torque" id={t.id} field="fastener" value={t.fastener} label={`Torque · ${t.fastener}`} /></td>
                    <td className={tdCls}><EditableCell table="bike_library_torque" id={t.id} field="torque_nm" value={t.torque_nm} label={`Torque value · ${t.fastener}`} className="w-20 font-mono" /></td>
                    <td className={tdCls}><EditableCell table="bike_library_torque" id={t.id} field="unit" value={t.unit} label={`Torque unit · ${t.fastener}`} className="w-16" /></td>
                    <td className={tdCls}><EditableCell table="bike_library_torque" id={t.id} field="notes" value={t.notes} label={`Torque notes · ${t.fastener}`} /></td>
                    <td className={tdCls}>
                      <div className="space-y-1">
                        <MetaRow table="bike_library_torque" id={t.id} source={t.source} verificationValue={t.verification} updatedAt={t.updated_at} />
                        {isAdmin && (
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => archiveRow.mutate({ table: "bike_library_torque", id: t.id, label: `Torque · ${t.fastener}` })}>
                            <Archive className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {isAdmin && (
            <div className="flex flex-wrap gap-2">
              {COMMON_FASTENERS.map((f) => (
                <Button key={f} size="sm" variant="outline" onClick={() => addRow.mutate({ table: "bike_library_torque", values: { fastener: f, unit: "Nm", sort_order: torque.length }, label: `Torque · ${f}` })}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> {f}
                </Button>
              ))}
            </div>
          )}
        </TabsContent>

        {/* VALVES */}
        <TabsContent value="valves" className="mt-4 space-y-3">
          {!valve ? (
            <div className={`${cardCls} p-4 flex items-center justify-between`}>
              <p className="text-sm text-muted-foreground">No valve clearance specification recorded.</p>
              {isAdmin && (
                <Button size="sm" onClick={() => addRow.mutate({ table: "garage_valve_specs", values: {}, label: "Valve clearance specification" })}>
                  <Plus className="h-4 w-4 mr-1" /> Add specification
                </Button>
              )}
            </div>
          ) : (
            <div className={`${cardCls} p-4 space-y-3`}>
              <div className="grid gap-3 sm:grid-cols-4">
                {[
                  ["intake_min", "Intake min"],
                  ["intake_max", "Intake max"],
                  ["exhaust_min", "Exhaust min"],
                  ["exhaust_max", "Exhaust max"],
                  ["unit", "Unit"],
                  ["inspection_interval_km", "Inspection interval (km)"],
                  ["inspection_hours", "Inspection labour (h)"],
                  ["adjustment_hours", "Adjustment labour (h)"],
                ].map(([field, label]) => (
                  <div key={field}>
                    <div className="mb-1 text-[0.65rem] font-mono uppercase tracking-widest text-muted-foreground">{label}</div>
                    <EditableCell table="garage_valve_specs" id={valve.id} field={field} value={(valve as Record<string, unknown>)[field] as string | number | null} label={`Valve · ${label}`} />
                  </div>
                ))}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  ["measurement_notes", "Cold / hot measurement notes"],
                  ["special_tools", "Special tools"],
                  ["parts_required", "Parts normally required"],
                  ["notes", "Notes"],
                ].map(([field, label]) => (
                  <div key={field}>
                    <div className="mb-1 text-[0.65rem] font-mono uppercase tracking-widest text-muted-foreground">{label}</div>
                    <EditableCell table="garage_valve_specs" id={valve.id} field={field} value={(valve as Record<string, unknown>)[field] as string | null} label={`Valve · ${label}`} />
                  </div>
                ))}
              </div>
              <MetaRow table="garage_valve_specs" id={valve.id} source={valve.source} verificationValue={valve.verification} updatedAt={valve.updated_at} />
              <SpecMeta source={valve.source} verificationValue={valve.verification} updatedAt={valve.updated_at} />
            </div>
          )}
        </TabsContent>

        {/* FLUIDS */}
        <TabsContent value="fluids" className="mt-4 space-y-3">
          <div className={cardCls}>
            <table className="w-full">
              <thead className="border-b border-border">
                <tr>
                  <th className={thCls}>Fluid</th>
                  <th className={thCls}>Type / viscosity</th>
                  <th className={thCls}>Standard</th>
                  <th className={thCls}>Qty (no filter)</th>
                  <th className={thCls}>Qty (with filter)</th>
                  <th className={thCls}>Unit</th>
                  <th className={thCls}>Filter part no.</th>
                  <th className={thCls}>Preferred product</th>
                  <th className={thCls}></th>
                </tr>
              </thead>
              <tbody>
                {fluids.length === 0 && (
                  <tr><td className={`${tdCls} text-muted-foreground`} colSpan={9}>No fluid specifications recorded yet.</td></tr>
                )}
                {fluids.map((f) => (
                  <tr key={f.id} className="border-b border-border/50 last:border-0">
                    <td className={tdCls}><EditableCell table="garage_fluid_specs" id={f.id} field="fluid_type" value={f.fluid_type} label={`Fluid · ${f.fluid_type}`} /></td>
                    <td className={tdCls}><EditableCell table="garage_fluid_specs" id={f.id} field="spec" value={f.spec} label={`Fluid spec · ${f.fluid_type}`} placeholder="10W-40" /></td>
                    <td className={tdCls}><EditableCell table="garage_fluid_specs" id={f.id} field="standard" value={f.standard} label={`Standard · ${f.fluid_type}`} placeholder="JASO MA2" /></td>
                    <td className={tdCls}><EditableCell table="garage_fluid_specs" id={f.id} field="qty_without_filter" value={f.qty_without_filter} label={`Qty w/o filter · ${f.fluid_type}`} className="w-20" /></td>
                    <td className={tdCls}><EditableCell table="garage_fluid_specs" id={f.id} field="qty_with_filter" value={f.qty_with_filter} label={`Qty with filter · ${f.fluid_type}`} className="w-20" /></td>
                    <td className={tdCls}><EditableCell table="garage_fluid_specs" id={f.id} field="unit" value={f.unit} label={`Unit · ${f.fluid_type}`} className="w-16" /></td>
                    <td className={tdCls}><EditableCell table="garage_fluid_specs" id={f.id} field="filter_part_number" value={f.filter_part_number} label={`Filter part no. · ${f.fluid_type}`} className="font-mono" /></td>
                    <td className={tdCls}><EditableCell table="garage_fluid_specs" id={f.id} field="preferred_product" value={f.preferred_product} label={`Preferred product · ${f.fluid_type}`} /></td>
                    <td className={tdCls}>
                      <div className="space-y-1">
                        <MetaRow table="garage_fluid_specs" id={f.id} source={f.source} verificationValue={f.verification} updatedAt={f.updated_at} />
                        {isAdmin && (
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => archiveRow.mutate({ table: "garage_fluid_specs", id: f.id, label: `Fluid · ${f.fluid_type}` })}>
                            <Archive className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {isAdmin && (
            <div className="flex flex-wrap gap-2">
              {FLUID_TYPES.map((f) => (
                <Button key={f} size="sm" variant="outline" onClick={() => addRow.mutate({ table: "garage_fluid_specs", values: { fluid_type: f, sort_order: fluids.length }, label: `Fluid · ${f}` })}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> {f}
                </Button>
              ))}
            </div>
          )}
        </TabsContent>

        {/* NOTES */}
        <TabsContent value="notes" className="mt-4 space-y-3">
          <AddNote modelId={modelId} onAdded={invalidate} />
          {notes.map((n) => (
            <div key={n.id} className={`${cardCls} p-3`}>
              {n.title ? <div className="text-sm font-medium">{n.title}</div> : null}
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">{n.body}</p>
              <div className="mt-1 flex items-center gap-2 font-mono text-[0.65rem] text-muted-foreground">
                {new Date(n.created_at).toLocaleDateString("en-GB")}
                {isAdmin && (
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => archiveRow.mutate({ table: "garage_notes", id: n.id, label: "Workshop note" })}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </TabsContent>

        {/* HISTORY */}
        <TabsContent value="history" className="mt-4">
          <div className={cardCls}>
            {revisions.length === 0 && <p className="p-4 text-sm text-muted-foreground">No revisions recorded yet.</p>}
            {revisions.map((r) => (
              <div key={r.id} className="border-b border-border/50 last:border-0 px-4 py-2 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{r.label}</span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {r.old_value ? `${r.old_value} → ` : ""}{r.new_value ?? ""}
                  </span>
                  <span className="ml-auto font-mono text-[0.65rem] uppercase text-muted-foreground">{r.action}</span>
                  <span className="font-mono text-[0.65rem] text-muted-foreground">
                    {new Date(r.created_at).toLocaleDateString("en-GB")}
                  </span>
                </div>
                {r.note ? <div className="text-xs text-muted-foreground">{r.note}</div> : null}
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={!!proposal} onOpenChange={(o) => !o && setProposal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Propose knowledge update</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {proposal?.label} · current reference: <span className="font-mono">{proposal?.current || "—"}</span>
            </p>
            <Input value={proposalValue} onChange={(e) => setProposalValue(e.target.value)} placeholder="Proposed value" />
            <Textarea value={proposalNote} onChange={(e) => setProposalNote(e.target.value)} placeholder="Why? (job number, observation…)" rows={3} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProposal(null)}>Cancel</Button>
            <Button onClick={() => submitProposal.mutate()} disabled={!proposalValue.trim()}>Send for review</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AddNote({ modelId, onAdded }: { modelId: string; onAdded: () => void }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const save = useMutation({
    mutationFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase.from("garage_notes").insert({ model_id: modelId, title: title || null, body, created_by: auth.user?.id ?? null });
      if (error) throw error;
      await logRevision({ modelId, entityTable: "garage_notes", label: "Workshop note added", action: "create", newValue: title || body.slice(0, 60) });
    },
    onSuccess: () => {
      setTitle("");
      setBody("");
      onAdded();
      toast.success("Note added");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className={`${cardCls} p-3 space-y-2`}>
      <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Note title (optional)" className="h-8" />
      <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} placeholder="Workshop note for this model…" />
      <Button size="sm" disabled={!body.trim() || save.isPending} onClick={() => save.mutate()}>
        <Plus className="h-3.5 w-3.5 mr-1" /> Add note
      </Button>
    </div>
  );
}
