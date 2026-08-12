import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, Plus, ShieldCheck, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  TECH_CATEGORIES,
  TECH_SOURCE_TYPES,
  TECH_VERIFICATIONS,
  FLUID_SUBJECTS,
  LABOUR_OPERATIONS,
  SERVICE_INTERVAL_ITEMS,
  isSafetyCritical,
  techCategory,
  techFieldLabel,
  techSourceLabel,
  techVerification,
  toNum,
  type TechSpec,
} from "@/lib/garage-tech";

const cardCls = "rounded-lg border border-border bg-card";
const thCls = "px-3 py-2 text-left text-[0.65rem] font-mono uppercase tracking-widest text-muted-foreground";
const tdCls = "px-3 py-2 align-top text-sm";

export function TechVerificationBadge({ value }: { value: string | null | undefined }) {
  const v = techVerification(value);
  return (
    <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[0.6rem] font-mono uppercase tracking-wider ${v.tone}`}>
      <ShieldCheck className="h-3 w-3" />
      {v.label}
    </span>
  );
}

export function useTechSpecs(modelId: string) {
  return useQuery({
    queryKey: ["garage-model", modelId, "tech-specs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("garage_tech_specs")
        .select("*")
        .eq("model_id", modelId)
        .eq("is_archived", false)
        .order("category")
        .order("subject")
        .order("field");
      if (error) throw error;
      return (data ?? []) as unknown as TechSpec[];
    },
  });
}

function subjectSuggestions(category: string) {
  if (category === "fluids") return FLUID_SUBJECTS;
  if (category === "service_intervals") return SERVICE_INTERVAL_ITEMS;
  if (category === "labour") return LABOUR_OPERATIONS;
  if (category === "filters") return ["Oil filter", "Air filter", "Fuel filter", "Cabin/other"];
  if (category === "torque")
    return ["Front axle", "Rear axle", "Oil drain plug", "Spark plug", "Caliper bolts", "Sprocket nuts", "Cylinder head", "Engine mounts"];
  return [];
}

export function TechSpecsTab({ modelId }: { modelId: string }) {
  const { user, isAdmin } = useCurrentUser();
  const qc = useQueryClient();
  const { data: specs = [] } = useTechSpecs(modelId);
  const [active, setActive] = useState(TECH_CATEGORIES[0].key);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ subject: "", field: "", value: "", unit: "", notes: "", source_type: "manual_entry", source_name: "", verification: "unverified" });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["garage-model", modelId] });

  const rows = useMemo(() => specs.filter((s) => s.category === active), [specs, active]);
  const cat = techCategory(active)!;

  const save = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Record<string, unknown> }) => {
      const { error } = await supabase
        .from("garage_tech_specs")
        .update({ ...patch, updated_by: user?.id ?? null } as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const add = useMutation({
    mutationFn: async () => {
      if (!draft.field || !draft.value) throw new Error("Field and value are required");
      const { error } = await supabase.from("garage_tech_specs").insert({
        model_id: modelId,
        category: active,
        subject: draft.subject,
        field: draft.field,
        value_text: draft.value,
        value_num: toNum(draft.value),
        unit: draft.unit || null,
        notes: draft.notes || null,
        source_type: draft.source_type,
        source_name: draft.source_name || null,
        verification: draft.verification,
        verified_by: draft.verification === "unverified" ? null : user?.id ?? null,
        verified_at: draft.verification === "unverified" ? null : new Date().toISOString(),
        created_by: user?.id ?? null,
        updated_by: user?.id ?? null,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      setDraft({ subject: "", field: "", value: "", unit: "", notes: "", source_type: "manual_entry", source_name: "", verification: "unverified" });
      setAdding(false);
      invalidate();
      toast.success("Technical value added");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const archive = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("garage_tech_specs").update({ is_archived: true, updated_by: user?.id ?? null } as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {TECH_CATEGORIES.map((c) => {
          const count = specs.filter((s) => s.category === c.key).length;
          return (
            <button
              key={c.key}
              onClick={() => setActive(c.key)}
              className={`rounded border px-2 py-1 text-[0.65rem] font-mono uppercase tracking-wider transition-colors ${
                active === c.key ? "border-primary/60 bg-primary/10 text-foreground" : "border-border bg-muted/20 text-muted-foreground hover:text-foreground"
              }`}
            >
              {c.label}
              <span className="ml-1 opacity-60">{count}</span>
            </button>
          );
        })}
      </div>

      {cat.safetyCritical ? (
        <div className="flex items-center gap-2 rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
          <AlertTriangle className="h-3.5 w-3.5" /> Safety-critical category — values stay unverified until a technician confirms them against a manual.
        </div>
      ) : null}

      <div className={cardCls}>
        <table className="w-full">
          <thead className="border-b border-border">
            <tr>
              {cat.subjectLabel ? <th className={thCls}>{cat.subjectLabel}</th> : null}
              <th className={thCls}>Field</th>
              <th className={thCls}>Value</th>
              <th className={thCls}>Unit</th>
              <th className={thCls}>Source</th>
              <th className={thCls}>Verification</th>
              <th className={thCls}></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className={`${tdCls} text-muted-foreground`} colSpan={7}>
                  No {cat.label.toLowerCase()} recorded yet.
                </td>
              </tr>
            ) : null}
            {rows.map((s) => (
              <tr key={s.id} className="border-b border-border/60 last:border-0">
                {cat.subjectLabel ? <td className={`${tdCls} font-mono text-xs`}>{s.subject || "—"}</td> : null}
                <td className={`${tdCls} text-xs`}>
                  {techFieldLabel(s.category, s.field)}
                  {s.is_alternative ? <span className="ml-1 rounded border border-border px-1 text-[0.55rem] uppercase text-muted-foreground">alt</span> : null}
                  {s.review_status !== "ok" ? <span className="ml-1 rounded border border-amber-500/40 px-1 text-[0.55rem] uppercase text-amber-400">review</span> : null}
                </td>
                <td className={tdCls}>
                  <Input
                    defaultValue={s.value_text ?? (s.value_num !== null ? String(s.value_num) : "")}
                    className="h-8 text-xs"
                    onBlur={(e) => {
                      const v = e.target.value;
                      if (v === (s.value_text ?? "")) return;
                      save.mutate({ id: s.id, patch: { value_text: v, value_num: toNum(v), review_status: "ok" } });
                    }}
                  />
                </td>
                <td className={`${tdCls} w-20`}>
                  <Input defaultValue={s.unit ?? ""} className="h-8 text-xs" onBlur={(e) => e.target.value !== (s.unit ?? "") && save.mutate({ id: s.id, patch: { unit: e.target.value || null } })} />
                </td>
                <td className={`${tdCls} w-56`}>
                  <Select value={s.source_type} onValueChange={(v) => save.mutate({ id: s.id, patch: { source_type: v } })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TECH_SOURCE_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value} className="text-xs">{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    defaultValue={s.source_name ?? ""}
                    placeholder="Source name / document"
                    className="mt-1 h-7 text-[0.7rem]"
                    onBlur={(e) => e.target.value !== (s.source_name ?? "") && save.mutate({ id: s.id, patch: { source_name: e.target.value || null } })}
                  />
                </td>
                <td className={`${tdCls} w-52`}>
                  <Select
                    value={s.verification}
                    onValueChange={(v) =>
                      save.mutate({
                        id: s.id,
                        patch: {
                          verification: v,
                          verified_by: v === "unverified" ? null : user?.id ?? null,
                          verified_at: v === "unverified" ? null : new Date().toISOString(),
                          review_status: "ok",
                        },
                      })
                    }
                  >
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TECH_VERIFICATIONS.map((v) => (
                        <SelectItem key={v.value} value={v.value} className="text-xs">{v.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="mt-1"><TechVerificationBadge value={s.verification} /></div>
                </td>
                <td className={tdCls}>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => archive.mutate(s.id)} title="Archive value">
                    <Archive className="h-3.5 w-3.5" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {adding ? (
        <div className={`${cardCls} space-y-2 p-3`}>
          {cat.subjectLabel ? (
            <div>
              <label className="text-[0.65rem] font-mono uppercase tracking-widest text-muted-foreground">{cat.subjectLabel}</label>
              <Input list={`subjects-${active}`} value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} className="h-8 text-xs" />
              <datalist id={`subjects-${active}`}>
                {subjectSuggestions(active).map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>
          ) : null}
          <div className="grid gap-2 sm:grid-cols-3">
            <Select value={draft.field} onValueChange={(v) => setDraft({ ...draft, field: v, unit: cat.fields.find((f) => f.key === v)?.unit ?? "" })}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Field" /></SelectTrigger>
              <SelectContent>
                {cat.fields.map((f) => (
                  <SelectItem key={f.key} value={f.key} className="text-xs">{f.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input placeholder="Value" value={draft.value} onChange={(e) => setDraft({ ...draft, value: e.target.value })} className="h-8 text-xs" />
            <Input placeholder="Unit" value={draft.unit} onChange={(e) => setDraft({ ...draft, unit: e.target.value })} className="h-8 text-xs" />
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <Select value={draft.source_type} onValueChange={(v) => setDraft({ ...draft, source_type: v })}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TECH_SOURCE_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value} className="text-xs">{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input placeholder="Source name / reference" value={draft.source_name} onChange={(e) => setDraft({ ...draft, source_name: e.target.value })} className="h-8 text-xs" />
            <Select value={draft.verification} onValueChange={(v) => setDraft({ ...draft, verification: v })}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TECH_VERIFICATIONS.map((v) => (
                  <SelectItem key={v.value} value={v.value} className="text-xs">{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Textarea placeholder="Notes" rows={2} value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} className="text-xs" />
          <div className="flex gap-2">
            <Button size="sm" onClick={() => add.mutate()} disabled={add.isPending}>Save value</Button>
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
          </div>
        </div>
      ) : (
        <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
          <Plus className="mr-1 h-3.5 w-3.5" /> Add {cat.label.toLowerCase()} value
        </Button>
      )}

      {rows.some((r) => r.notes) ? (
        <div className={`${cardCls} p-3 text-xs text-muted-foreground space-y-1`}>
          {rows.filter((r) => r.notes).map((r) => (
            <div key={`n-${r.id}`}>
              <span className="font-mono uppercase tracking-wider">{r.subject || techFieldLabel(r.category, r.field)}:</span> {r.notes}
              <span className="ml-1 opacity-60">({techSourceLabel(r.source_type)})</span>
            </div>
          ))}
        </div>
      ) : null}

      {!isAdmin ? null : (
        <p className="text-[0.65rem] text-muted-foreground">Archived values stay in the database for audit; ask an admin to delete permanently.</p>
      )}
    </div>
  );
}
