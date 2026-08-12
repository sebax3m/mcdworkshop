/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from "@/integrations/supabase/client";
import { matchModel } from "@/lib/garage-learning";
import { fetchAllRows } from "@/lib/fetch-all-rows";

export type ChecklistItem = {
  id: string;
  label: string;
  note: string | null;
  torque_ref: string | null;
  sort_order: number;
  inherited?: boolean;
};

export type Checklist = {
  id: string;
  operation_key: string;
  title: string;
  model_id: string | null;
  base_checklist_id: string | null;
  description: string | null;
  estimated_hours: number | null;
  items: ChecklistItem[];
};

/**
 * Model-specific checklists inherit the generic operation and only add or
 * override steps — the generic list is never duplicated.
 */
export async function fetchChecklist(operationKey: string, modelId?: string | null): Promise<Checklist | null> {
  const { data: lists } = await supabase
    .from("garage_checklists")
    .select("*")
    .eq("operation_key", operationKey)
    .eq("is_archived", false);
  const all = (lists ?? []) as any[];
  const generic = all.find((l) => !l.model_id) ?? null;
  const specific = modelId ? (all.find((l) => l.model_id === modelId) ?? null) : null;
  const head = specific ?? generic;
  if (!head) return null;

  const ids = [generic?.id, specific?.id].filter(Boolean) as string[];
  const { data: items } = await supabase
    .from("garage_checklist_items")
    .select("*")
    .in("checklist_id", ids)
    .order("sort_order");

  const genericItems = ((items ?? []) as any[])
    .filter((i) => i.checklist_id === generic?.id)
    .map((i) => ({ ...i, inherited: Boolean(specific) }));
  const specificItems = ((items ?? []) as any[]).filter((i) => i.checklist_id === specific?.id);

  const overridden = new Set(specificItems.map((i) => i.label.toLowerCase().trim()));
  const merged = [
    ...genericItems.filter((i) => !overridden.has(i.label.toLowerCase().trim())),
    ...specificItems,
  ].sort((a, b) => a.sort_order - b.sort_order);

  return { ...(head as any), items: merged as ChecklistItem[] };
}

export async function listChecklists(modelId?: string | null) {
  const q = supabase.from("garage_checklists").select("*").eq("is_archived", false).order("title");
  const { data } = modelId ? await q.or(`model_id.is.null,model_id.eq.${modelId}`) : await q.is("model_id", null);
  return (data ?? []) as any[];
}

/* ------------------------------------------------------------------ *
 * JOB TECHNICAL BRIEF — built primarily from internal structured data
 * ------------------------------------------------------------------ */

export type BriefSection = { title: string; rows: Array<{ label: string; value: string; note?: string | null }> };

export type JobBrief = {
  bikeLabel: string;
  jobLabel: string;
  modelId: string | null;
  motorcycleId: string | null;
  sections: BriefSection[];
  warnings: string[];
  suggestedParts: Array<{ label: string; detail: string | null }>;
  checklists: Array<{ operation_key: string; title: string }>;
  experience: { jobs: number; lastSeen: string | null };
};

const OPERATION_HINTS: Array<{ key: string; re: RegExp }> = [
  { key: "fork_seal_replacement", re: /fork|seal/i },
  { key: "valve_clearance", re: /valve|clearance/i },
  { key: "full_service", re: /full service|major service/i },
  { key: "basic_service", re: /basic|standard service|oil/i },
  { key: "brake_service", re: /brake|pad|caliper/i },
  { key: "tyre_replacement", re: /tyre|tire|wheel/i },
];

export async function buildJobBrief(jobId: string): Promise<JobBrief> {
  const { data: job } = await supabase
    .from("jobs")
    .select("id, job_number, service_type, description, motorcycle_id, motorcycles(id, make, model, year, rego, mileage)")
    .eq("id", jobId)
    .maybeSingle();
  const bike = (job as any)?.motorcycles ?? null;
  const modelId = await matchModel(bike?.make, bike?.model, bike?.year ?? null);
  const bikeLabel = [bike?.year, bike?.make, bike?.model].filter(Boolean).join(" ") || "Unknown motorcycle";
  const jobLabel = [(job as any)?.service_type, (job as any)?.description].filter(Boolean).join(" · ") || "Job";

  const sections: BriefSection[] = [];
  const warnings: string[] = [];
  const suggestedParts: Array<{ label: string; detail: string | null }> = [];
  const text = `${(job as any)?.service_type ?? ""} ${(job as any)?.description ?? ""}`;

  if (!modelId) {
    warnings.push("No exact Garage Library model matched this motorcycle — verify specifications manually.");
  } else {
    const [fluids, valves, torque, parts, labour, docs] = await Promise.all([
      supabase.from("garage_fluid_specs").select("*").eq("model_id", modelId).eq("is_archived", false).order("sort_order"),
      supabase.from("garage_valve_specs").select("*").eq("model_id", modelId).eq("is_archived", false).limit(1),
      supabase.from("bike_library_torque").select("*").eq("model_id", modelId).eq("is_archived", false).order("sort_order").limit(10),
      supabase.from("bike_library_parts").select("*").eq("model_id", modelId).eq("is_archived", false).order("sort_order").limit(12),
      supabase.from("bike_library_labour").select("*").eq("model_id", modelId).eq("is_archived", false).order("sort_order"),
      supabase.from("garage_documents").select("id, title, manufacturer, generation, doc_type").eq("model_id", modelId).eq("is_archived", false).limit(5),
    ]);

    if ((fluids.data ?? []).length)
      sections.push({
        title: "Fluids",
        rows: (fluids.data as any[]).map((f) => ({
          label: f.fluid_type,
          value: [f.spec, f.qty_with_filter ? `${f.qty_with_filter} ${f.unit ?? "L"}` : null].filter(Boolean).join(" · ") || "—",
          note: f.filter_part_number ? `Filter ${f.filter_part_number}` : f.preferred_product,
        })),
      });

    const v = (valves.data ?? [])[0] as any;
    if (v)
      sections.push({
        title: "Valve clearance",
        rows: [
          { label: "Intake", value: `${v.intake_min ?? "—"} – ${v.intake_max ?? "—"} ${v.unit ?? "mm"}` },
          { label: "Exhaust", value: `${v.exhaust_min ?? "—"} – ${v.exhaust_max ?? "—"} ${v.unit ?? "mm"}` },
        ],
      });

    if ((torque.data ?? []).length)
      sections.push({
        title: "Torque specifications",
        rows: (torque.data as any[]).map((t) => ({ label: t.fastener, value: `${t.torque_nm} ${t.unit ?? "Nm"}`, note: t.notes })),
      });

    const relevantLabour = (labour.data ?? []).filter((l: any) =>
      text.toLowerCase().split(/\s+/).some((w) => w.length > 3 && l.task.toLowerCase().includes(w)),
    );
    if (relevantLabour.length)
      sections.push({
        title: "Workshop labour reference",
        rows: relevantLabour.map((l: any) => ({ label: l.task, value: l.hours ? `${l.hours} h` : "—", note: l.special_tools })),
      });

    for (const p of (parts.data ?? []) as any[]) {
      suggestedParts.push({ label: p.name, detail: [p.brand, p.part_number].filter(Boolean).join(" ") || null });
    }

    if ((docs.data ?? []).length)
      sections.push({
        title: "Linked documentation",
        rows: (docs.data as any[]).map((d) => ({
          label: d.title,
          value: `${d.manufacturer}${d.generation ? ` · ${d.generation}` : ""}`,
          note: d.doc_type.replace(/_/g, " "),
        })),
      });
    else warnings.push("No manual linked to this exact model/generation.");
  }

  // Bike-specific knowledge (modifications) always shown.
  if (bike?.id) {
    const { data: knowledge } = await supabase.from("motorcycle_knowledge").select("*").eq("motorcycle_id", bike.id);
    if ((knowledge ?? []).length)
      sections.unshift({
        title: "This motorcycle — known modifications",
        rows: (knowledge as any[]).map((k) => ({
          label: k.label,
          value: [k.value, k.unit].filter(Boolean).join(" ") || "—",
          note: k.notes,
        })),
      });
  }

  // Motorcycle history
  let lastSeen: string | null = null;
  let jobCount = 0;
  if (bike?.id) {
    const rows = await fetchAllRows((from, to) =>
      supabase
        .from("jobs")
        .select("id, created_at, service_type")
        .eq("motorcycle_id", bike.id)
        .order("created_at", { ascending: false })
        .range(from, to),
    );
    jobCount = rows.length;
    lastSeen = (rows[0] as any)?.created_at ?? null;
    if (rows.length)
      sections.push({
        title: "This motorcycle — history",
        rows: (rows as any[]).slice(0, 6).map((j) => ({
          label: new Date(j.created_at).toLocaleDateString("en-NZ", { day: "2-digit", month: "short", year: "numeric" }),
          value: j.service_type ?? "Job",
        })),
      });
  }

  const checklists: Array<{ operation_key: string; title: string }> = [];
  for (const hint of OPERATION_HINTS) {
    if (!hint.re.test(text)) continue;
    const list = await fetchChecklist(hint.key, modelId);
    if (list) checklists.push({ operation_key: list.operation_key, title: list.title });
  }

  return {
    bikeLabel,
    jobLabel,
    modelId,
    motorcycleId: bike?.id ?? null,
    sections,
    warnings,
    suggestedParts,
    checklists,
    experience: { jobs: jobCount, lastSeen },
  };
}
